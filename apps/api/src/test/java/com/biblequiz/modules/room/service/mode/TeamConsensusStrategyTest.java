package com.biblequiz.modules.room.service.mode;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.RoomStateService;
import com.biblequiz.modules.room.service.SpeedRaceScoringService;
import com.biblequiz.modules.room.service.TeamScoringService;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-22 — Đội đấu đội chế độ Hội ý: ROUND_END có đáp án hai đội, điểm đội là tổng các câu. */
@ExtendWith(MockitoExtension.class)
class TeamConsensusStrategyTest {

    @Mock private RoomWebSocketController ws;
    @Mock private RoomService roomService;
    @Mock private RoomStateService stateService;
    @Mock private RoomPlayerRepository playerRepository;
    @Mock private RoomRoundRepository roundRepository;
    @Mock private TeamScoringService teamScoring;

    private TeamVsTeamStrategy strategy;
    private GameLoopContext ctx;
    private final Question q = new Question();
    private final RoomRound round = new RoomRound();

    @BeforeEach
    void setUp() {
        strategy = new TeamVsTeamStrategy(teamScoring, new SpeedRaceScoringService());
        ctx = new GameLoopContext("room-1", List.of(q), 20, 5000, ws, roomService, stateService,
                playerRepository, roundRepository, (id, r) -> r, x -> Map.of());
        TeamVsTeamStrategy.TeamState st = new TeamVsTeamStrategy.TeamState();
        st.consensus = true;
        ctx.setModeState(st);
        q.setCorrectAnswer(List.of(1));
        round.setId("round-1");
    }

    @Test
    void roundEnd_carriesEachTeamsAnswer_andTeamScoreIsTheRunningTotal() throws Exception {
        when(teamScoring.consensus("room-1", "round-1", 1))
                .thenReturn(new TeamScoringService.ConsensusResult(1, true, 150, 2, false, 0))
                .thenReturn(new TeamScoringService.ConsensusResult(1, false, 100, 1, false, 100));
        WebSocketMessage.RoundEndData data = new WebSocketMessage.RoundEndData(1, List.of());

        strategy.decorateRoundEnd(ctx, round, q, data);
        strategy.afterRound(ctx, round, 0);

        assertEquals(1, data.teamAnswers.get("A"));
        assertEquals(2, data.teamAnswers.get("B"));
        verify(ws).broadcastTeamScoreUpdate("room-1", 150, 0);
        verify(ws).broadcastPerfectRound("room-1", true, false);

        WebSocketMessage.RoundEndData next = new WebSocketMessage.RoundEndData(1, List.of());
        strategy.decorateRoundEnd(ctx, round, q, next);
        strategy.afterRound(ctx, round, 1);
        verify(ws).broadcastTeamScoreUpdate("room-1", 250, 100);
    }

    @Test
    void finish_teamWithTheHigherTotalWins() {
        TeamVsTeamStrategy.TeamState st = ctx.modeState();
        st.totalA = 300;
        st.totalB = 100;
        User ua = new User(); ua.setId("a");
        User ub = new User(); ub.setId("b");
        RoomPlayer a = new RoomPlayer("rp-a", new Room(), ua, "a"); a.setTeam(RoomPlayer.Team.A);
        RoomPlayer b = new RoomPlayer("rp-b", new Room(), ub, "b"); b.setTeam(RoomPlayer.Team.B);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(a, b));

        strategy.finishGame(ctx);

        assertEquals(1, a.getFinalRank());
        assertEquals(2, b.getFinalRank());
        ArgumentCaptor<Object> end = ArgumentCaptor.forClass(Object.class);
        verify(ws).broadcastQuizEnd(eq("room-1"), end.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) end.getValue();
        assertEquals("A", payload.get("teamWinner"));
        assertEquals(300, payload.get("scoreA"));
        verify(teamScoring, never()).determineWinnerWithTieBreak(anyString(), anyInt(), anyInt());
    }
}
