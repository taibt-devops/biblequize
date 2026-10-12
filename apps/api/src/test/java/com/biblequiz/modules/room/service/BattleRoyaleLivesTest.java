package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** PCV-12 — Sinh tồn có mạng (design §2.2): 2 mạng, ân xá khi cả nhóm cùng sai, câu quyết định loại ngay. */
@ExtendWith(MockitoExtension.class)
class BattleRoyaleLivesTest {

    private static final String ROOM = "room-1";
    private static final String ROUND = "round-1";

    @Mock private RoomPlayerRepository players;
    @Mock private RoomAnswerRepository answers;
    @InjectMocks private BattleRoyaleEngine engine;

    private RoomPlayer player(String id, int lives) {
        User u = new User();
        u.setId(id);
        RoomPlayer p = new RoomPlayer();
        p.setUser(u);
        p.setUsername(id.toUpperCase());
        p.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        p.setLives(lives);
        return p;
    }

    private RoomAnswer answer(String userId, boolean correct) {
        RoomAnswer a = new RoomAnswer();
        a.setUserId(userId);
        a.setIsCorrect(correct);
        return a;
    }

    private void round(List<RoomPlayer> active, RoomAnswer... given) {
        when(players.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE)).thenReturn(new ArrayList<>(active));
        when(answers.findByRoundId(ROUND)).thenReturn(List.of(given));
    }

    @BeforeEach
    void setUp() {
        lenient().when(players.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void firstMissCostsOneLife_secondMissEliminates() {
        RoomPlayer an = player("an", 2), binh = player("binh", 2), chau = player("chau", 2);
        round(List.of(an, binh, chau), answer("an", true), answer("binh", false), answer("chau", true));

        BattleRoyaleEngine.RoundOutcome first = engine.processRoundEnd(ROOM, ROUND, 3, false);

        assertTrue(first.eliminated.isEmpty());
        assertEquals(1, binh.getLives());
        assertEquals(2, an.getLives());
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, binh.getPlayerStatus());

        round(List.of(an, binh, chau), answer("an", true), answer("chau", true)); // Bình không trả lời
        BattleRoyaleEngine.RoundOutcome second = engine.processRoundEnd(ROOM, ROUND, 4, false);

        assertEquals(1, second.eliminated.size());
        assertEquals(RoomPlayer.PlayerStatus.ELIMINATED, binh.getPlayerStatus());
        assertEquals(4, binh.getEliminatedRound());
        assertEquals(3, second.eliminated.get(0).rank, "2 người còn lại ⇒ hạng tạm 3");
    }

    @Test
    void everyoneWrong_noOneLosesALife() {
        RoomPlayer an = player("an", 1), binh = player("binh", 2);
        round(List.of(an, binh), answer("an", false));

        BattleRoyaleEngine.RoundOutcome r = engine.processRoundEnd(ROOM, ROUND, 5, false);

        assertTrue(r.amnesty);
        assertEquals(1, an.getLives());
        assertEquals(2, binh.getLives());
    }

    @Test
    void showdown_missEliminatesImmediately_evenWithLivesLeft() {
        RoomPlayer an = player("an", 2), binh = player("binh", 2);
        round(List.of(an, binh), answer("an", true), answer("binh", false));

        BattleRoyaleEngine.RoundOutcome r = engine.processRoundEnd(ROOM, ROUND, 15, true);

        assertEquals(1, r.eliminated.size());
        assertEquals(RoomPlayer.PlayerStatus.ELIMINATED, binh.getPlayerStatus());
        assertEquals(0, binh.getLives());
    }

    @Test
    void showdown_everyoneWrong_isStillAmnesty() {
        RoomPlayer an = player("an", 2), binh = player("binh", 1);
        round(List.of(an, binh), answer("an", false), answer("binh", false));

        BattleRoyaleEngine.RoundOutcome r = engine.processRoundEnd(ROOM, ROUND, 15, true);

        assertTrue(r.amnesty);
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, an.getPlayerStatus());
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, binh.getPlayerStatus());
    }

    @Test
    void ghostAnswers_neverCountAsCorrectForTheLiving() {
        RoomPlayer an = player("an", 2), binh = player("binh", 2);
        RoomAnswer ghostRight = answer("binh", true);
        ghostRight.setGhost(true);
        round(List.of(an, binh), answer("an", true), ghostRight);

        engine.processRoundEnd(ROOM, ROUND, 2, false);

        assertEquals(1, binh.getLives(), "câu của bóng không cứu người còn sống");
    }

    @Test
    void initLives_setsEveryActivePlayerToStartingLives() {
        RoomPlayer an = player("an", 0), binh = player("binh", 0);
        when(players.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ACTIVE)).thenReturn(List.of(an, binh));

        engine.initLives(ROOM, 2);

        assertEquals(2, an.getLives());
        assertEquals(2, binh.getLives());
        verify(players).saveAll(anyList());
    }

    @Test
    void finalRanks_survivorsByLivesThenCorrectThenSpeed_eliminatedByRoundOut() {
        RoomPlayer a = player("a", 2); a.setCorrectAnswers(8); a.setAverageReactionTime(4000.0);
        RoomPlayer b = player("b", 1); b.setCorrectAnswers(9); b.setAverageReactionTime(3000.0);
        RoomPlayer c = player("c", 1); c.setCorrectAnswers(9); c.setAverageReactionTime(2000.0);
        RoomPlayer d = player("d", 0); d.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED); d.setEliminatedRound(7);
        RoomPlayer e = player("e", 0); e.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED); e.setEliminatedRound(4);
        RoomPlayer f = player("f", 0); f.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED); f.setEliminatedRound(4);
        RoomPlayer g = player("g", 2); g.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(players.findByRoomId(ROOM)).thenReturn(new ArrayList<>(List.of(a, b, c, d, e, f, g)));

        engine.assignFinalRanks(ROOM);

        assertEquals(1, a.getFinalRank(), "2 mạng xếp trên 1 mạng");
        assertEquals(2, c.getFinalRank(), "cùng mạng, cùng câu đúng ⇒ nhanh hơn");
        assertEquals(3, b.getFinalRank());
        assertEquals(4, d.getFinalRank(), "bị loại muộn hơn xếp trên");
        assertEquals(5, e.getFinalRank());
        assertEquals(5, f.getFinalRank(), "cùng lượt bị loại ⇒ đồng hạng");
        assertEquals(7, g.getFinalRank(), "người bỏ trận xếp cuối");
    }
}
