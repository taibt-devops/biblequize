package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.mode.RoomModeRegistry;
import com.biblequiz.modules.room.service.mode.SpeedRaceStrategy;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
 * PCV-1 — máy chủ đo thời gian trả lời và đóng vòng (design §1.1–1.2).
 * Đồng hồ máy chủ được giả lập: câu bắt đầu ở mốc START, "bây giờ" do từng test đặt.
 */
@ExtendWith(MockitoExtension.class)
class RoomAnswerProcessorTimingTest {

    private static final long START = 1_000_000L;
    private static final int TIME_LIMIT_S = 20;

    @Mock private RoomStateService roomStateService;
    @Mock private RoomAnswerRepository roomAnswerRepository;
    @Mock private RoomRoundRepository roomRoundRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private RoomRepository roomRepository;

    private final User user = new User();
    private long now;

    @BeforeEach
    void setUp() {
        user.setId("u1");
        user.setName("Minh");
        Room room = new Room();
        room.setId("room-1");
        room.setMode(Room.RoomMode.SPEED_RACE);
        room.setHostPlaysGame(true);
        room.setHost(user);
        lenient().when(roomRepository.findById("room-1")).thenReturn(Optional.of(room));
        lenient().when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));
        lenient().when(roomAnswerRepository.existsByRoundIdAndUserId("round-1", "u1")).thenReturn(false);
        RoomPlayer player = new RoomPlayer("p1", room, user, "Minh");
        lenient().when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "u1")).thenReturn(Optional.of(player));
        Question q = new Question();
        q.setId("q1");
        q.setCorrectAnswer(List.of(1));
        lenient().when(questionRepository.findById("q1")).thenReturn(Optional.of(q));
        lenient().when(roomRoundRepository.findById("round-1"))
                .thenReturn(Optional.of(new RoomRound("round-1", room, 0, "q1", LocalDateTime.now())));
    }

    private RoomAnswerProcessor processor() {
        RoomModeRegistry registry = new RoomModeRegistry(List.of(new SpeedRaceStrategy(new SpeedRaceScoringService())));
        return new RoomAnswerProcessor(roomStateService, roomAnswerRepository, roomRoundRepository,
                roomPlayerRepository, questionRepository, roomRepository, registry, () -> now);
    }

    private void questionStartedAt(Long startedAtMs) {
        when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.of(
                new WebSocketMessage.QuestionStartData(0, 10, Map.of("id", "q1"), TIME_LIMIT_S, startedAtMs)));
    }

    private int savedResponseMs() {
        ArgumentCaptor<RoomAnswer> saved = ArgumentCaptor.forClass(RoomAnswer.class);
        verify(roomAnswerRepository).save(saved.capture());
        return saved.getValue().getResponseMs();
    }

    @Test
    void clientFasterThanPossible_isRaisedToServerFloor() {
        questionStartedAt(START);
        now = START + 6_000; // máy chủ nhận sau 6 s
        RoomAnswerProcessor.AnswerResult r = processor().process("room-1", user, 1, 1); // máy khai 1 ms

        assertTrue(r.accepted);
        assertEquals(4_500, savedResponseMs(), "tối thiểu = serverElapsed − 1500");
    }

    @Test
    void slowNetwork_keepsClientValue() {
        questionStartedAt(START);
        now = START + 6_000;
        processor().process("room-1", user, 1, 5_200); // mạng chậm 0,8 s

        assertEquals(5_200, savedResponseMs());
    }

    @Test
    void clientSlowerThanServer_isCappedAtServerElapsed() {
        questionStartedAt(START);
        now = START + 6_000;
        processor().process("room-1", user, 1, 9_000);

        assertEquals(6_000, savedResponseMs());
    }

    @Test
    void lateAfterGrace_isRejected() {
        questionStartedAt(START);
        now = START + TIME_LIMIT_S * 1_000L + 1_001;
        RoomAnswerProcessor.AnswerResult r = processor().process("room-1", user, 1, 3_000);

        assertFalse(r.accepted);
        verify(roomAnswerRepository, never()).save(any());
    }

    @Test
    void withinGrace_isAcceptedAndCappedAtLimit() {
        questionStartedAt(START);
        now = START + TIME_LIMIT_S * 1_000L + 800;
        RoomAnswerProcessor.AnswerResult r = processor().process("room-1", user, 1, 20_500);

        assertTrue(r.accepted);
        assertEquals(TIME_LIMIT_S * 1_000, savedResponseMs());
    }

    @Test
    void closedRound_isRejected() {
        when(roomStateService.isRoundClosed("room-1", "round-1")).thenReturn(true);
        RoomAnswerProcessor.AnswerResult r = processor().process("room-1", user, 1, 3_000);

        assertFalse(r.accepted);
        verify(roomAnswerRepository, never()).save(any());
    }

    @Test
    void noStartTimestamp_clampsClientToLimit() {
        questionStartedAt(null);
        now = START;
        processor().process("room-1", user, 1, 99_999);

        assertEquals(TIME_LIMIT_S * 1_000, savedResponseMs());
    }
}
