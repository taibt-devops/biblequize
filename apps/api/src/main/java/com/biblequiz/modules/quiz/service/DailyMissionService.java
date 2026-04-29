package com.biblequiz.modules.quiz.service;

import com.biblequiz.modules.quiz.entity.DailyMission;
import com.biblequiz.modules.quiz.repository.DailyMissionRepository;
import com.biblequiz.modules.ranked.service.UserTierService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class DailyMissionService {

    private static final Logger log = LoggerFactory.getLogger(DailyMissionService.class);
    private static final int BONUS_XP = 50;

    private final DailyMissionRepository missionRepository;
    private final UserTierService userTierService;

    public DailyMissionService(DailyMissionRepository missionRepository,
                                UserTierService userTierService) {
        this.missionRepository = missionRepository;
        this.userTierService = userTierService;
    }

    /**
     * Mission definition: type, description key, config JSON, target.
     */
    public record MissionDef(String type, String descriptionKey, String config, int target) {}

    // Mission templates by tier level (1-6)
    private static final Map<Integer, List<MissionDef>> MISSION_TEMPLATES = Map.of(
        1, List.of(
            new MissionDef("answer_correct", "mission.answerCorrect3", "{\"count\":3}", 3),
            new MissionDef("complete_daily_challenge", "mission.completeDailyChallenge", "{}", 1),
            // Target now stores the streak length so the description and
            // progress display agree. Previously target=1 produced the
            // wrong "Đạt combo 1 câu liên tiếp" UI string.
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
            new MissionDef("complete_speed_round", "mission.completeSpeedRound", "{}", 1),
            new MissionDef("answer_correct_difficulty", "mission.correctHard10", "{\"difficulty\":\"HARD\",\"count\":10}", 10)
        ),
        5, List.of(
            new MissionDef("complete_mystery_mode", "mission.completeMystery", "{}", 1),
            // target = streak length (see Tier-1 note) so the description renders correctly.
            new MissionDef("answer_combo", "mission.combo10", "{\"streak\":10}", 10),
            new MissionDef("leaderboard_daily_top3", "mission.leaderboardTop3", "{}", 1)
        ),
        6, List.of(
            new MissionDef("review_ai_draft", "mission.reviewAI3", "{\"count\":3}", 3),
            new MissionDef("answer_hard_fast", "mission.hardFast5", "{\"count\":5,\"maxSec\":10}", 5),
            new MissionDef("answer_correct", "mission.answerCorrect10", "{\"count\":10}", 10)
        )
    );

    /**
     * Get or create today's missions for a user.
     */
    @Transactional
    public List<DailyMission> getOrCreateMissions(String userId) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<DailyMission> existing = missionRepository.findByUserIdAndDateOrderByMissionSlot(userId, today);

        if (!existing.isEmpty()) {
            return existing;
        }

        // Create new missions based on user's current tier
        int tierLevel = userTierService.getTierLevel(userId);
        List<MissionDef> templates = MISSION_TEMPLATES.getOrDefault(tierLevel, MISSION_TEMPLATES.get(1));

        List<DailyMission> missions = new ArrayList<>();
        for (int i = 0; i < templates.size(); i++) {
            MissionDef def = templates.get(i);
            DailyMission mission = new DailyMission(
                UUID.randomUUID().toString(),
                userId,
                today,
                i + 1,
                def.type(),
                def.config(),
                def.target()
            );
            missions.add(mission);
        }

        missionRepository.saveAll(missions);
        log.info("[DAILY_MISSION] Created 3 missions for user {} (tier {})", userId, tierLevel);
        return missions;
    }

    /**
     * Track progress for a specific mission type.
     * Call this after game events (answer, session end, etc.)
     */
    @Transactional
    public void trackProgress(String userId, String missionType, int increment) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<DailyMission> missions = missionRepository.findByUserIdAndDateOrderByMissionSlot(userId, today);

        for (DailyMission m : missions) {
            if (m.getMissionType().equals(missionType) && !m.isCompleted()) {
                m.setProgress(Math.min(m.getProgress() + increment, m.getTarget()));
                if (m.getProgress() >= m.getTarget()) {
                    m.setCompleted(true);
                    m.setCompletedAt(LocalDateTime.now(ZoneOffset.UTC));
                    log.info("[DAILY_MISSION] Mission {} completed for user {}", m.getMissionType(), userId);
                }
                missionRepository.save(m);
            }
        }

        // Check if all 3 completed → grant bonus
        checkAndGrantBonus(userId, today, missions);
    }

    private void checkAndGrantBonus(String userId, LocalDate date, List<DailyMission> missions) {
        if (missions.size() < 3) return;

        boolean allCompleted = missions.stream().allMatch(DailyMission::isCompleted);
        boolean anyBonusClaimed = missions.stream().anyMatch(DailyMission::isBonusClaimed);

        if (allCompleted && !anyBonusClaimed) {
            // Mark bonus claimed on all missions
            for (DailyMission m : missions) {
                m.setBonusClaimed(true);
                missionRepository.save(m);
            }
            log.info("[DAILY_MISSION] All missions completed for user {}, bonus {} XP granted", userId, BONUS_XP);
            // Note: Actual XP addition happens through the caller (scored session flow)
        }
    }

    /**
     * Build API response for daily missions.
     */
    public Map<String, Object> getMissionsResponse(String userId) {
        List<DailyMission> missions = getOrCreateMissions(userId);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        boolean allCompleted = missions.stream().allMatch(DailyMission::isCompleted);
        boolean bonusClaimed = missions.stream().anyMatch(DailyMission::isBonusClaimed);

        List<Map<String, Object>> missionList = missions.stream().map(m -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("slot", m.getMissionSlot());
            item.put("type", m.getMissionType());
            item.put("description", getMissionDescription(m.getMissionType(), m.getTarget()));
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

    private String getMissionDescription(String type, int target) {
        return switch (type) {
            case "answer_correct" -> "Trả lời đúng " + target + " câu";
            case "complete_daily_challenge" -> "Hoàn thành thử thách hàng ngày";
            case "answer_combo" -> target <= 1
                    ? "Trả lời câu đầu tiên đúng"
                    : "Trả lời " + target + " câu liên tiếp đúng";
            case "play_any_mode" -> "Chơi bất kỳ chế độ nào";
            case "answer_correct_difficulty" -> "Trả lời đúng " + target + " câu khó";
            case "ranked_score" -> "Đạt 60+ điểm trong Ranked";
            case "win_multiplayer_room" -> "Thắng 1 phòng multiplayer";
            case "answer_correct_book" -> "Trả lời đúng " + target + " câu cùng 1 sách";
            case "complete_speed_round" -> "Hoàn thành 1 vòng Speed Race";
            case "answer_hard_fast" -> "Trả lời đúng " + target + " câu khó (≤10s)";
            case "complete_mystery_mode" -> "Hoàn thành Mystery Mode";
            case "leaderboard_daily_top3" -> "Lọt top 3 bảng xếp hạng ngày";
            case "review_ai_draft" -> "Duyệt " + target + " câu AI tạo";
            default -> type;
        };
    }
}
