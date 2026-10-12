package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Quản lý luồng Đấu vương (Sudden Death) 1v1 — Phòng chơi v2 (design §2.4):
 * - hàng chờ xáo ngẫu nhiên lúc bắt đầu; hai người đầu hàng đấu trước;
 * - một đúng một sai → phân thắng thua; cả hai đúng → nhanh hơn ≥ 0,2 giây thắng;
 *   cả hai sai hoặc chênh < 0,2 giây → đấu tiếp; hòa 3 lần → vua giữ ngai;
 * - người thắng giữ/giành ngai, người thua về CUỐI hàng (xoay vòng);
 * - kết thúc khi mọi người đã đấu ≥ 1 trận và vua có chuỗi ≥ 3 (≤ 5 người) hoặc 4, hoặc hết số câu;
 * - xếp hạng: trận thắng → chuỗi dài nhất → câu đúng → tốc độ.
 */
@Service
public class SuddenDeathMatchService {

    private static final int MAX_CONTINUES = 3;
    private static final long CLOSE_THRESHOLD_MS = 200;

    @Autowired private RoomPlayerRepository roomPlayerRepository;
    @Autowired private RoomAnswerRepository roomAnswerRepository;
    @Autowired private RoomStateService roomStateService;

    // Số câu đấu thêm của cặp hiện tại. Nhiều trận chạy song song trên các luồng room-game-* nên phải
    // là ConcurrentHashMap (HashMap cũ có thể hỏng khi ghi đồng thời); xoá khi trận kết thúc.
    private final Map<String, Integer> continueCountMap = new java.util.concurrent.ConcurrentHashMap<>();

    /** PCV-15: chuỗi của vua để kết thúc sớm: 3 khi ≤ 5 người, 4 khi đông hơn. */
    static final int SMALL_ROOM = 5;
    static final int TARGET_SMALL = 3;
    static final int TARGET_LARGE = 4;

    /**
     * Khởi tạo hàng chờ từ tất cả players (sắp xếp theo thứ tự vào phòng).
     * Tất cả ban đầu là SPECTATOR.
     */
    @Transactional
    public void initializeQueue(String roomId) {
        List<RoomPlayer> players = new java.util.ArrayList<>(roomPlayerRepository.findByRoomId(roomId));
        // PCV-15: xáo ngẫu nhiên — không để người vào phòng sớm luôn được đấu trước.
        java.util.Collections.shuffle(players);

        players.forEach(p -> {
            p.setPlayerStatus(RoomPlayer.PlayerStatus.SPECTATOR);
            p.setWinningStreak(0);
            p.setMatchesWon(0);
            p.setBestStreak(0);
            p.setMatchesPlayed(0);
        });
        roomPlayerRepository.saveAll(players);

        List<String> queue = players.stream()
                .map(p -> p.getUser().getId())
                .collect(Collectors.toList());
        roomStateService.setSdQueue(roomId, queue);
    }

    /**
     * Bắt đầu trận tiếp theo.
     * - Lần đầu: lấy 2 người đầu từ queue
     * - Trận tiếp: champion giữ, lấy tiếp người từ queue
     * @return MatchInfo nếu còn có thể thi đấu, null nếu kết thúc game
     */
    @Transactional
    public MatchInfo startNextMatch(String roomId) {
        String champion = roomStateService.getSdChampion(roomId);
        List<String> queue = roomStateService.getSdQueue(roomId);

        if (queue == null) queue = new java.util.ArrayList<>();
        if (champion == null) {
            // Trận đầu tiên
            String first = popPlayable(roomId, queue);
            String challenger = popPlayable(roomId, queue);
            roomStateService.setSdQueue(roomId, queue);
            if (first == null || challenger == null) return null;
            champion = first;
            roomStateService.setSdChampion(roomId, champion);
            roomStateService.setSdChallenger(roomId, challenger);
        } else {
            // Trận tiếp: champion giữ ghế — trừ khi vua đã rời phòng: người kế trong hàng lên ngôi.
            if (isLeft(roomId, champion)) {
                String next = popPlayable(roomId, queue);
                if (next == null) {
                    roomStateService.setSdQueue(roomId, queue);
                    return null;
                }
                champion = next;
                roomStateService.setSdChampion(roomId, champion);
            }
            String challenger = popPlayable(roomId, queue);
            roomStateService.setSdQueue(roomId, queue);
            if (challenger == null) return null;
            roomStateService.setSdChallenger(roomId, challenger);
        }

        String challengerId = roomStateService.getSdChallenger(roomId);
        setStatus(roomId, champion, RoomPlayer.PlayerStatus.ACTIVE);
        setStatus(roomId, challengerId, RoomPlayer.PlayerStatus.ACTIVE);
        continueCountMap.put(roomId, 0); // reset continues for new matchup

        String championName = getUsername(roomId, champion);
        String challengerName = getUsername(roomId, challengerId);
        int championStreak = getStreak(roomId, champion);
        // PCV-16: đánh số trận và mở cửa sổ đoán cho khán giả (đóng khi câu đầu của trận bắt đầu).
        int matchNo = roomStateService.nextSdMatchNo(roomId);
        roomStateService.openSdPredictions(roomId, matchNo);

        return new MatchInfo(champion, championName, championStreak, challengerId, challengerName, matchNo);
    }

