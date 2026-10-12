package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.mode.BattleRoyaleStrategy;
import com.biblequiz.modules.room.service.mode.RoomModeRegistry;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * PCV-13 — Sinh tồn: người bị loại trả lời tiếp dưới dạng "bóng" (không điểm, không tính câu đúng);
 * đúng 3 câu liên tiếp ở câu 1–9 thì hồi sinh với 1 mạng, mỗi người một lần (design §2.2).
 */
@ExtendWith(MockitoExtension.class)
class BattleRoyaleGhostTest {

    private static final String ROOM = "room-1";
    private static final String ROUND = "round-1";
    private static final long START = 1_000_000L;

    @Mock private RoomStateService roomStateService;
    @Mock private RoomAnswerRepository answers;
    @Mock private RoomRoundRepository rounds;
    @Mock private RoomPlayerRepository players;
    @Mock private QuestionRepository questions;
    @Mock private RoomRepository rooms;
    @InjectMocks private BattleRoyaleEngine engine;

    private final User user = new User();
    private final Room room = new Room();

    @BeforeEach
    void setUp() {
        user.setId("ghost");
        user.setName("Bóng");
        room.setId(ROOM);
        room.setMode(Room.RoomMode.BATTLE_ROYALE);
        room.setHostPlaysGame(true);
        lenient().when(players.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private RoomPlayer eliminated(String id, int ghostStreak) {
        User u = new User();
        u.setId(id);
        RoomPlayer p = new RoomPlayer();
        p.setUser(u);
        p.setUsername(id);
        p.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED);
        p.setGhostStreak(ghostStreak);
        p.setEliminatedRound(3);
        p.setFinalRank(5);
        return p;
    }

    private RoomAnswer ghostAnswer(String userId, boolean correct) {
        RoomAnswer a = new RoomAnswer();
        a.setUserId(userId);
        a.setIsCorrect(correct);
        a.setGhost(true);
        return a;
    }

    // ── Câu trả lời của bóng ──

    private RoomAnswerProcessor processor() {
        RoomModeRegistry registry = new RoomModeRegistry(List.of(
                new com.biblequiz.modules.room.service.mode.SpeedRaceStrategy(new SpeedRaceScoringService()),
                new BattleRoyaleStrategy(mock(BattleRoyaleEngine.class), new SpeedRaceScoringService())));
        return new RoomAnswerProcessor(roomStateService, answers, rounds, players, questions, rooms, registry, () -> START + 4_000);
    }

    @Test
    void eliminatedPlayer_answersAsGhost_noPointsNoStats() {
        RoomPlayer ghost = new RoomPlayer("p-ghost", room, user, "Bóng");
        ghost.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED);
        when(rooms.findById(ROOM)).thenReturn(Optional.of(room));
        when(roomStateService.getCurrentRoundId(ROOM)).thenReturn(Optional.of(ROUND));
        when(players.findByRoomIdAndUserId(ROOM, "ghost")).thenReturn(Optional.of(ghost));
        when(rounds.findById(ROUND)).thenReturn(Optional.of(new RoomRound(ROUND, room, 2, "q1", LocalDateTime.now())));
        when(roomStateService.getCurrentQuestion(ROOM)).thenReturn(Optional.of(
                new WebSocketMessage.QuestionStartData(2, 10, Map.of("id", "q1"), 20, START)));
        when(roomStateService.getAnswerKey(ROOM)).thenReturn(Optional.of(new RoomStateService.AnswerKey("q1", 1, "easy", "Genesis")));

        RoomAnswerProcessor.AnswerResult r = processor().process(ROOM, user, 1, 4_000);

        assertTrue(r.accepted);
        assertTrue(r.ghost, "bóng: không phát ANSWER_SUBMITTED");
        ArgumentCaptor<RoomAnswer> saved = ArgumentCaptor.forClass(RoomAnswer.class);
        verify(answers).save(saved.capture());
        assertTrue(saved.getValue().isGhost());
        assertTrue(saved.getValue().getIsCorrect());
        assertEquals(0, saved.getValue().getPointsEarned());
        assertEquals(0, ghost.getScore());
        assertEquals(0, ghost.getCorrectAnswers());
        assertEquals(0, ghost.getTotalAnswered());
    }

    @Test
    void leftPlayer_isStillRejected() {
        RoomPlayer left = new RoomPlayer("p-left", room, user, "Bóng");
        left.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(rooms.findById(ROOM)).thenReturn(Optional.of(room));
        when(roomStateService.getCurrentRoundId(ROOM)).thenReturn(Optional.of(ROUND));
        when(players.findByRoomIdAndUserId(ROOM, "ghost")).thenReturn(Optional.of(left));

        assertFalse(processor().process(ROOM, user, 1, 4_000).accepted);
        verify(answers, never()).save(any());
    }

    // ── Hồi sinh ──

    @Test
    void thirdCorrectInARowBeforeQuestionTen_revivesWithOneLife() {
        RoomPlayer g = eliminated("g", 2);
        when(players.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ELIMINATED)).thenReturn(List.of(g));
        when(answers.findByRoundId(ROUND)).thenReturn(List.of(ghostAnswer("g", true)));

        List<BattleRoyaleEngine.RevivedPlayerInfo> revived = engine.processGhosts(ROOM, ROUND, 6);

        assertEquals(1, revived.size());
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, g.getPlayerStatus());
        assertEquals(1, g.getLives());
        assertTrue(g.getRevived());
        assertNull(g.getEliminatedRound());
        assertNull(g.getFinalRank());
        assertEquals(0, g.getGhostStreak());
    }

    @Test
    void wrongOrMissingGhostAnswer_resetsTheStreak() {
        RoomPlayer wrong = eliminated("w", 2);
        RoomPlayer silent = eliminated("s", 2);
        when(players.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ELIMINATED)).thenReturn(List.of(wrong, silent));
        when(answers.findByRoundId(ROUND)).thenReturn(List.of(ghostAnswer("w", false)));

        assertTrue(engine.processGhosts(ROOM, ROUND, 4).isEmpty());
        assertEquals(0, wrong.getGhostStreak());
        assertEquals(0, silent.getGhostStreak());
    }

    @Test
    void noRevivalFromQuestionTen() {
        RoomPlayer g = eliminated("g", 2);
        when(players.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ELIMINATED)).thenReturn(List.of(g));
        when(answers.findByRoundId(ROUND)).thenReturn(List.of(ghostAnswer("g", true)));

        assertTrue(engine.processGhosts(ROOM, ROUND, 9).isEmpty(), "câu 10 là vùng nguy hiểm");
        assertEquals(RoomPlayer.PlayerStatus.ELIMINATED, g.getPlayerStatus());
    }

    @Test
    void revivesOnlyOnce() {
        RoomPlayer g = eliminated("g", 2);
        g.setRevived(true);
        when(players.findByRoomIdAndPlayerStatus(ROOM, RoomPlayer.PlayerStatus.ELIMINATED)).thenReturn(List.of(g));
        when(answers.findByRoundId(ROUND)).thenReturn(List.of(ghostAnswer("g", true)));

        assertTrue(engine.processGhosts(ROOM, ROUND, 5).isEmpty());
        assertEquals(RoomPlayer.PlayerStatus.ELIMINATED, g.getPlayerStatus());
    }
}
