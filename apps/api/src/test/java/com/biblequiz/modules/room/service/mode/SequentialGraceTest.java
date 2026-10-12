package com.biblequiz.modules.room.service.mode;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.RoomStateService;
import com.biblequiz.modules.room.service.SequentialScoringService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Review PCV-1: "Chơi cùng nhau" cũng có 1 giây ân hạn như các mode khác — câu trả lời gửi ở giây cuối,
 * tới máy chủ trễ vì mạng, vẫn được chấm trước khi công bố đáp án.
 */
@ExtendWith(MockitoExtension.class)
class SequentialGraceTest {

    @Mock private RoomWebSocketController ws;
    @Mock private RoomService roomService;
    @Mock private RoomStateService stateService;
    @Mock private RoomPlayerRepository playerRepository;
    @Mock private RoomRoundRepository roundRepository;
    @Mock private SequentialScoringService scoring;

    @Test
    void waitsForTheTimerPlusOneSecondGrace_beforeRevealing() throws Exception {
        Question q = new Question();
        q.setId("q1");
        q.setCorrectAnswer(List.of(2));
        GameLoopContext ctx = new GameLoopContext("room-1", List.of(q), 20, 5000, ws, roomService, stateService,
                playerRepository, roundRepository, (id, r) -> r, x -> Map.of());
        when(scoring.awaitAllAnsweredOrTimeoutMs("room-1", 21_000L)).thenReturn(false);
        when(scoring.awaitLeaderAdvance("room-1")).thenReturn(true);

        new SequentialStrategy(scoring).runGameLoop(ctx);

        verify(scoring).awaitAllAnsweredOrTimeoutMs("room-1", 21_000L);
        verify(ws).broadcastQuestionRevealed(eq("room-1"), anyString(), eq(2), any());
    }
}
