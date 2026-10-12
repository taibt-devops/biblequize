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
        // Per-run perfect-round tally [teamA, teamB] — feeds the end-game
        // tie-break. Scratch slot is per-game (one loop thread), so a plain
        // int[] is safe here.
        ctx.setModeState(new int[]{0, 0});

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

    @Override
    public boolean afterRound(GameLoopContext ctx, RoomRound round, int questionIndex) {
        // Perfect Round check
        TeamScoringService.PerfectRoundResult perfect =
                teamScoringService.processPerfectRound(ctx.roomId, round.getId());
        if (perfect.teamAPerfect || perfect.teamBPerfect) {
            ctx.ws.broadcastPerfectRound(ctx.roomId, perfect.teamAPerfect, perfect.teamBPerfect);
        }

        // Accumulate per-team perfect-round counts for the end-game tie-break.
        int[] perfectCounts = ctx.modeState();
        if (perfectCounts != null) {
            if (perfect.teamAPerfect) perfectCounts[0]++;
            if (perfect.teamBPerfect) perfectCounts[1]++;
        }

        // PCV-14: điểm đội = trung bình thành viên còn trong trận + 50 × số lần cả đội đúng.
        TeamScoringService.TeamScores scores = perfectCounts != null
                ? teamScoringService.calculateTeamScores(ctx.roomId, perfectCounts[0], perfectCounts[1])
                : teamScoringService.calculateTeamScores(ctx.roomId);
        ctx.ws.broadcastTeamScoreUpdate(ctx.roomId, scores.teamA, scores.teamB);
        return false;
    }

    @Override
    public void finishGame(GameLoopContext ctx) {
        // Resolve the winner with the full tie-break chain: total score →
        // perfect-round count → aggregate response time → genuine TIE.
        int[] perfectCounts = ctx.modeState();
        int perfectA = perfectCounts != null ? perfectCounts[0] : 0;
        int perfectB = perfectCounts != null ? perfectCounts[1] : 0;
        TeamScoringService.TeamResult result =
                teamScoringService.determineWinnerWithTieBreak(ctx.roomId, perfectA, perfectB);
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
