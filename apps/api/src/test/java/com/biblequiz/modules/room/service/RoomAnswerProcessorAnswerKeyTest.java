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
import static org.mockito.Mockito.*;

/**
 * PCV-11a — đáp án đúng của vòng đang chạy giữ ở máy chủ (Redis), không tra bảng {@code questions}.
 * Câu trong "bộ câu của tôi" (user_questions) không có trong bảng đó nên trước đây mọi câu trả lời
 * trong phòng dùng bộ câu tự soạn đều bị chấm sai, 0 điểm.
 */
@ExtendWith(MockitoExtension.class)
class RoomAnswerProcessorAnswerKeyTest {

    private static final long START = 1_000_000L;

    @Mock private RoomStateService roomStateService;
    @Mock private RoomAnswerRepository roomAnswerRepository;
    @Mock private RoomRoundRepository roomRoundRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private RoomRepository roomRepository;

    private final User user = new User();
    private RoomPlayer player;

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
        player = new RoomPlayer("p1", room, user, "Minh");
        lenient().when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "u1")).thenReturn(Optional.of(player));
        lenient().when(roomRoundRepository.findById("round-1"))
                .thenReturn(Optional.of(new RoomRound("round-1", room, 0, "uq-7", LocalDateTime.now())));
        lenient().when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.of(
                new WebSocketMessage.QuestionStartData(0, 10, Map.of("id", "uq-7"), 20, START)));
    }

    private RoomAnswerProcessor processor() {
        RoomModeRegistry registry = new RoomModeRegistry(List.of(new SpeedRaceStrategy(new SpeedRaceScoringService())));
        return new RoomAnswerProcessor(roomStateService, roomAnswerRepository, roomRoundRepository,
                roomPlayerRepository, questionRepository, roomRepository, registry, () -> START + 4_000);
    }

    private RoomAnswer saved() {
        ArgumentCaptor<RoomAnswer> c = ArgumentCaptor.forClass(RoomAnswer.class);
        verify(roomAnswerRepository).save(c.capture());
        return c.getValue();
    }

    @Test
    void personalSetQuestion_notInQuestionsTable_isScoredFromAnswerKey() {
        when(roomStateService.getAnswerKey("room-1"))
                .thenReturn(Optional.of(new RoomStateService.AnswerKey("uq-7", 2, "medium", "Ruth")));
        lenient().when(questionRepository.findById("uq-7")).thenReturn(Optional.empty());

        processor().process("room-1", user, 2, 4_000);

        RoomAnswer a = saved();
        assertTrue(a.getIsCorrect());
        assertTrue(a.getPointsEarned() >= 100);
        assertEquals(1, player.getCorrectAnswers());
    }

    @Test
    void keyForAnotherQuestion_isIgnored_fallsBackToQuestionsTable() {
        when(roomStateService.getAnswerKey("room-1"))
                .thenReturn(Optional.of(new RoomStateService.AnswerKey("old-q", 0, "easy", "Genesis")));
        Question q = new Question();
        q.setId("uq-7");
        q.setCorrectAnswer(List.of(3));
        when(questionRepository.findById("uq-7")).thenReturn(Optional.of(q));

        processor().process("room-1", user, 3, 4_000);

        assertTrue(saved().getIsCorrect());
    }
}