    /**
     * Xử lý kết quả round cho trận hiện tại.
     * @return MatchResult với outcome CONTINUE, MATCH_ENDED, hoặc NO_MATCH
     */
    @Transactional
    public MatchResult processRound(String roomId, String roundId) {
        String champion = roomStateService.getSdChampion(roomId);
        String challenger = roomStateService.getSdChallenger(roomId);

        if (champion == null || challenger == null) {
            return new MatchResult(MatchOutcome.NO_MATCH, null, null);
        }

        // Một bên đã rời phòng: bên đó thua ngay (không bắt người còn lại đấu với ghế trống).
        boolean champLeft = isLeft(roomId, champion);
        boolean challLeft = isLeft(roomId, challenger);
        if (champLeft || challLeft) {
            return champLeft && !challLeft
                    ? resolveMatchEnd(roomId, challenger, champion)
                    : resolveMatchEnd(roomId, champion, challenger);
        }

        boolean champCorrect = getIsCorrect(roundId, champion);
        boolean challCorrect = getIsCorrect(roundId, challenger);

        if (champCorrect && challCorrect) {
            // Cả 2 đúng → so elapsedMs
            int champMs = getResponseMs(roundId, champion);
            int challMs = getResponseMs(roundId, challenger);
            long diff = Math.abs((long) champMs - challMs);
            if (diff >= CLOSE_THRESHOLD_MS) {
                // Faster wins
                String winnerId = champMs < challMs ? champion : challenger;
                String loserId = winnerId.equals(champion) ? challenger : champion;
                return resolveMatchEnd(roomId, winnerId, loserId);
            }
            // Too close → check max continues
            return handleContinue(roomId, champion);
        }

        if (!champCorrect && !challCorrect) {
            // Cả 2 sai → check max continues
            return handleContinue(roomId, champion);
        }

        // One correct, one wrong → winner determined
        String winnerId = champCorrect ? champion : challenger;
        String loserId = champCorrect ? challenger : champion;
        return resolveMatchEnd(roomId, winnerId, loserId);
    }

    /**
     * PCV-15 — hạng cuối: số trận thắng → chuỗi thắng dài nhất → số câu đúng → trả lời nhanh hơn
     * (bằng hệt thì đồng hạng); người đã bỏ trận xếp cuối. Trước đây xếp theo chuỗi hiện tại — người
     * thua về 0 nên hạng gần như ngẫu nhiên.
     */
    @Transactional
    public void assignFinalRanks(String roomId) {
        List<RoomPlayer> all = roomPlayerRepository.findByRoomId(roomId);
        List<RoomPlayer> ranked = new java.util.ArrayList<>();
        List<RoomPlayer> left = new java.util.ArrayList<>();
        for (RoomPlayer p : all) {
            if (p.getPlayerStatus() == RoomPlayer.PlayerStatus.LEFT) left.add(p); else ranked.add(p);
        }
        Comparator<RoomPlayer> order = Comparator
                .comparingInt((RoomPlayer p) -> p.getMatchesWon()).reversed()
                .thenComparing(Comparator.comparingInt((RoomPlayer p) -> p.getBestStreak()).reversed())
                .thenComparing(Comparator.comparingInt((RoomPlayer p) -> p.getCorrectAnswers() != null ? p.getCorrectAnswers() : 0).reversed())
                .thenComparingDouble(p -> p.getAverageReactionTime() != null && p.getTotalAnswered() != null && p.getTotalAnswered() > 0
                        ? p.getAverageReactionTime() : Double.MAX_VALUE);
        ranked.sort(order);
        for (int i = 0; i < ranked.size(); i++) {
            RoomPlayer p = ranked.get(i);
            boolean tie = i > 0 && order.compare(ranked.get(i - 1), p) == 0;
            p.setFinalRank(tie ? ranked.get(i - 1).getFinalRank() : i + 1);
        }
        for (RoomPlayer p : left) p.setFinalRank(ranked.size() + 1);
        roomPlayerRepository.saveAll(all);
        continueCountMap.remove(roomId);
    }

