package com.biblequiz.modules.quiz.service;

import com.biblequiz.infrastructure.time.GameClock;
import com.biblequiz.modules.quiz.entity.DailyMission;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.DailyMissionRepository;
import com.biblequiz.modules.ranked.service.UserTierService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Nhiệm vụ ngày (SPEC_USER §13). PCV-7 (Phòng chơi v2, 12/10/2026): mọi loại nhiệm vụ đều có
 * nguồn sự kiện — trước đây chỉ 3/13 loại được đếm, nên từ bậc 2 trở lên đa số nhiệm vụ không
 * làm được. Điểm vào:
 * <ul>
 *   <li>{@link #onAnswer} — mỗi câu trả lời (Luyện Tập, Đấu Hạng, Thử thách ngày, Phòng chơi);</li>
 *   <li>{@link #onEvent} — một việc xong (chơi 1 lượt, chơi/thắng phòng, ôn Học Thuộc…);</li>
 *   <li>{@link #onRankedPoints} — điểm Đấu Hạng trong ngày.</li>
 * </ul>
 * Xong cả 3 nhiệm vụ → cộng {@value #BONUS_XP} XP thật, một lần mỗi ngày (DECISIONS 2026-10-12).
 */
@Service
public class DailyMissionService {

    private static final Logger log = LoggerFactory.getLogger(DailyMissionService.class);
    private static final int BONUS_XP = 50;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final DailyMissionRepository missionRepository;
    private final UserTierService userTierService;

    /** Cộng XP thưởng; null trong các test cũ không quan tâm tới thưởng. */
    @Autowired(required = false)
    private MissionRewardService rewardService;

    public DailyMissionService(DailyMissionRepository missionRepository,
                                UserTierService userTierService) {
        this.missionRepository = missionRepository;
        this.userTierService = userTierService;
    }

    /** Mission definition: type, description key, config JSON, target. */
    public record MissionDef(String type, String descriptionKey, String config, int target) {}

    /** Một câu trả lời vừa được chấm. {@code responseMs} ≤ 0 = không đo được thời gian. */
    public record AnswerEvent(boolean correct, Question.Difficulty difficulty, String book, int responseMs) {}

    // Mission templates by tier level (1-6). PCV-7: các loại không còn lối vào trong app
    // (Speed Round, Mystery Mode, top 3 bảng ngày, duyệt câu AI) đã được thay — xem RETIRED.
    private static final Map<Integer, List<MissionDef>> MISSION_TEMPLATES = Map.of(
        1, List.of(
            new MissionDef("answer_correct", "mission.answerCorrect3", "{\"count\":3}", 3),
            new MissionDef("complete_daily_challenge", "mission.completeDailyChallenge", "{}", 1),
            // Target stores the streak length so the description and progress display agree.
            new MissionDef("answer_combo", "mission.combo3", "{\"streak\":3}", 3)
        ),
        2, List.of(
            new MissionDef("play_any_mode", "mission.playAnyMode", "{}", 1),
            new MissionDef("answer_correct_difficulty", "mission.correctMedium5", "{\"difficulty\":\"MEDIUM\",\"count\":5}", 5),
            new MissionDef("ranked_score", "mission.rankedScore60", "{\"minScore\":60}", 1)
        ),
        3, List.of(
            new MissionDef("answer_correct", "mission.answerCorrect5", "{\"count\":5}", 5),
            new MissionDef("answer_correct_difficulty", "mission.correctHard3", "{\"difficulty\":\"HARD\",\"count\":3}", 3),
            new MissionDef("win_multiplayer_room", "mission.winMultiplayer", "{}", 1)
        ),
        4, List.of(
            new MissionDef("answer_correct_book", "mission.correctBook5", "{\"count\":5}", 5),
            new MissionDef("play_multiplayer_room", "mission.playMultiplayer", "{}", 1),
            new MissionDef("answer_correct_difficulty", "mission.correctHard10", "{\"difficulty\":\"HARD\",\"count\":10}", 10)
        ),
        5, List.of(
            new MissionDef("memorize_review", "mission.memorizeReview3", "{\"count\":3}", 3),
            new MissionDef("answer_combo", "mission.combo10", "{\"streak\":10}", 10),
            new MissionDef("win_multiplayer_room", "mission.winMultiplayer", "{}", 1)
        ),
        6, List.of(
            new MissionDef("answer_correct_difficulty", "mission.correctHard5", "{\"difficulty\":\"HARD\",\"count\":5}", 5),
            new MissionDef("answer_hard_fast", "mission.hardFast5", "{\"count\":5,\"maxSec\":10}", 5),
            new MissionDef("answer_correct", "mission.answerCorrect10", "{\"count\":10}", 10)
        )
    );

    /** PCV-7: loại không còn lối vào → loại thay thế (áp cho cả dòng nhiệm vụ đã tạo trong ngày). */
    private static final Map<String, MissionDef> RETIRED = Map.of(
        "complete_speed_round", new MissionDef("play_multiplayer_room", "mission.playMultiplayer", "{}", 1),
        "complete_mystery_mode", new MissionDef("memorize_review", "mission.memorizeReview3", "{\"count\":3}", 3),
        "leaderboard_daily_top3", new MissionDef("win_multiplayer_room", "mission.winMultiplayer", "{}", 1),
        "review_ai_draft", new MissionDef("answer_correct_difficulty", "mission.correctHard5", "{\"difficulty\":\"HARD\",\"count\":5}", 5)
    );

    /** Get or create today's missions for a user (retired types are swapped in place). */
    @Transactional
    public List<DailyMission> getOrCreateMissions(String userId) {
        LocalDate today = GameClock.today();
        List<DailyMission> existing = missionRepository.findByUserIdAndDateOrderByMissionSlot(userId, today);

        if (!existing.isEmpty()) {
            replaceRetired(existing);
            return existing;
        }

        int tierLevel = userTierService.getTierLevel(userId);
        List<MissionDef> templates = MISSION_TEMPLATES.getOrDefault(tierLevel, MISSION_TEMPLATES.get(1));

        List<DailyMission> missions = new ArrayList<>();
        for (int i = 0; i < templates.size(); i++) {
            MissionDef def = templates.get(i);
            missions.add(new DailyMission(UUID.randomUUID().toString(), userId, today, i + 1,
                    def.type(), def.config(), def.target()));
        }

        missionRepository.saveAll(missions);
        log.info("[DAILY_MISSION] Created {} missions for user {} (tier {})", missions.size(), userId, tierLevel);
        return missions;
    }

    private void replaceRetired(List<DailyMission> missions) {
        boolean changed = false;
        for (DailyMission m : missions) {
            MissionDef repl = RETIRED.get(m.getMissionType());
            if (repl == null) continue;
            m.setMissionType(repl.type());
            m.setConfig(repl.config());
            m.setTarget(repl.target());
            m.setProgress(0);
            m.setCompleted(false);
            m.setCompletedAt(null);
            changed = true;
        }
        if (changed) missionRepository.saveAll(missions);
    }

    // ── Điểm vào sự kiện (PCV-7) ──

    /** Một câu trả lời: đúng, chuỗi đúng, theo độ khó, câu khó nhanh, cùng 1 sách. */
    @Transactional
    public void onAnswer(String userId, AnswerEvent e) {
        LocalDate today = GameClock.today();
        List<DailyMission> missions = getOrCreateMissions(userId);
        for (DailyMission m : missions) {
            if (m.isCompleted()) continue;
            Map<String, Object> cfg = config(m);
            boolean changed = switch (m.getMissionType()) {
                case "answer_correct" -> e.correct() && bump(m, 1);
                case "answer_combo" -> e.correct() ? bump(m, 1) : resetProgress(m);
                case "answer_correct_difficulty" -> e.correct() && e.difficulty() != null
                        && e.difficulty().name().equalsIgnoreCase(String.valueOf(cfg.getOrDefault("difficulty", "HARD")))
                        && bump(m, 1);
                case "answer_hard_fast" -> e.correct() && e.difficulty() == Question.Difficulty.hard
                        && e.responseMs() > 0 && e.responseMs() <= intOf(cfg.get("maxSec"), 10) * 1000
                        && bump(m, 1);
                case "answer_correct_book" -> e.correct() && e.book() != null && !e.book().isBlank()
                        && bumpBook(m, cfg, e.book());
                default -> false;
            };
            if (changed) {
                completeIfReached(m, userId);
                missionRepository.save(m);
            }
        }
        checkAndGrantBonus(userId, today, missions);
    }

    /** Một việc xong (vd {@code play_multiplayer_room}, {@code memorize_review}, {@code play_any_mode}). */
    @Transactional
    public void onEvent(String userId, String missionType) {
        trackProgress(userId, missionType, 1);
    }

    /** PCV-7: {@code ranked_score} xong khi điểm Đấu Hạng trong ngày đạt {@code minScore}. */
    @Transactional
    public void onRankedPoints(String userId, int pointsToday) {
        LocalDate today = GameClock.today();
        List<DailyMission> missions = getOrCreateMissions(userId);
        for (DailyMission m : missions) {
            if (!"ranked_score".equals(m.getMissionType()) || m.isCompleted()) continue;
            if (pointsToday >= intOf(config(m).get("minScore"), 60)) {
                m.setProgress(m.getTarget());
                completeIfReached(m, userId);
                missionRepository.save(m);
            }
        }
        checkAndGrantBonus(userId, today, missions);
    }

    /**
     * Track progress for a specific mission type.
     * Call this after game events (answer, session end, etc.)
     */
    @Transactional
    public void trackProgress(String userId, String missionType, int increment) {
        LocalDate today = GameClock.today();
        List<DailyMission> missions = getOrCreateMissions(userId);

        for (DailyMission m : missions) {
            if (m.getMissionType().equals(missionType) && !m.isCompleted()) {
                m.setProgress(Math.min(m.getProgress() + increment, m.getTarget()));
                completeIfReached(m, userId);
                missionRepository.save(m);
            }
        }

        checkAndGrantBonus(userId, today, missions);
    }

    /**
     * Track combo/streak progress: increment on correct, reset to 0 on wrong.
     * Idempotent once mission is completed (so a later wrong answer doesn't
     * "un-complete" the achievement).
     */
    @Transactional
    public void trackComboProgress(String userId, String missionType, boolean correct) {
        LocalDate today = GameClock.today();
        List<DailyMission> missions = getOrCreateMissions(userId);

        for (DailyMission m : missions) {
            if (!m.getMissionType().equals(missionType) || m.isCompleted()) continue;
            if (correct) {
                m.setProgress(Math.min(m.getProgress() + 1, m.getTarget()));
                completeIfReached(m, userId);
            } else if (m.getProgress() > 0) {
                m.setProgress(0);
            } else {
                continue; // no change → skip save
            }
            missionRepository.save(m);
        }

        checkAndGrantBonus(userId, today, missions);
    }

    private static boolean bump(DailyMission m, int by) {
        m.setProgress(Math.min(m.getProgress() + by, m.getTarget()));
        return true;
    }

    private static boolean resetProgress(DailyMission m) {
        if (m.getProgress() == 0) return false;
        m.setProgress(0);
        return true;
    }

    /** "Cùng 1 sách": đếm riêng từng sách trong config.books; tiến độ = sách đếm được nhiều nhất. */
    private static boolean bumpBook(DailyMission m, Map<String, Object> cfg, String book) {
        @SuppressWarnings("unchecked")
        Map<String, Object> books = cfg.get("books") instanceof Map<?, ?> b
                ? new LinkedHashMap<>((Map<String, Object>) b) : new LinkedHashMap<>();
        books.put(book, intOf(books.get(book), 0) + 1);
        cfg.put("books", books);
        int best = books.values().stream().mapToInt(v -> intOf(v, 0)).max().orElse(0);
        m.setConfig(write(cfg));
        m.setProgress(Math.min(best, m.getTarget()));
        return true;
    }

    private static void completeIfReached(DailyMission m, String userId) {
        if (!m.isCompleted() && m.getProgress() >= m.getTarget()) {
            m.setCompleted(true);
            m.setCompletedAt(LocalDateTime.now(ZoneOffset.UTC));
            log.info("[DAILY_MISSION] Mission {} completed for user {}", m.getMissionType(), userId);
        }
    }

    private void checkAndGrantBonus(String userId, LocalDate date, List<DailyMission> missions) {
        if (missions.size() < 3) return;

        boolean allCompleted = missions.stream().allMatch(DailyMission::isCompleted);
        boolean anyBonusClaimed = missions.stream().anyMatch(DailyMission::isBonusClaimed);

        if (allCompleted && !anyBonusClaimed) {
            for (DailyMission m : missions) {
                m.setBonusClaimed(true);
                missionRepository.save(m);
            }
            // PCV-7: cộng XP thật (trước đây chỉ ghi log, giao diện vẫn báo "+50 XP nhận được!").
            if (rewardService != null) {
                rewardService.creditBonus(userId, BONUS_XP);
            }
            log.info("[DAILY_MISSION] All missions completed for user {} on {}, bonus {} XP", userId, date, BONUS_XP);
        }
    }

    /** Build API response for daily missions. */
    public Map<String, Object> getMissionsResponse(String userId) {
        List<DailyMission> missions = getOrCreateMissions(userId);
        LocalDate today = GameClock.today();

        boolean allCompleted = missions.stream().allMatch(DailyMission::isCompleted);
        boolean bonusClaimed = missions.stream().anyMatch(DailyMission::isBonusClaimed);

        List<Map<String, Object>> missionList = missions.stream().map(m -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("slot", m.getMissionSlot());
            item.put("type", m.getMissionType());
            item.put("description", getMissionDescription(m));
            item.put("progress", m.getProgress());
            item.put("target", m.getTarget());
            item.put("completed", m.isCompleted());
            return item;
        }).toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("date", today.toString());
        response.put("missions", missionList);
        response.put("allCompleted", allCompleted);
        response.put("bonusClaimed", bonusClaimed);
        response.put("bonusXp", BONUS_XP);
        return response;
    }

    private String getMissionDescription(DailyMission m) {
        int target = m.getTarget();
        Map<String, Object> cfg = config(m);
        return switch (m.getMissionType()) {
            case "answer_correct" -> "Trả lời đúng " + target + " câu";
            case "complete_daily_challenge" -> "Hoàn thành thử thách hàng ngày";
            case "answer_combo" -> target <= 1
                    ? "Trả lời câu đầu tiên đúng"
                    : "Trả lời " + target + " câu liên tiếp đúng";
            case "play_any_mode" -> "Chơi 1 lượt ở bất kỳ chế độ nào";
            case "answer_correct_difficulty" -> "Trả lời đúng " + target + " câu "
                    + difficultyLabel(String.valueOf(cfg.getOrDefault("difficulty", "HARD")));
            case "ranked_score" -> "Đạt " + intOf(cfg.get("minScore"), 60) + " điểm Đấu Hạng trong ngày";
            case "win_multiplayer_room" -> "Thắng 1 trận Phòng chơi";
            case "play_multiplayer_room" -> "Chơi 1 trận Phòng chơi";
            case "memorize_review" -> "Ôn " + target + " câu Học Thuộc";
            case "answer_correct_book" -> "Trả lời đúng " + target + " câu trong cùng 1 sách";
            case "answer_hard_fast" -> "Trả lời đúng " + target + " câu khó trong "
                    + intOf(cfg.get("maxSec"), 10) + " giây";
            default -> m.getMissionType();
        };
    }

    private static String difficultyLabel(String d) {
        return switch (d.toUpperCase()) {
            case "EASY" -> "dễ";
            case "MEDIUM" -> "trung bình";
            default -> "khó";
        };
    }

    private static Map<String, Object> config(DailyMission m) {
        try {
            if (m.getConfig() == null || m.getConfig().isBlank()) return new LinkedHashMap<>();
            return JSON.readValue(m.getConfig(), new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private static String write(Map<String, Object> cfg) {
        try {
            return JSON.writeValueAsString(cfg);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static int intOf(Object v, int fallback) {
        return v instanceof Number n ? n.intValue() : fallback;
    }
}
