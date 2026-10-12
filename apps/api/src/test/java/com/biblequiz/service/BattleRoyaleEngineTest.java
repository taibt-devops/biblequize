package com.biblequiz.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.service.BattleRoyaleEngine;
import com.biblequiz.modules.user.entity.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BattleRoyaleEngineTest {

    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomAnswerRepository roomAnswerRepository;
    @InjectMocks private BattleRoyaleEngine engine;

    private static final String ROOM = "room-1";
    private static final String ROUND = "round-1";

    private RoomPlayer createPlayer(String userId, String name) {
        User u = new User(); u.setId(userId); u.setName(name);
        RoomPlayer p = new RoomPlayer(); p.setUser(u); p.setUsername(name);
        p.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE); p.setScore(0);
        return p;
    }

    private RoomAnswer createAnswer(String userId, boolean correct) {
        RoomAnswer a = new RoomAnswer(); a.setUserId(userId); a.setIsCorrect(correct);
        return a;
    }

    @BeforeEach
    void setUp() {
        lenient().when(roomPlayerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void correctAnswerer_staysActive() {
        RoomPlayer p1 = createPlayer("u1", "P1");
        RoomPlayer p2 = createPlayer("u2", "P2");
        when(roomPlayerRepository.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE))
                .thenReturn(List.of(p1, p2));
        when(roomAnswerRepository.findByRoundId(ROUND))
                .thenReturn(List.of(createAnswer("u1", true), createAnswer("u2", false)));

        var eliminated = engine.processRoundEnd(ROOM, ROUND);

        assertEquals(1, eliminated.size());
        assertEquals("u2", eliminated.get(0).userId);
        assertEquals(RoomPlayer.PlayerStatus.ELIMINATED, p2.getPlayerStatus());
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, p1.getPlayerStatus());
    }

    @Test
    void allWrong_noOneEliminated() {
        RoomPlayer p1 = createPlayer("u1", "P1");
        RoomPlayer p2 = createPlayer("u2", "P2");
        when(roomPlayerRepository.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE))
                .thenReturn(List.of(p1, p2));
        when(roomAnswerRepository.findByRoundId(ROUND))
                .thenReturn(List.of(createAnswer("u1", false), createAnswer("u2", false)));

        var eliminated = engine.processRoundEnd(ROOM, ROUND);

        assertTrue(eliminated.isEmpty());
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, p1.getPlayerStatus());
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, p2.getPlayerStatus());
    }

    @Test
    void noAnswer_treatedAsWrong() {
        RoomPlayer p1 = createPlayer("u1", "P1");
        RoomPlayer p2 = createPlayer("u2", "P2");
        when(roomPlayerRepository.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE))
                .thenReturn(List.of(p1, p2));
        // Only p1 answered (correct), p2 didn't answer
        when(roomAnswerRepository.findByRoundId(ROUND))
                .thenReturn(List.of(createAnswer("u1", true)));

        var eliminated = engine.processRoundEnd(ROOM, ROUND);

        assertEquals(1, eliminated.size());
        assertEquals("u2", eliminated.get(0).userId);
    }

    @Test
    void threePlayersOneCorrect_twoEliminated() {
        RoomPlayer p1 = createPlayer("u1", "P1");
        RoomPlayer p2 = createPlayer("u2", "P2");
        RoomPlayer p3 = createPlayer("u3", "P3");
        when(roomPlayerRepository.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE))
                .thenReturn(List.of(p1, p2, p3));
        when(roomAnswerRepository.findByRoundId(ROUND))
                .thenReturn(List.of(createAnswer("u1", true), createAnswer("u2", false), createAnswer("u3", false)));

        var eliminated = engine.processRoundEnd(ROOM, ROUND);

        assertEquals(2, eliminated.size());
        // rank = 1 survivor + 1 = 2
        assertEquals(2, eliminated.get(0).rank);
    }

    @Test
    void eliminatedPlayerGetsCorrectRank() {
        RoomPlayer p1 = createPlayer("u1", "P1");
        RoomPlayer p2 = createPlayer("u2", "P2");
        RoomPlayer p3 = createPlayer("u3", "P3");
        RoomPlayer p4 = createPlayer("u4", "P4");
        when(roomPlayerRepository.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE))
                .thenReturn(List.of(p1, p2, p3, p4));
        when(roomAnswerRepository.findByRoundId(ROUND))
                .thenReturn(List.of(createAnswer("u1", true), createAnswer("u2", true),
                        createAnswer("u3", false), createAnswer("u4", false)));

        var eliminated = engine.processRoundEnd(ROOM, ROUND);

        assertEquals(2, eliminated.size());
        // 2 survivors, rank = 3
        assertEquals(3, eliminated.get(0).rank);
    }

    @Test
    void assignFinalRanks_sortsByCorrectAnswersDescending() {
        RoomPlayer p1 = createPlayer("u1", "P1"); p1.setCorrectAnswers(5); p1.setAverageReactionTime(3000.0);
        RoomPlayer p2 = createPlayer("u2", "P2"); p2.setCorrectAnswers(8); p2.setAverageReactionTime(3000.0);
        RoomPlayer p3 = createPlayer("u3", "P3"); p3.setCorrectAnswers(6); p3.setAverageReactionTime(3000.0);
        when(roomPlayerRepository.findByRoomId(ROOM))
                .thenReturn(new ArrayList<>(List.of(p1, p2, p3)));

        engine.assignFinalRanks(ROOM);

        assertEquals(1, p2.getFinalRank()); // 8 correct = rank 1
        assertEquals(2, p3.getFinalRank()); // 6 correct = rank 2
        assertEquals(3, p1.getFinalRank()); // 5 correct = rank 3
    }

    // shouldEndGame (max-rounds rule) removed 2026-06-12: it never had a call
    // site — the loop runs exactly questionCount rounds, stopping early only
    // when ≤1 ACTIVE remains (strategy.shouldStopBeforeRound).

    @Test
    void assignFinalRanks_byCorrectAnswersThenSpeed() {
        RoomPlayer p1 = createPlayer("u1", "P1"); p1.setCorrectAnswers(5); p1.setAverageReactionTime(3000.0);
        RoomPlayer p2 = createPlayer("u2", "P2"); p2.setCorrectAnswers(5); p2.setAverageReactionTime(2000.0);
        RoomPlayer p3 = createPlayer("u3", "P3"); p3.setCorrectAnswers(3); p3.setAverageReactionTime(1000.0);
        when(roomPlayerRepository.findByRoomId(ROOM))
                .thenReturn(new ArrayList<>(List.of(p1, p2, p3)));

        engine.assignFinalRanks(ROOM);

        assertEquals(1, p2.getFinalRank()); // 5 correct, 2000ms (fastest)
        assertEquals(2, p1.getFinalRank()); // 5 correct, 3000ms
        assertEquals(3, p3.getFinalRank()); // 3 correct
    }

    @Test
    void emptyActivePlayers_returnsEmpty() {
        when(roomPlayerRepository.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE))
                .thenReturn(List.of());

        var eliminated = engine.processRoundEnd(ROOM, ROUND);

        assertTrue(eliminated.isEmpty());
    }
}