    /**
     * PCV-15 — sau mỗi trận: dừng khi mọi người (trừ người đã bỏ trận) đã đấu ít nhất một trận và vua có
     * chuỗi ≥ 3 (phòng ≤ 5 người) hoặc ≥ 4. Còn dưới 2 người chơi được thì cũng dừng.
     */
    public boolean shouldEndAfterMatch(String roomId) {
        List<RoomPlayer> playable = roomPlayerRepository.findByRoomId(roomId).stream()
                .filter(p -> p.getPlayerStatus() != RoomPlayer.PlayerStatus.LEFT)
                .toList();
        if (playable.size() < 2) return true;
        boolean everyonePlayed = playable.stream().allMatch(p -> p.getMatchesPlayed() >= 1);
        String champion = roomStateService.getSdChampion(roomId);
        int streak = champion == null ? 0 : getStreak(roomId, champion);
        int target = playable.size() <= SMALL_ROOM ? TARGET_SMALL : TARGET_LARGE;
        return everyonePlayed && streak >= target;
    }

    public boolean hasNextChallenger(String roomId) {
        List<String> queue = roomStateService.getSdQueue(roomId);
        return queue != null && !queue.isEmpty();
    }

    public int getQueueSize(String roomId) {
        List<String> queue = roomStateService.getSdQueue(roomId);
        return queue != null ? queue.size() : 0;
    }

    private MatchResult handleContinue(String roomId, String champion) {
        int count = continueCountMap.getOrDefault(roomId, 0) + 1;
        continueCountMap.put(roomId, count);
        if (count >= MAX_CONTINUES) {
            // Champion advantage: keeps throne after max continues
            return resolveMatchEnd(roomId, champion, roomStateService.getSdChallenger(roomId));
        }
        return new MatchResult(MatchOutcome.CONTINUE, null, null);
    }

    private MatchResult resolveMatchEnd(String roomId, String winnerId, String loserId) {
        roomPlayerRepository.findByRoomIdAndUserId(roomId, winnerId).ifPresent(p -> {
            p.setWinningStreak(p.getWinningStreak() + 1);
            // PCV-15: thống kê xếp hạng
            p.setMatchesWon(p.getMatchesWon() + 1);
            p.setMatchesPlayed(p.getMatchesPlayed() + 1);
            p.setBestStreak(Math.max(p.getBestStreak(), p.getWinningStreak()));
            if (p.getPlayerStatus() != RoomPlayer.PlayerStatus.LEFT) p.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
            roomPlayerRepository.save(p);
        });
        boolean[] loserStillHere = { false };
        roomPlayerRepository.findByRoomIdAndUserId(roomId, loserId).ifPresent(p -> {
            p.setWinningStreak(0);
            p.setMatchesPlayed(p.getMatchesPlayed() + 1);
            boolean left = p.getPlayerStatus() == RoomPlayer.PlayerStatus.LEFT;
            if (!left) p.setPlayerStatus(RoomPlayer.PlayerStatus.SPECTATOR);
            loserStillHere[0] = !left;
            roomPlayerRepository.save(p);
        });
        // PCV-15: người thua về cuối hàng chờ để được đấu lại.
        if (loserStillHere[0]) {
            List<String> queue = roomStateService.getSdQueue(roomId);
            List<String> next = queue != null ? new java.util.ArrayList<>(queue) : new java.util.ArrayList<>();
            next.add(loserId);
            roomStateService.setSdQueue(roomId, next);
        }
        String winnerName = getUsername(roomId, winnerId);
        String loserName = getUsername(roomId, loserId);
        int newStreak = getStreak(roomId, winnerId);
        roomStateService.setSdChampion(roomId, winnerId);
        roomStateService.clearSdChallenger(roomId);
        return new MatchResult(MatchOutcome.MATCH_ENDED,
                new PlayerRef(winnerId, winnerName, newStreak),
                new PlayerRef(loserId, loserName, 0));
    }

    private int getResponseMs(String roundId, String userId) {
        return roomAnswerRepository.findByRoundIdAndUserId(roundId, userId)
                .map(a -> a.getResponseMs() != null ? a.getResponseMs() : 10000)
                .orElse(10000); // timeout = 10s
    }

    // ── PCV-16: khán giả đoán ──

    /**
     * Ghi phiếu đoán của khán giả cho trận {@code matchNo}. Nhận khi: cửa sổ đoán của đúng trận đó còn mở,
     * người đoán đang xem (SPECTATOR, không phải một trong hai người đấu), và phiếu chọn một trong hai
     * người đang đấu. Đoán lại thì thay phiếu cũ.
     */
    public boolean recordPrediction(String roomId, String userId, int matchNo, String pickUserId) {
        Integer open = roomStateService.getOpenSdPredictionMatch(roomId);
        if (open == null || open != matchNo) return false;
        String champion = roomStateService.getSdChampion(roomId);
        String challenger = roomStateService.getSdChallenger(roomId);
        if (pickUserId == null || !(pickUserId.equals(champion) || pickUserId.equals(challenger))) return false;
        if (userId.equals(champion) || userId.equals(challenger)) return false;
        boolean spectator = roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                .map(p -> p.getPlayerStatus() == RoomPlayer.PlayerStatus.SPECTATOR)
                .orElse(false);
        if (!spectator) return false;
        roomStateService.putSdPrediction(roomId, matchNo, userId, pickUserId);
        return true;
    }

