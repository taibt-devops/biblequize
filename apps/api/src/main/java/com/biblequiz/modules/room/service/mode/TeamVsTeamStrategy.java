package com.biblequiz.modules.room.service.mode;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.SpeedRaceScoringService;
import com.biblequiz.modules.room.service.TeamScoringService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Team vs Team — team score totals each round, Perfect Round bonus, and a
 * QUIZ_END payload that carries the winner + both team scores.
 */
@Component
public class TeamVsTeamStrategy implements RoomModeStrategy {

    private static final Logger log = LoggerFactory.getLogger(TeamVsTeamStrategy.class);

    private final TeamScoringService teamScoringService;
    private final SpeedRaceScoringService speedRaceScoringService;

    /** PCV-22: đọc cờ Hội ý của phòng lúc bắt đầu trận (field injection — giữ constructor cũ cho test). */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.biblequiz.modules.room.repository.RoomRepository roomRepository;

    /** Trạng thái một trận Đội đấu đội (một luồng trận nên không cần đồng bộ). */
    static final class TeamState {
        /** Số lần cả đội đúng (thường) / cả đội cùng chọn đúng (Hội ý) — tie-break. */
        int perfectA, perfectB;
        /** PCV-22: chế độ Hội ý — điểm đội là tổng điểm các câu theo đáp án đa số. */
        boolean consensus;
        int totalA, totalB;
        TeamScoringService.ConsensusResult lastConsensus;
    }

    public TeamVsTeamStrategy(TeamScoringService teamScoringService,
                              SpeedRaceScoringService speedRaceScoringService) {
        this.teamScoringService = teamScoringService;
        this.speedRaceScoringService = speedRaceScoringService;
    }

    @Override
    public Room.RoomMode mode() {
        return Room.RoomMode.TEAM_VS_TEAM;
    }

    @Override
    public String displayName() {
        return "Team vs Team";
    }

    @Override
    public int calculateScore(boolean isCorrect, int timeLimitSeconds, int reactionTimeMs) {
        // Legacy quirk: individual TvT answers score with the Speed Race formula.
        return speedRaceScoringService.calculateScore(isCorrect, timeLimitSeconds, reactionTimeMs);
    }

    @Override
    public Comparator<RoomPlayer> leaderboardComparator() {
        return RoomService.ORDER_BY_SCORE_DESC;
    }

    @Override
    public boolean beforeLoop(GameLoopContext ctx) {
        // Per-run tally (perfect rounds, Hội ý totals) — feeds the end-game tie-break.
        // Scratch slot is per-game (one loop thread), so plain fields are safe here.
        TeamState state = new TeamState();
        state.consensus = roomRepository != null && roomRepository.findById(ctx.roomId)
                .map(com.biblequiz.modules.room.entity.Room::isTeamConsensus).orElse(false);
        ctx.setModeState(state);

        // Broadcast team assignments
        List<RoomPlayer> allPlayers = ctx.roomPlayerRepository.findByRoomId(ctx.roomId);
        List<WebSocketMessage.TeamAssignmentData.TeamPlayerInfo> teamInfo = allPlayers.stream()
                .map(p -> new WebSocketMessage.TeamAssignmentData.TeamPlayerInfo(
                        p.getUser().getId(), p.getUsername(),
                        p.getTeam() != null ? p.getTeam().name() : "A"))
                .collect(Collectors.toList());
        ctx.ws.broadcastTeamAssignment(ctx.roomId, teamInfo);
        return true;
    }

    /** PCV-22: Hội ý — đưa đáp án của mỗi đội vào ROUND_END (chấm ở {@link #afterRound}). */
    @Override
    public void decorateRoundEnd(GameLoopContext ctx, RoomRound round, com.biblequiz.modules.quiz.entity.Question question,
                                 WebSocketMessage.RoundEndData data) {
        TeamState state = ctx.modeState();
        if (state == null || !state.consensus) return;
        int correct = question.getCorrectAnswer() != null && !question.getCorrectAnswer().isEmpty()
                ? question.getCorrectAnswer().get(0) : -1;
        TeamScoringService.ConsensusResult r = teamScoringService.consensus(ctx.roomId, round.getId(), correct);
        state.lastConsensus = r;
        java.util.Map<String, Integer> answers = new java.util.HashMap<>();
        answers.put("A", r.answerA);
        answers.put("B", r.answerB);
        data.teamAnswers = answers;
    }

