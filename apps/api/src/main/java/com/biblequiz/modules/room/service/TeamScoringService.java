package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Xử lý điểm số cho chế độ Team vs Team.
 * - Cộng điểm theo đội
 * - Perfect Round bonus (+50 nếu cả đội đúng hết)
 * - Xác định đội thắng
 */
@Service
public class TeamScoringService {

    @Autowired private RoomPlayerRepository roomPlayerRepository;
    @Autowired private RoomAnswerRepository roomAnswerRepository;

    /** PCV-14: thưởng mỗi lần cả đội cùng đúng — cộng cho điểm đội, không cộng vào điểm cá nhân. */
    static final int ALL_CORRECT_BONUS = 50;

    /**
     * PCV-14 (design §2.3) — điểm đội = round(trung bình điểm thành viên còn trong trận) + 50 × số lần cả
     * đội đúng. Lấy trung bình để đội đông người không thắng chỉ vì đông; cả đội đã rời thì lấy trung bình
     * của tất cả thành viên.
     */
    public TeamScores calculateTeamScores(String roomId, int allCorrectA, int allCorrectB) {
        List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);
        return new TeamScores(teamScore(players, RoomPlayer.Team.A, allCorrectA),
                teamScore(players, RoomPlayer.Team.B, allCorrectB));
    }

    /** Không tính lần cả đội đúng (mã gọi cũ). */
    public TeamScores calculateTeamScores(String roomId) {
        return calculateTeamScores(roomId, 0, 0);
    }

    static int teamScore(List<RoomPlayer> players, RoomPlayer.Team team, int allCorrect) {
        List<RoomPlayer> members = players.stream().filter(p -> p.getTeam() == team).toList();
        if (members.isEmpty()) return 0;
        List<RoomPlayer> active = members.stream()
                .filter(p -> p.getPlayerStatus() == RoomPlayer.PlayerStatus.ACTIVE).toList();
        List<RoomPlayer> base = active.isEmpty() ? members : active;
        double avg = base.stream().mapToInt(p -> p.getScore() != null ? p.getScore() : 0).average().orElse(0);
        return (int) Math.round(avg) + ALL_CORRECT_BONUS * allCorrect;
    }

    /**
     * PCV-14 — "cả đội đúng": mọi thành viên còn trong trận (ACTIVE) đều đúng, cần ít nhất 1 người.
     * Không cộng điểm cá nhân; thưởng tính ở điểm đội ({@link #calculateTeamScores(String, int, int)}).
     */
    @Transactional
    public PerfectRoundResult processPerfectRound(String roomId, String roundId) {
        List<RoomPlayer> playersA = roomPlayerRepository.findByRoomIdAndTeam(roomId, RoomPlayer.Team.A);
        List<RoomPlayer> playersB = roomPlayerRepository.findByRoomIdAndTeam(roomId, RoomPlayer.Team.B);

        List<RoomAnswer> roundAnswers = roomAnswerRepository.findByRoundId(roundId);
        Map<String, Boolean> correctMap = roundAnswers.stream()
                .collect(Collectors.toMap(RoomAnswer::getUserId, a -> Boolean.TRUE.equals(a.getIsCorrect())));

        boolean perfA = allCorrect(activeOnly(playersA), correctMap);
        boolean perfB = allCorrect(activeOnly(playersB), correctMap);
        return new PerfectRoundResult(perfA, perfB);
    }

    private static List<RoomPlayer> activeOnly(List<RoomPlayer> players) {
        return players.stream().filter(p -> p.getPlayerStatus() == RoomPlayer.PlayerStatus.ACTIVE).toList();
    }

    private boolean allCorrect(List<RoomPlayer> players, Map<String, Boolean> correctMap) {
        if (players.isEmpty()) return false;
        for (RoomPlayer p : players) {
            if (!Boolean.TRUE.equals(correctMap.get(p.getUser().getId()))) return false;
        }
        return true;
    }

    /** Xác định đội thắng: "A", "B", hoặc "TIE" */
    public String determineWinner(TeamScores scores) {
        if (scores.teamA > scores.teamB) return "A";
        if (scores.teamB > scores.teamA) return "B";
        return "TIE";
    }

    /**
     * FIX: Tie-break khi 2 đội cùng điểm.
     * 1. So perfectRoundCount → nhiều hơn thắng
     * 2. So totalResponseMs → nhanh hơn thắng
     * 3. Vẫn bằng → "TIE" thật
     */
    public TeamResult determineWinnerWithTieBreak(String roomId, int perfectRoundsA, int perfectRoundsB) {
        TeamScores scores = calculateTeamScores(roomId, perfectRoundsA, perfectRoundsB);

        if (scores.teamA > scores.teamB) return new TeamResult("A", "SCORE", scores);
        if (scores.teamB > scores.teamA) return new TeamResult("B", "SCORE", scores);

        // Tie → compare perfect rounds
        if (perfectRoundsA > perfectRoundsB) return new TeamResult("A", "PERFECT_ROUNDS", scores);
        if (perfectRoundsB > perfectRoundsA) return new TeamResult("B", "PERFECT_ROUNDS", scores);

        // PCV-14: bằng nhau nữa → thời gian trả lời trung bình của đội (trung bình của các thành viên
        // đã trả lời ít nhất một câu) — nhanh hơn thắng.
        String faster = fasterTeam(roomId);
        if (faster != null) return new TeamResult(faster, "SPEED", scores);

        return new TeamResult("TIE", "TIE", scores);
    }

    /** PCV-14/22: đội trả lời nhanh hơn (trung bình của thành viên đã trả lời); null nếu không so được. */
    public String fasterTeam(String roomId) {
        List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);
        java.util.OptionalDouble msA = teamAverageMs(players, RoomPlayer.Team.A);
        java.util.OptionalDouble msB = teamAverageMs(players, RoomPlayer.Team.B);
        if (msA.isPresent() && msB.isPresent() && msA.getAsDouble() != msB.getAsDouble()) {
            return msA.getAsDouble() < msB.getAsDouble() ? "A" : "B";
        }
        return null;
    }

    private static java.util.OptionalDouble teamAverageMs(List<RoomPlayer> players, RoomPlayer.Team team) {
        return players.stream()
                .filter(p -> p.getTeam() == team && p.getTotalAnswered() != null && p.getTotalAnswered() > 0)
                .mapToDouble(p -> p.getAverageReactionTime() != null ? p.getAverageReactionTime() : 0)
                .average();
    }

    /** PCV-22: kết quả Hội ý một câu cho hai đội. */
    public static class ConsensusResult {
        public final Integer answerA, answerB;
        public final boolean unanimousA, unanimousB;
        public final int pointsA, pointsB;

        public ConsensusResult(Integer answerA, boolean unanimousA, int pointsA, Integer answerB, boolean unanimousB, int pointsB) {
            this.answerA = answerA; this.unanimousA = unanimousA; this.pointsA = pointsA;
            this.answerB = answerB; this.unanimousB = unanimousB; this.pointsB = pointsB;
        }
    }

    static final int CONSENSUS_CORRECT = 100;
    static final int CONSENSUS_UNANIMOUS_BONUS = 50;

    /**
     * PCV-22 — Hội ý (design §3.2): đáp án của đội = phương án nhiều phiếu nhất trong các thành viên còn
     * trong trận; hòa thì lấy phương án có phiếu sớm nhất. Đúng 100; mọi thành viên còn trong trận cùng
     * chọn đúng phương án thì +50.
     */
    public ConsensusResult consensus(String roomId, String roundId, int correctIndex) {
        List<RoomPlayer> roster = roomPlayerRepository.findByRoomId(roomId);
        List<RoomAnswer> answers = roomAnswerRepository.findByRoundId(roundId);
        Object[] a = teamConsensus(roster, answers, RoomPlayer.Team.A, correctIndex);
        Object[] b = teamConsensus(roster, answers, RoomPlayer.Team.B, correctIndex);
        return new ConsensusResult((Integer) a[0], (Boolean) a[1], (Integer) a[2], (Integer) b[0], (Boolean) b[1], (Integer) b[2]);
    }

    private static Object[] teamConsensus(List<RoomPlayer> roster, List<RoomAnswer> answers, RoomPlayer.Team team, int correctIndex) {
        java.util.Set<String> members = roster.stream()
                .filter(p -> p.getTeam() == team && p.getPlayerStatus() == RoomPlayer.PlayerStatus.ACTIVE)
                .map(p -> p.getUser().getId())
                .collect(Collectors.toSet());
        List<RoomAnswer> votes = answers.stream()
                .filter(x -> members.contains(x.getUserId()) && x.getAnswerIndex() != null)
                .toList();
        if (votes.isEmpty()) return new Object[]{null, false, 0};
        Map<Integer, Long> count = votes.stream().collect(Collectors.groupingBy(RoomAnswer::getAnswerIndex, Collectors.counting()));
        Map<Integer, java.time.LocalDateTime> first = new java.util.HashMap<>();
        for (RoomAnswer v : votes) {
            java.time.LocalDateTime at = v.getAnsweredAt() != null ? v.getAnsweredAt() : java.time.LocalDateTime.MAX;
            first.merge(v.getAnswerIndex(), at, (x, y) -> x.isBefore(y) ? x : y);
        }
        long top = java.util.Collections.max(count.values());
        Integer answer = count.entrySet().stream()
                .filter(e -> e.getValue() == top)
                .map(Map.Entry::getKey)
                .min(java.util.Comparator.comparing(first::get))
                .orElse(null);
        boolean correct = answer != null && answer == correctIndex;
        boolean unanimous = correct && votes.size() == members.size()
                && votes.stream().allMatch(v -> v.getAnswerIndex() == correctIndex);
        int points = correct ? CONSENSUS_CORRECT + (unanimous ? CONSENSUS_UNANIMOUS_BONUS : 0) : 0;
        return new Object[]{answer, unanimous, points};
    }

    public static class TeamResult {
        public final String winningTeam; // "A", "B", or "TIE"
        public final String reason;      // "SCORE", "PERFECT_ROUNDS", "SPEED", "TIE"
        public final TeamScores scores;

        public TeamResult(String winningTeam, String reason, TeamScores scores) {
            this.winningTeam = winningTeam;
            this.reason = reason;
            this.scores = scores;
        }
    }

    // ── DTOs ──

    public static class TeamScores {
        public final int teamA;
        public final int teamB;

        public TeamScores(int teamA, int teamB) {
            this.teamA = teamA;
            this.teamB = teamB;
        }
    }

    public static class PerfectRoundResult {
        public final boolean teamAPerfect;
        public final boolean teamBPerfect;

        public PerfectRoundResult(boolean teamAPerfect, boolean teamBPerfect) {
            this.teamAPerfect = teamAPerfect;
            this.teamBPerfect = teamBPerfect;
        }
    }
}