    /** Đóng cửa sổ đoán — gọi ngay trước câu hỏi đầu tiên của trận. */
    public void closePredictions(String roomId) {
        roomStateService.closeSdPredictions(roomId);
    }

    public int currentMatchNo(String roomId) {
        return roomStateService.currentSdMatchNo(roomId);
    }

    /** Hết trận: ai đoán đúng người thắng được +1 điểm đoán. @return id những người đoán đúng. */
    @Transactional
    public List<String> settlePredictions(String roomId, int matchNo, String winnerId) {
        List<String> correct = new java.util.ArrayList<>();
        roomStateService.getSdPredictions(roomId, matchNo).forEach((userId, pick) -> {
            if (!pick.equals(winnerId)) return;
            roomPlayerRepository.findByRoomIdAndUserId(roomId, userId).ifPresent(p -> {
                p.setPredictionPoints(p.getPredictionPoints() + 1);
                roomPlayerRepository.save(p);
                correct.add(userId);
            });
        });
        return correct;
    }

    // ── Helpers ──

    /** Lấy người kế tiếp còn chơi được (bỏ qua người đã rời phòng/bỏ trận). */
    private String popPlayable(String roomId, List<String> queue) {
        while (!queue.isEmpty()) {
            String id = queue.remove(0);
            boolean playable = roomPlayerRepository.findByRoomIdAndUserId(roomId, id)
                    .map(p -> p.getPlayerStatus() != RoomPlayer.PlayerStatus.LEFT)
                    .orElse(false);
            if (playable) return id;
        }
        return null;
    }

    /** Đổi trạng thái người đấu — người đã rời phòng (LEFT) giữ nguyên, không bao giờ quay lại ACTIVE. */
    private void setStatus(String roomId, String userId, RoomPlayer.PlayerStatus status) {
        roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                .filter(p -> p.getPlayerStatus() != RoomPlayer.PlayerStatus.LEFT)
                .ifPresent(p -> { p.setPlayerStatus(status); roomPlayerRepository.save(p); });
    }

    /** Người đấu đã rời phòng (giữa trận hàng người chơi chỉ chuyển LEFT, không bị xóa). */
    private boolean isLeft(String roomId, String userId) {
        return roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                .map(p -> p.getPlayerStatus() == RoomPlayer.PlayerStatus.LEFT)
                .orElse(false);
    }

    private boolean getIsCorrect(String roundId, String userId) {
        return roomAnswerRepository.findByRoundIdAndUserId(roundId, userId)
                .map(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                .orElse(false);
    }

    private String getUsername(String roomId, String userId) {
        return roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                .map(RoomPlayer::getUsername).orElse("Unknown");
    }

    private int getStreak(String roomId, String userId) {
        return roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                .map(RoomPlayer::getWinningStreak).orElse(0);
    }

    // ── DTOs ──

    public static class MatchInfo {
        public final String championId;
        public final String championName;
        public final int championStreak;
        public final String challengerId;
        public final String challengerName;
        /** PCV-16: số thứ tự trận (1, 2, …) — khán giả đoán theo số này. */
        public final int matchNo;

        public MatchInfo(String championId, String championName, int championStreak,
                         String challengerId, String challengerName) {
            this(championId, championName, championStreak, challengerId, challengerName, 0);
        }

        public MatchInfo(String championId, String championName, int championStreak,
                         String challengerId, String challengerName, int matchNo) {
            this.championId = championId;
            this.championName = championName;
            this.championStreak = championStreak;
            this.challengerId = challengerId;
            this.challengerName = challengerName;
            this.matchNo = matchNo;
        }
    }

    public enum MatchOutcome { CONTINUE, MATCH_ENDED, NO_MATCH }

    public static class MatchResult {
        public final MatchOutcome outcome;
        public final PlayerRef winner;
        public final PlayerRef loser;

        public MatchResult(MatchOutcome outcome, PlayerRef winner, PlayerRef loser) {
            this.outcome = outcome;
            this.winner = winner;
            this.loser = loser;
        }
    }

    public static class PlayerRef {
        public final String userId;
        public final String username;
        public final int streak;

        public PlayerRef(String userId, String username, int streak) {
            this.userId = userId;
            this.username = username;
            this.streak = streak;
        }
    }
}