    @Override
    public boolean afterRound(GameLoopContext ctx, RoomRound round, int questionIndex) {
        TeamState consensusState = ctx.modeState();
        if (consensusState != null && consensusState.consensus) {
            TeamScoringService.ConsensusResult r = consensusState.lastConsensus;
            consensusState.lastConsensus = null;
            if (r != null) {
                consensusState.totalA += r.pointsA;
                consensusState.totalB += r.pointsB;
                if (r.unanimousA) consensusState.perfectA++;
                if (r.unanimousB) consensusState.perfectB++;
                if (r.unanimousA || r.unanimousB) ctx.ws.broadcastPerfectRound(ctx.roomId, r.unanimousA, r.unanimousB);
            }
            ctx.ws.broadcastTeamScoreUpdate(ctx.roomId, consensusState.totalA, consensusState.totalB);
            return false;
        }
        // Perfect Round check
        TeamScoringService.PerfectRoundResult perfect =
                teamScoringService.processPerfectRound(ctx.roomId, round.getId());
        if (perfect.teamAPerfect || perfect.teamBPerfect) {
            ctx.ws.broadcastPerfectRound(ctx.roomId, perfect.teamAPerfect, perfect.teamBPerfect);
        }

        // Accumulate per-team perfect-round counts for the end-game tie-break.
        TeamState state = ctx.modeState();
        if (state != null) {
            if (perfect.teamAPerfect) state.perfectA++;
            if (perfect.teamBPerfect) state.perfectB++;
        }

        // PCV-14: điểm đội = trung bình thành viên còn trong trận + 50 × số lần cả đội đúng.
        TeamScoringService.TeamScores scores = state != null
                ? teamScoringService.calculateTeamScores(ctx.roomId, state.perfectA, state.perfectB)
                : teamScoringService.calculateTeamScores(ctx.roomId);
        ctx.ws.broadcastTeamScoreUpdate(ctx.roomId, scores.teamA, scores.teamB);
        return false;
    }

    /** PCV-22: Hội ý — tổng điểm câu → số lần cả đội cùng chọn đúng → đội nhanh hơn → hòa thật. */
    private TeamScoringService.TeamResult consensusWinner(GameLoopContext ctx, TeamState s) {
        TeamScoringService.TeamScores scores = new TeamScoringService.TeamScores(s.totalA, s.totalB);
        if (s.totalA != s.totalB) return new TeamScoringService.TeamResult(s.totalA > s.totalB ? "A" : "B", "SCORE", scores);
        if (s.perfectA != s.perfectB) return new TeamScoringService.TeamResult(s.perfectA > s.perfectB ? "A" : "B", "PERFECT_ROUNDS", scores);
        String faster = teamScoringService.fasterTeam(ctx.roomId);
        return faster != null ? new TeamScoringService.TeamResult(faster, "SPEED", scores)
                : new TeamScoringService.TeamResult("TIE", "TIE", scores);
    }

    @Override
    public void finishGame(GameLoopContext ctx) {
        // Resolve the winner with the full tie-break chain: total score →
        // perfect-round count → aggregate response time → genuine TIE.
        TeamState state = ctx.modeState();
        int perfectA = state != null ? state.perfectA : 0;
        int perfectB = state != null ? state.perfectB : 0;
        TeamScoringService.TeamResult result = state != null && state.consensus
                ? consensusWinner(ctx, state)
                : teamScoringService.determineWinnerWithTieBreak(ctx.roomId, perfectA, perfectB);
        // PCV-6: hạng theo kết quả đội — đội thắng hạng 1, đội thua hạng 2; hòa thật thì cả hai hạng 1.
        List<RoomPlayer> players = ctx.roomPlayerRepository.findByRoomId(ctx.roomId);
        for (RoomPlayer p : players) {
            boolean won = "TIE".equals(result.winningTeam)
                    || (p.getTeam() != null && p.getTeam().name().equals(result.winningTeam));
            p.setFinalRank(won ? 1 : 2);
        }
        ctx.roomPlayerRepository.saveAll(players);

        List<RoomService.LeaderboardEntryDTO> finalResults =
                ctx.roomService.buildLeaderboard(ctx.roomId, leaderboardComparator());
        Map<String, Object> endData = Map.of(
                "teamWinner", result.winningTeam,
                "scoreA", result.scores.teamA,
                "scoreB", result.scores.teamB,
                "leaderboard", finalResults);

        ctx.roomService.endRoom(ctx.roomId);
        ctx.ws.broadcastQuizEnd(ctx.roomId, endData);
        log.info("Team vs Team kết thúc cho phòng {} | winner=Team{} ({})",
                ctx.roomId, result.winningTeam, result.reason);
    }
}
