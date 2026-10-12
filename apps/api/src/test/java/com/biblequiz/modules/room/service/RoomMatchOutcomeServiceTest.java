package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.service.DailyMissionService;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.*;

/** PCV-6 — kết thúc trận: nhiệm vụ "chơi phòng" cho mọi người thật còn trong trận, "thắng phòng" cho hạng 1. */
@ExtendWith(MockitoExtension.class)
class RoomMatchOutcomeServiceTest {

    @Mock private RoomPlayerRepository playerRepository;
    @Mock private DailyMissionService missionService;
    @InjectMocks private RoomMatchOutcomeService service;

    @Test
    void recordsPlayAndWin_skipsPlayersWhoLeft() {
        RoomPlayer winner = RankAssignerTest.p("w", 900, 6, 6, 3000);
        winner.setFinalRank(1);
        RoomPlayer second = RankAssignerTest.p("s", 500, 4, 6, 3000);
        second.setFinalRank(2);
        RoomPlayer left = RankAssignerTest.p("l", 100, 1, 2, 3000);
        left.setFinalRank(3);
        left.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(winner, second, left));

        service.recordOutcome("room-1");

        verify(missionService).trackProgress("w", "play_multiplayer_room", 1);
        verify(missionService).trackProgress("w", "win_multiplayer_room", 1);
        verify(missionService).trackProgress("s", "play_multiplayer_room", 1);
        verify(missionService, never()).trackProgress("s", "win_multiplayer_room", 1);
        verify(missionService, never()).trackProgress(eq("l"), anyString(), anyInt());
    }

    @Test
    void idlePlayers_getNoMissionCredit_evenWhenTiedAtRankOne() {
        // Cả phòng không ai trả lời → mọi người đồng hạng 1. Không được tính "chơi" hay "thắng".
        RoomPlayer idleA = RankAssignerTest.p("a", 0, 0, 0, 0);
        idleA.setFinalRank(1);
        RoomPlayer idleB = RankAssignerTest.p("b", 0, 0, 0, 0);
        idleB.setFinalRank(1);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(idleA, idleB));

        service.recordOutcome("room-1");

        verifyNoInteractions(missionService);
    }

    @Test
    void rankOneWithoutAnyCorrectAnswer_countsAsPlayedButNotWon() {
        RoomPlayer answeredAllWrong = RankAssignerTest.p("x", 0, 0, 5, 4000);
        answeredAllWrong.setFinalRank(1);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(answeredAllWrong));

        service.recordOutcome("room-1");

        verify(missionService).trackProgress("x", "play_multiplayer_room", 1);
        verify(missionService, never()).trackProgress("x", "win_multiplayer_room", 1);
    }

    @Test
    void missionFailure_doesNotBreakTheGameEnd() {
        RoomPlayer winner = RankAssignerTest.p("w", 900, 6, 6, 3000);
        winner.setFinalRank(1);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(winner));
        doThrow(new RuntimeException("db down")).when(missionService).trackProgress(anyString(), anyString(), anyInt());

        service.recordOutcome("room-1"); // không ném lỗi
    }

    @Test
    void bots_getNoMissions_andBeatingOnlyBotsIsNotAWin() {
        // PCV-20: người máy không có nhiệm vụ; thắng phòng chỉ tính khi có ít nhất 2 người thật.
        RoomPlayer human = RankAssignerTest.p("h", 900, 6, 6, 3000);
        human.setFinalRank(1);
        RoomPlayer bot = RankAssignerTest.p("bot-01", 300, 2, 6, 6000);
        bot.setFinalRank(2);
        bot.getUser().setIsBot(true);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(human, bot));

        service.recordOutcome("room-1");

        verify(missionService).trackProgress("h", "play_multiplayer_room", 1);
        verify(missionService, never()).trackProgress("h", "win_multiplayer_room", 1);
        verify(missionService, never()).trackProgress(eq("bot-01"), anyString(), anyInt());
    }
}
