package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Engine của Sinh tồn (Battle Royale) — Phòng chơi v2 (design §2.2):
 * <ul>
 *   <li>mỗi người {@link #initLives 2 mạng}; sai hoặc không trả lời mất 1 mạng, hết mạng thì bị loại;</li>
 *   <li>ân xá: cả nhóm còn trong cuộc cùng sai thì không ai mất mạng (giữ luật cũ);</li>
 *   <li>câu quyết định (sau câu chính): sai là bị loại ngay, vẫn ân xá khi cả nhóm cùng sai;</li>
 *   <li>câu trả lời của "bóng" (người đã bị loại, PCV-13) không bao giờ tính cho người còn sống.</li>
 * </ul>
 * Người chơi chưa có mạng (phòng bắt đầu trước khi có luật mạng) bị loại ngay lần trượt đầu — đúng luật cũ.
 */
@Service
public class BattleRoyaleEngine {

    @Autowired
    private RoomPlayerRepository roomPlayerRepository;

    @Autowired
    private RoomAnswerRepository roomAnswerRepository;

    /** Đầu trận: mọi người còn trong cuộc có {@code lives} mạng, chưa hồi sinh, chưa bị loại. */
    @Transactional
    public void initLives(String roomId, int lives) {
        List<RoomPlayer> active = roomPlayerRepository
                .findByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ACTIVE);
        for (RoomPlayer p : active) {
            p.setLives(lives);
            p.setGhostStreak(0);
            p.setRevived(false);
            p.setEliminatedRound(null);
        }
        roomPlayerRepository.saveAll(active);
    }

    /**
     * Xử lý một vòng đã đóng.
     *
     * @param questionIndex chỉ số câu (0-based) — ghi vào người bị loại để xếp hạng
     * @param showdown      câu quyết định: trượt là bị loại ngay
     */
    @Transactional
    public RoundOutcome processRoundEnd(String roomId, String roundId, int questionIndex, boolean showdown) {
        List<RoomPlayer> active = roomPlayerRepository
                .findByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ACTIVE);
        if (active.isEmpty()) return RoundOutcome.none();

        Set<String> correct = roomAnswerRepository.findByRoundId(roundId).stream()
                .filter(a -> !a.isGhost() && Boolean.TRUE.equals(a.getIsCorrect()))
                .map(RoomAnswer::getUserId)
                .collect(Collectors.toSet());
        List<RoomPlayer> missed = active.stream()
                .filter(p -> !correct.contains(p.getUser().getId()))
                .collect(Collectors.toList());
        if (missed.isEmpty()) return RoundOutcome.none();
        if (missed.size() == active.size()) return new RoundOutcome(List.of(), true); // ân xá

        List<RoomPlayer> out = new ArrayList<>();
        for (RoomPlayer p : missed) {
            int lives = showdown ? 0 : Math.max(0, p.getLives() - 1);
            p.setLives(lives);
            if (lives == 0) {
                out.add(p);
            } else {
                roomPlayerRepository.save(p);
            }
        }

        // Hạng tạm = số người còn lại + 1 (cùng lượt thì đồng hạng); hạng cuối chốt ở assignFinalRanks.
        int rank = active.size() - out.size() + 1;
        List<EliminatedPlayerInfo> eliminated = new ArrayList<>();
        for (RoomPlayer p : out) {
            p.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED);
            p.setEliminatedRound(questionIndex);
            p.setFinalRank(rank);
            p.setGhostStreak(0);
            roomPlayerRepository.save(p);
            eliminated.add(new EliminatedPlayerInfo(p.getUser().getId(), p.getUsername(), rank));
        }
        return new RoundOutcome(eliminated, false);
    }

    /** Luật cũ (một lần trượt là bị loại khi người chơi chưa có mạng) — giữ cho mã gọi cũ. */
    @Transactional
    public List<EliminatedPlayerInfo> processRoundEnd(String roomId, String roundId) {
        return processRoundEnd(roomId, roundId, -1, false).eliminated;
    }

    /**
     * Hạng cuối trận:
     * <ol>
     *   <li>người còn lại: mạng còn nhiều hơn → nhiều câu đúng hơn → trả lời nhanh hơn (bằng hệt thì đồng hạng);</li>
     *   <li>người bị loại: bị loại muộn hơn xếp trên; cùng lượt thì đồng hạng;</li>
     *   <li>người đã bỏ trận: xếp cuối, đồng hạng.</li>
     * </ol>
     * Không xếp theo điểm — điểm tốc độ không đơn điệu theo số câu đúng (DECISIONS 2026-06-12).
     */
    @Transactional
    public void assignFinalRanks(String roomId) {
        List<RoomPlayer> all = roomPlayerRepository.findByRoomId(roomId);
        List<RoomPlayer> survivors = new ArrayList<>();
        List<RoomPlayer> eliminated = new ArrayList<>();
        List<RoomPlayer> others = new ArrayList<>();
        for (RoomPlayer p : all) {
            if (p.getPlayerStatus() == RoomPlayer.PlayerStatus.ACTIVE) survivors.add(p);
            else if (p.getPlayerStatus() == RoomPlayer.PlayerStatus.ELIMINATED) eliminated.add(p);
            else others.add(p);
        }

        Comparator<RoomPlayer> survivorOrder = Comparator
                .comparingInt((RoomPlayer p) -> p.getLives()).reversed()
                .thenComparing(Comparator.comparingInt((RoomPlayer p) -> p.getCorrectAnswers()).reversed())
                .thenComparingDouble(p -> p.getAverageReactionTime() != null ? p.getAverageReactionTime() : Double.MAX_VALUE);
        survivors.sort(survivorOrder);
        for (int i = 0; i < survivors.size(); i++) {
            RoomPlayer p = survivors.get(i);
            boolean tie = i > 0 && survivorOrder.compare(survivors.get(i - 1), p) == 0;
            p.setFinalRank(tie ? survivors.get(i - 1).getFinalRank() : i + 1);
        }

        int offset = survivors.size();
        Comparator<RoomPlayer> outOrder = Comparator.comparingInt(
                (RoomPlayer p) -> p.getEliminatedRound() != null ? p.getEliminatedRound() : -1).reversed();
        eliminated.sort(outOrder);
        for (int i = 0; i < eliminated.size(); i++) {
            RoomPlayer p = eliminated.get(i);
            boolean tie = i > 0 && outOrder.compare(eliminated.get(i - 1), p) == 0;
            p.setFinalRank(tie ? eliminated.get(i - 1).getFinalRank() : offset + i + 1);
        }

        offset += eliminated.size();
        for (RoomPlayer p : others) p.setFinalRank(offset + 1);

        roomPlayerRepository.saveAll(all);
    }

    /** PCV-13: số câu đúng liên tiếp (khi là bóng) để hồi sinh. */
    static final int REVIVE_STREAK = 3;
    /** PCV-13: câu cuối (0-based) còn hồi sinh được — câu 9; từ câu 10 là vùng nguy hiểm. */
    static final int LAST_REVIVE_INDEX = 8;

    /**
     * PCV-13 — chuỗi đúng của bóng sau một vòng: đúng +1, sai hoặc không trả lời về 0. Đủ 3 ở câu 1–9 và
     * chưa từng hồi sinh thì hồi sinh với 1 mạng (bỏ hạng tạm, bỏ lượt bị loại).
     */
    @Transactional
    public List<RevivedPlayerInfo> processGhosts(String roomId, String roundId, int questionIndex) {
        List<RoomPlayer> ghosts = roomPlayerRepository
                .findByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ELIMINATED);
        if (ghosts.isEmpty()) return List.of();
        Set<String> right = roomAnswerRepository.findByRoundId(roundId).stream()
                .filter(a -> a.isGhost() && Boolean.TRUE.equals(a.getIsCorrect()))
                .map(RoomAnswer::getUserId)
                .collect(Collectors.toSet());
        List<RevivedPlayerInfo> revived = new ArrayList<>();
        for (RoomPlayer g : ghosts) {
            int streak = right.contains(g.getUser().getId()) ? g.getGhostStreak() + 1 : 0;
            if (streak >= REVIVE_STREAK && questionIndex <= LAST_REVIVE_INDEX && !g.getRevived()) {
                g.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
                g.setLives(1);
                g.setRevived(true);
                g.setEliminatedRound(null);
                g.setFinalRank(null);
                g.setGhostStreak(0);
                revived.add(new RevivedPlayerInfo(g.getUser().getId(), g.getUsername()));
            } else {
                g.setGhostStreak(streak);
            }
        }
        roomPlayerRepository.saveAll(ghosts);
        return revived;
    }

    public static class RevivedPlayerInfo {
        public final String userId;
        public final String username;

        public RevivedPlayerInfo(String userId, String username) {
            this.userId = userId;
            this.username = username;
        }
    }

    /** Kết quả một vòng: ai bị loại, và có phải vòng ân xá (cả nhóm cùng sai) không. */
    public static class RoundOutcome {
        public final List<EliminatedPlayerInfo> eliminated;
        public final boolean amnesty;

        public RoundOutcome(List<EliminatedPlayerInfo> eliminated, boolean amnesty) {
            this.eliminated = eliminated;
            this.amnesty = amnesty;
        }

        static RoundOutcome none() {
            return new RoundOutcome(List.of(), false);
        }
    }

    public static class EliminatedPlayerInfo {
        public final String userId;
        public final String username;
        public final int rank;

        public EliminatedPlayerInfo(String userId, String username, int rank) {
            this.userId = userId;
            this.username = username;
            this.rank = rank;
        }
    }
}
