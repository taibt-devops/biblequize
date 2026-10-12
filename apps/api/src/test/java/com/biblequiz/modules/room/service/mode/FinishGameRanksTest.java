package com.biblequiz.modules.room.service.mode;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.RoomStateService;
import com.biblequiz.modules.room.service.SequentialScoringService;
import com.biblequiz.modules.room.service.SpeedRaceScoringService;
import com.biblequiz.modules.room.service.TeamScoringService;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-6 — Đua tốc độ, Chơi cùng nhau, Đội đấu đội đều ghi finalRank khi kết thúc. */
@ExtendWith(MockitoExtension.class)
class FinishGameRanksTest {

    @Mock private RoomWebSocketController ws;
    @Mock private RoomService roomService;
    @Mock private RoomStateService stateService;
    @Mock private RoomPlayerRepository playerRepository;
    @Mock private RoomRoundRepository roundRepository;

    private GameLoopContext ctx() {
        return new GameLoopContext("room-1", List.of(), 20, 5000, ws, roomService, stateService,
                playerRepository, roundRepository, (id, r) -> r, q -> java.util.Map.of());
    }

    private static RoomPlayer p(String id, int score, RoomPlayer.Team team) {
        User u = new User();
        u.setId(id);
        RoomPlayer rp = new RoomPlayer("rp-" + id, new Room(), u, id);
        rp.setScore(score);
        rp.setCorrectAnswers(score / 100);
        rp.setTotalAnswered(5);
        rp.setAverageReactionTime(3000.0);
        rp.setTeam(team);
        return rp;
    }

    @Test
    void speedRace_assignsRanksBeforeQuizEnd() {
        RoomPlayer a = p("a", 300, null), b = p("b", 700, null);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(a, b));

        new SpeedRaceStrategy(new SpeedRaceScoringService()).finishGame(ctx());

        assertEquals(1, b.getFinalRank());
        assertEquals(2, a.getFinalRank());
        var order = inOrder(playerRepository, ws);
        order.verify(playerRepository).saveAll(anyList());
        order.verify(ws).broadcastQuizEnd(eq("room-1"), any());
    }

    @Test
    void sequential_assignsRanks() {
        RoomPlayer a = p("a", 200, null), b = p("b", 100, null);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(a, b));

        new SequentialStrategy(mock(SequentialScoringService.class)).finishGame(ctx());

        assertEquals(1, a.getFinalRank());
        assertEquals(2, b.getFinalRank());
    }

    @Test
    void teams_winnersRank1_losersRank2_tieAllRank1() {
        TeamScoringService teamScoring = mock(TeamScoringService.class);
        RoomPlayer a1 = p("a1", 100, RoomPlayer.Team.A), a2 = p("a2", 900, RoomPlayer.Team.A);
        RoomPlayer b1 = p("b1", 800, RoomPlayer.Team.B), b2 = p("b2", 700, RoomPlayer.Team.B);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(a1, a2, b1, b2));
        when(teamScoring.determineWinnerWithTieBreak(eq("room-1"), anyInt(), anyInt()))
                .thenReturn(new TeamScoringService.TeamResult("B", "SCORE", new TeamScoringService.TeamScores(500, 750)));
        GameLoopContext c = ctx();
        c.setModeState(new int[]{0, 0});

        new TeamVsTeamStrategy(teamScoring, new SpeedRaceScoringService()).finishGame(c);

        assertEquals(1, b1.getFinalRank());
        assertEquals(1, b2.getFinalRank());
        assertEquals(2, a1.getFinalRank());
        assertEquals(2, a2.getFinalRank());

        when(teamScoring.determineWinnerWithTieBreak(eq("room-1"), anyInt(), anyInt()))
                .thenReturn(new TeamScoringService.TeamResult("TIE", "TIE", new TeamScoringService.TeamScores(500, 500)));
        new TeamVsTeamStrategy(teamScoring, new SpeedRaceScoringService()).finishGame(c);
        assertEquals(1, a1.getFinalRank());
        assertEquals(1, b2.getFinalRank());
    }
}
