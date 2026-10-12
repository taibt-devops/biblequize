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
import com.biblequiz.modules.room.service.mode.GameLoopContext;
import com.biblequiz.modules.room.service.mode.RoomModeRegistry;
import com.biblequiz.modules.room.service.mode.RoundPlan;
import com.biblequiz.modules.room.service.mode.SpeedRaceStrategy;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * PCV-11 — Đua tốc độ (design §2.1): đúng liên tiếp lần 2 +10, lần 3 +20, từ lần 4 +30; sai về 0;
 * câu chốt nhân đôi toàn bộ điểm câu đó. Câu bắt đầu ở START, máy chủ nhận sau 4 giây, câu 20 giây
 * ⇒ điểm gốc 100 + floor(16/20 × 50) = 140.
 */
@ExtendWith(MockitoExtension.class)
class SpeedRaceStreakTest {

    private static final long START = 1_000_000L;
    private static final int BASE = 140;

    @Mock private RoomStateService roomStateService;
    @Mock private RoomAnswerRepository roomAnswerRepository;
    @Mock private RoomRoundRepository roomRoundRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private RoomRepository roomRepository;

    private final User user = new User();
    private final Room room = new Room();
    private RoomPlayer player;

    @BeforeEach
    void setUp() {
        user.setId("u1");
        user.setName("Minh");
        room.setId("room-1");
        room.setMode(Room.RoomMode.SPEED_RACE);
        room.setHostPlaysGame(true);
        room.setHost(user);
        lenient().when(roomRepository.findById("room-1")).thenReturn(Optional.of(room));
        lenient().when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));
        player = new RoomPlayer("p1", room, user, "Minh");
        lenient().when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "u1")).thenReturn(Optional.of(player));
        lenient().when(roomRoundRepository.findById("round-1"))
                .thenReturn(Optional.of(new RoomRound("round-1", room, 0, "q1", LocalDateTime.now())));
        lenient().when(roomStateService.getAnswerKey("room-1"))
                .thenReturn(Optional.of(new RoomStateService.AnswerKey("q1", 1, "easy", "Genesis")));
        question(1);
    }

    private void question(int multiplier) {
        WebSocketMessage.QuestionStartData data =
                new WebSocketMessage.QuestionStartData(0, 10, Map.of("id", "q1"), 20, START);
        data.multiplier = multiplier;
        lenient().when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.of(data));
    }

    private RoomAnswerProcessor processor() {
        RoomModeRegistry registry = new RoomModeRegistry(List.of(
                new SpeedRaceStrategy(new SpeedRaceScoringService()),
                new BattleRoyaleStrategy(mock(BattleRoyaleEngine.class), new SpeedRaceScoringService())));
        return new RoomAnswerProcessor(roomStateService, roomAnswerRepository, roomRoundRepository,
                roomPlayerRepository, questionRepository, roomRepository, registry, () -> START + 4_000);
    }

    private int savedPoints() {
        ArgumentCaptor<RoomAnswer> c = ArgumentCaptor.forClass(RoomAnswer.class);
        verify(roomAnswerRepository).save(c.capture());
        return c.getValue().getPointsEarned();
    }

    @Test
    void firstCorrect_noBonus_streakOne() {
        processor().process("room-1", user, 1, 4_000);
        assertEquals(BASE, savedPoints());
        assertEquals(1, player.getAnswerStreak());
    }

    @Test
    void secondCorrectInARow_earnsTen() {
        player.setAnswerStreak(1);
        processor().process("room-1", user, 1, 4_000);
        assertEquals(BASE + 10, savedPoints());
        assertEquals(2, player.getAnswerStreak());
    }

    @Test
    void thirdEarnsTwenty_fourthAndLaterThirty() {
        player.setAnswerStreak(2);
        processor().process("room-1", user, 1, 4_000);
        assertEquals(BASE + 20, savedPoints());

        reset(roomAnswerRepository);
        player.setAnswerStreak(7);
        processor().process("room-1", user, 1, 4_000);
        assertEquals(BASE + 30, savedPoints());
    }

    @Test
    void wrongAnswer_resetsStreak_noPoints() {
        player.setAnswerStreak(5);
        processor().process("room-1", user, 0, 4_000);
        assertEquals(0, savedPoints());
        assertEquals(0, player.getAnswerStreak());
    }

    @Test
    void finalQuestion_doublesBaseSpeedAndStreak() {
        question(2);
        player.setAnswerStreak(2);
        processor().process("room-1", user, 1, 4_000);
        assertEquals((BASE + 20) * 2, savedPoints());
    }

    @Test
    void otherModes_trackStreakButNoBonus() {
        room.setMode(Room.RoomMode.BATTLE_ROYALE);
        player.setAnswerStreak(3);
        processor().process("room-1", user, 1, 4_000);
        assertEquals(BASE, savedPoints());
        assertEquals(4, player.getAnswerStreak());
    }

    @Test
    void planRound_lastQuestionIsDoubled() {
        List<Question> qs = new ArrayList<>();
        for (int i = 0; i < 10; i++) qs.add(new Question());
        GameLoopContext ctx = new GameLoopContext("room-1", qs, 20, 5000, null, null, null, null, null, null, null);
        SpeedRaceStrategy sr = new SpeedRaceStrategy(new SpeedRaceScoringService());

        RoundPlan last = sr.planRound(ctx, 9, qs.get(9));
        RoundPlan before = sr.planRound(ctx, 8, qs.get(8));

        assertEquals(2, last.multiplier());
        assertEquals(20, last.timeLimitSeconds());
        assertEquals(1, before.multiplier());
    }
}
