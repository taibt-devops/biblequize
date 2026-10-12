package com.biblequiz.modules.room.service.mode;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.RoomStateService;

import java.util.List;
import java.util.Map;

/**
 * Per-run context handed to {@link RoomModeStrategy} hooks by the quiz
 * runner. Carries the collaborators the legacy run{Mode} methods used, so
 * strategies don't need to inject the WebSocket controller (avoids the
 * controller → answer-processor → strategy → controller bean cycle).
 */
public final class GameLoopContext {

    /** Persists a round, replacing any leftover row with the same roundNo. */
    @FunctionalInterface
    public interface RoundSaver {
        RoomRound save(String roomId, RoomRound round);
    }

    /** Builds the anti-spoiler question DTO (never includes correctAnswer). */
    @FunctionalInterface
    public interface QuestionDtoFactory {
        Map<String, Object> build(Question question);
    }

    public final String roomId;
    public final List<Question> questions;
    public final int timePerQuestion;
    public final int betweenQuestionDelayMs;

    public final RoomWebSocketController ws;
    public final RoomService roomService;
    public final RoomStateService roomStateService;
    public final RoomPlayerRepository roomPlayerRepository;
    public final RoomRoundRepository roomRoundRepository;
    public final RoundSaver roundSaver;
    public final QuestionDtoFactory questionDtoFactory;

    /** Scratch slot for per-run mode state (e.g. BR's initial player count). */
    private Object modeState;

    /** PCV-12: số câu chính; các câu sau đó là câu dự phòng (câu quyết định Sinh tồn). */
    private int regularCount;

    public GameLoopContext(String roomId, List<Question> questions, int timePerQuestion,
                           int betweenQuestionDelayMs, RoomWebSocketController ws,
                           RoomService roomService, RoomStateService roomStateService,
                           RoomPlayerRepository roomPlayerRepository,
                           RoomRoundRepository roomRoundRepository,
                           RoundSaver roundSaver, QuestionDtoFactory questionDtoFactory) {
        this.roomId = roomId;
        this.questions = questions;
        this.timePerQuestion = timePerQuestion;
        this.betweenQuestionDelayMs = betweenQuestionDelayMs;
        this.ws = ws;
        this.roomService = roomService;
        this.roomStateService = roomStateService;
        this.roomPlayerRepository = roomPlayerRepository;
        this.roomRoundRepository = roomRoundRepository;
        this.roundSaver = roundSaver;
        this.questionDtoFactory = questionDtoFactory;
        this.regularCount = questions != null ? questions.size() : 0;
    }

    public int regularCount() {
        return regularCount;
    }

    public void setRegularCount(int regularCount) {
        this.regularCount = regularCount;
    }

    public void setModeState(Object state) {
        this.modeState = state;
    }

    @SuppressWarnings("unchecked")
    public <T> T modeState() {
        return (T) modeState;
    }
}
