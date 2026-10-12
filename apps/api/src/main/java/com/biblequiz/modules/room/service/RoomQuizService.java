package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.infrastructure.bible.BookScopes;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.mode.GameLoopContext;
import com.biblequiz.modules.room.service.mode.RoomModeRegistry;
import com.biblequiz.modules.room.service.mode.RoomModeStrategy;
import com.biblequiz.modules.userquiz.entity.UserQuestion;
import com.biblequiz.modules.userquiz.repository.QuestionSetItemRepository;
import com.biblequiz.modules.userquiz.repository.RoomQuestionSelectionRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Điều phối luồng quiz bất đồng bộ cho multiplayer room.
 * Hỗ trợ các game mode: Speed Race, Battle Royale (Tuần 2), Team vs Team, Sudden Death (Tuần 3).
 * Mode-specific behavior lives in {@link RoomModeStrategy} beans; this class
 * owns the shared loop skeleton + timing model (Thread.sleep / 250ms poll).
 */
@Service
public class RoomQuizService {

    private static final Logger log = LoggerFactory.getLogger(RoomQuizService.class);

    @Autowired private QuestionRepository questionRepository;
    @Autowired private RoomRepository roomRepository;
    @Autowired private RoomQuestionSelectionRepository roomQuestionSelectionRepo;
    @Autowired private QuestionSetItemRepository questionSetItemRepo;
    @Autowired private RoomWebSocketController wsController;
    @Autowired private RoomService roomService;
    @Autowired private RoomStateService roomStateService;
    @Autowired private RoomRoundRepository roomRoundRepository;
    @Autowired private RoomAnswerRepository roomAnswerRepository;
    @Autowired private RoomPlayerRepository roomPlayerRepository;
    @Autowired private RoomModeRegistry roomModeRegistry;
    @Autowired private HostControlService hostControlService;
    @Autowired private RoundResultBuilder roundResultBuilder;

    /** PCV-2: nghỉ sau khi công bố đủ lâu để đọc câu gốc (5 s; có giải thích thì 7 s — xem
     *  {@link RoundResultBuilder#revealPauseMs}). Đấu vương dùng giá trị gốc này. */
    private static final int BETWEEN_QUESTION_DELAY_MS = 5000;
    /** Poll cadence for the early-end watcher. 250ms = up to 0.25s slack
     *  before the round ends after the last answer arrives — feels
     *  instant to players without hammering the DB. */
    private static final int ROUND_POLL_INTERVAL_MS = 250;

    /**
     * Wait until either the timeLimit elapses or every expected player
     * has answered the round, whichever comes first. Returns early so
     * the next QUESTION_START doesn't sit idle when the room is fast.
     *
     * @param roundId          DB id of the active round
     * @param timeLimitMs      hard timeout (timePerQuestion × 1000)
     * @param expectedAnswers  number of submissions that signals "done"
     *                         (active player count for Speed Race / BR /
     *                         Team modes; 2 for Sudden Death 1v1)
     */
    // package-private for unit test — see RoomQuizServiceWaitTest
    void waitForRoundEnd(String roundId, long timeLimitMs, int expectedAnswers)
            throws InterruptedException {
        waitForRoundEnd(null, roundId, timeLimitMs, expectedAnswers);
    }

    /**
     * Sprint 4 overload: when {@code roomId != null} the loop also exits
     * early if the host has pushed a skip request (consumes the flag).
     */
    void waitForRoundEnd(String roomId, String roundId, long timeLimitMs, int expectedAnswers)
            throws InterruptedException {
        if (expectedAnswers <= 0) {
            // Nothing to wait for — no active players. Still respect the
            // full timer so observers see the round play out normally.
            // Even here, honor a host skip so the room never feels stuck.
            long deadline = System.currentTimeMillis() + timeLimitMs;
            while (System.currentTimeMillis() < deadline) {
                if (roomId != null && hostControlService != null
                        && hostControlService.consumeSkipFlag(roomId)) return;
                long remaining = deadline - System.currentTimeMillis();
                Thread.sleep(Math.min(ROUND_POLL_INTERVAL_MS, Math.max(1, remaining)));
            }
            return;
        }
        long deadline = System.currentTimeMillis() + timeLimitMs;
        while (System.currentTimeMillis() < deadline) {
            if (roomId != null && hostControlService != null
                    && hostControlService.consumeSkipFlag(roomId)) return;
            long submitted = roomAnswerRepository.countByRoundId(roundId);
            if (submitted >= expectedAnswers) return;
            // Sleep up to the poll interval, but never past the deadline.
            long remaining = deadline - System.currentTimeMillis();
            Thread.sleep(Math.min(ROUND_POLL_INTERVAL_MS, Math.max(1, remaining)));
        }
    }

    /** Block at the top of each round if the host has paused. Wrapped so a
     *  null hostControlService (legacy unit tests) is a no-op. */
    private void awaitIfPaused(String roomId) throws InterruptedException {
        if (hostControlService != null) {
            hostControlService.awaitIfPaused(roomId, 5);
        }
    }

    /** True once the room is ENDED — set by host end-early or normal finish.
     *  Lets the per-mode loops stop emitting more rounds + skip the final
     *  wrap-up broadcast (the controller already sent ROOM_ENDED). */
    private boolean isRoomEnded(String roomId) {
        return roomRepository.findById(roomId)
                .map(r -> r.getStatus() == Room.RoomStatus.ENDED)
                .orElse(true);
    }
    /** Sprint 2: bumped 3 → 5 to give the cinematic countdown overlay
     *  enough room for "5-4-3-2-1-BẮT ĐẦU!" + the gameStart sound. The
     *  Sprint 1 fix that removed the redundant ROOM_STARTING send means
     *  this is now the single source of truth — every client times off
     *  the same broadcast moment. */
    private static final int GAME_STARTING_COUNTDOWN_S = 5;

    @Async(com.biblequiz.infrastructure.RoomGameExecutorConfig.BEAN)
    public void runQuiz(String roomId, int questionCount, int timePerQuestion, Room.RoomMode mode) {
        log.info("Quiz bắt đầu cho phòng {} | mode={} | {} câu | {}s/câu", roomId, mode, questionCount, timePerQuestion);
        try {
            broadcastGameStarting(roomId, GAME_STARTING_COUNTDOWN_S);
            Thread.sleep(GAME_STARTING_COUNTDOWN_S * 1000L);

            RoomModeStrategy strategy = roomModeRegistry.get(mode);
            List<Question> questions = loadQuestionsForRoom(roomId, questionCount);
            if (questions.isEmpty()) {
                roomService.endRoom(roomId);
                wsController.broadcastQuizEnd(roomId, List.of());
                return;
            }

            GameLoopContext ctx = new GameLoopContext(roomId, questions, timePerQuestion,
                    BETWEEN_QUESTION_DELAY_MS, wsController, roomService, roomStateService,
                    roomPlayerRepository, roomRoundRepository,
                    this::saveRound, this::buildQuestionDto);

            if (strategy.hasCustomGameLoop()) {
                strategy.runGameLoop(ctx);
            } else {
                runStandardLoop(ctx, strategy);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Quiz bị ngắt cho phòng {}", roomId);
            safeEndRoom(roomId);
        } catch (Exception e) {
            log.error("Lỗi khi chạy quiz cho phòng {}: {}", roomId, e.getMessage(), e);
            safeEndRoom(roomId);
        }
    }

    // ────────────────────────────── STANDARD GAME LOOP ──────────────────────────────

    /**
     * Shared question loop for SPEED_RACE / BATTLE_ROYALE / TEAM_VS_TEAM /
     * SUDDEN_DEATH. The timing model is unchanged from the legacy per-mode
     * loops: Thread.sleep between questions + waitForRoundEnd's 250ms poll.
     * Mode differences (stop conditions, expected answers, post-round
     * processing, final results) live in {@link RoomModeStrategy} hooks.
     */
    private void runStandardLoop(GameLoopContext ctx, RoomModeStrategy strategy) throws InterruptedException {
        String roomId = ctx.roomId;
        List<Question> questions = ctx.questions;

        if (!strategy.beforeLoop(ctx)) return;

        for (int i = 0; i < questions.size(); i++) {
            awaitIfPaused(roomId);
            if (isRoomEnded(roomId)) break;
            long activeCount = roomPlayerRepository.countByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ACTIVE);
            if (strategy.shouldStopBeforeRound(ctx, activeCount)) break;

            Question q = questions.get(i);
            RoomRound round = saveRound(roomId, new RoomRound(UUID.randomUUID().toString(), null, i, q.getId(), LocalDateTime.now()));
            roomStateService.setCurrentRoundId(roomId, round.getId());

            wsController.broadcastQuestionStart(roomId, i, questions.size(), buildQuestionDto(q), ctx.timePerQuestion);
            // End the round as soon as every expected player has answered;
            // otherwise wait the full timer.
            // PCV-1: hạn chót = thời gian câu + 1 s ân hạn cho mạng chậm; hết vòng thì đóng ngay,
            // trước khi chấm/công bố, để câu trả lời tới muộn không lọt vào kết quả.
            waitForRoundEnd(roomId, round.getId(), ctx.timePerQuestion * 1000L + RoomAnswerProcessor.ROUND_GRACE_MS,
                    strategy.expectedAnswers(ctx, activeCount));
            roomStateService.closeCurrentRound(roomId);

            round.setEndedAt(LocalDateTime.now());
            roomRoundRepository.save(round);
            wsController.broadcastRoundEnd(roomId, roundResultBuilder.build(roomId, round.getId(), q));

            if (strategy.afterRound(ctx, round, i)) break;

            if (i < questions.size() - 1) Thread.sleep(RoundResultBuilder.revealPauseMs(q));
        }

        if (isRoomEnded(roomId)) {
            log.info("{} ngắt sớm cho phòng {} (host end-early)", strategy.displayName(), roomId);
            return;
        }
        strategy.finishGame(ctx);
    }

    // ────────────────────────────── HELPERS ──────────────────────────────

    private RoomRound saveRound(String roomId, RoomRound round) {
        roomRoundRepository.findByRoomIdAndRoundNo(roomId, round.getRoundNo())
                .ifPresent(existing -> roomRoundRepository.deleteById(existing.getId()));
        Room roomRef = new Room();
        roomRef.setId(roomId);
        round.setRoom(roomRef);
        return roomRoundRepository.save(round);
    }

    /**
     * Load questions for a room.
     * Priority 0: customQuestionIds on room (group quiz sets, direct IDs)
     * Priority 1: QuestionSet items (personal sets)
     * Priority 2: legacy RoomQuestionSelection
     * Fallback: random from Question DB by scope/difficulty
     */
    private List<Question> loadQuestionsForRoom(String roomId, int questionCount) {
        Room room = roomRepository.findById(roomId).orElseThrow();

        // Priority 0: direct question IDs stored on room (e.g., from group quiz set)
        if (room.getCustomQuestionIds() != null && !room.getCustomQuestionIds().isEmpty()) {
            List<Question> byIds = questionRepository.findAllById(room.getCustomQuestionIds());
            if (!byIds.isEmpty()) {
                log.info("[RoomQuizService] Room {} dùng {} questions từ customQuestionIds", roomId, byIds.size());
                return byIds;
            }
        }

        if (room.getQuestionSource() == Room.QuestionSource.CUSTOM) {
            // Priority 1: QuestionSet (personal sets)
            // Use the JOIN FETCH variant: this method runs inside @Async (no
            // open Hibernate session by default), so accessing the LAZY
            // userQuestion proxy via .findByQuestionSetIdOrderByOrderIndexAsc
            // would throw LazyInitializationException at toTransientQuestion.
            if (room.getQuestionSetId() != null) {
                List<Question> fromSet = questionSetItemRepo
                        .findByQuestionSetIdWithUserQuestion(room.getQuestionSetId())
                        .stream()
                        .map(i -> toTransientQuestion(i.getUserQuestion()))
                        .toList();
                if (!fromSet.isEmpty()) {
                    log.info("[RoomQuizService] Room {} dùng {} questions từ QuestionSet {}", roomId, fromSet.size(), room.getQuestionSetId());
                    return fromSet;
                }
            }
            // Priority 2: legacy RoomQuestionSelection — same JOIN FETCH
            // requirement for the same async-out-of-session reason.
            List<Question> custom = roomQuestionSelectionRepo
                    .findByRoomIdWithUserQuestion(roomId)
                    .stream()
                    .map(s -> toTransientQuestion(s.getUserQuestion()))
                    .toList();
            if (!custom.isEmpty()) {
                log.info("[RoomQuizService] Room {} dùng {} custom questions (legacy)", roomId, custom.size());
                return custom;
            }
            log.warn("[RoomQuizService] Room {} questionSource=CUSTOM nhưng chưa gán câu hỏi — fallback DB", roomId);
        }

        return loadQuestionsFromDatabase(room, questionCount);
    }

    private List<Question> loadQuestionsFromDatabase(Room room, int questionCount) {
        String scope = room.getBookScope() != null ? room.getBookScope() : "ALL";
        Room.RoomDifficulty diff = room.getDifficulty() != null ? room.getDifficulty() : Room.RoomDifficulty.MIXED;
        // V65: always filter by the room's language — without this, rooms
        // mixed vi/en questions in the same match.
        String lang = room.getLanguage() != null && !room.getLanguage().isBlank() ? room.getLanguage() : "vi";
        PageRequest page = PageRequest.of(0, questionCount);
        List<String> empty = List.of();

        // MBV-2: expand scope (group sentinel / single book) to a concrete book list.
        // Empty = no filter. A filtered query that returns nothing falls back to the
        // whole pool so a sparsely-covered scope never yields an empty room.
        List<String> books = BookScopes.expand(scope);

        if (diff != Room.RoomDifficulty.MIXED) {
            Question.Difficulty qDiff = Question.Difficulty.valueOf(diff.name());
            if (!books.isEmpty()) {
                List<Question> scoped = questionRepository
                        .findRandomQuestionsByLanguageAndBooksAndDifficultyExcludingIds(lang, books, qDiff, empty, page);
                if (!scoped.isEmpty()) return scoped;
            }
            return questionRepository.findRandomQuestionsByLanguageAndDifficultyExcludingIds(lang, qDiff, empty, page);
        }
        if (!books.isEmpty()) {
            List<Question> scoped = questionRepository
                    .findRandomQuestionsByLanguageAndBooksExcludingIds(lang, books, empty, page);
            if (!scoped.isEmpty()) return scoped;
        }
        return questionRepository.findRandomQuestionsByLanguageExcludingIds(lang, empty, page);
    }

    /** Chuyển UserQuestion thành Question transient (không lưu DB) để dùng trong quiz flow. */
    private Question toTransientQuestion(UserQuestion uq) {
        Question q = new Question();
        q.setId(uq.getId());
        q.setContent(uq.getContent());
        q.setOptions(uq.getOptions());
        q.setCorrectAnswer(List.of(uq.getCorrectAnswer()));
        q.setExplanation(uq.getExplanation());
        q.setBook(uq.getBook() != null ? uq.getBook() : "");
        q.setChapter(uq.getChapterStart() != null ? uq.getChapterStart() : 0);
        q.setVerseStart(uq.getVerseStart() != null ? uq.getVerseStart() : 0);
        q.setVerseEnd(uq.getVerseEnd()   != null ? uq.getVerseEnd()   : 0);
        q.setLanguage(uq.getLanguage() != null ? uq.getLanguage() : "vi");
        return q;
    }

    /**
     * Anti-spoiler (security fix 2026-05-23): KHÔNG include correctAnswer
     * trong QUESTION_START broadcast — Quản trò screen subscribe vào cùng
     * topic /topic/room/{id} sẽ thấy đáp án trước khi player kịp trả lời.
     * Đáp án chỉ broadcast qua ROUND_END.correctIndex / QUESTION_REVEALED
     * sau khi round đóng. Server-side scoring vẫn dùng Question.correctAnswer
     * trực tiếp từ entity — không cần đẩy vào DTO.
     */
    private Map<String, Object> buildQuestionDto(Question q) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", q.getId());
        dto.put("content", q.getContent());
        dto.put("options", q.getOptions());
        dto.put("type", q.getType() != null ? q.getType().name() : "multiple_choice_single");
        dto.put("book", q.getBook());
        dto.put("chapter", q.getChapter());
        // DTAG-1: per-question difficulty (easy/medium/hard) so the FE can show
        // a difficulty badge — meaningful in MIXED rooms where each câu varies.
        dto.put("difficulty", q.getDifficulty() != null ? q.getDifficulty().name() : null);
        // INTENTIONAL: no "correctAnswer" — see method javadoc.
        return dto;
    }

    /**
     * Same anti-spoiler rule as {@link #buildQuestionDto}. Currently dead
     * code (no caller) but kept for parity if UserQuestion path is wired.
     */
    private Map<String, Object> buildQuestionDtoFromUserQuestion(UserQuestion q) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", q.getId());
        dto.put("content", q.getContent());
        dto.put("options", q.getOptions());
        dto.put("type", "multiple_choice_single");
        dto.put("book", q.getBook() != null ? q.getBook() : "");
        dto.put("chapter", q.getChapterStart() != null ? q.getChapterStart() : 0);
        // INTENTIONAL: no "correctAnswer" — anti-spoiler.
        return dto;
    }

    private void broadcastGameStarting(String roomId, int countdown) {
        wsController.sendToRoom(roomId, new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.GAME_STARTING,
                Map.of("countdown", countdown, "roomId", roomId)));
    }

    private void safeEndRoom(String roomId) {
        try {
            roomService.endRoom(roomId);
            wsController.broadcastQuizEnd(roomId, List.of());
        } catch (Exception ex) {
            log.error("Lỗi khi kết thúc phòng {}: {}", roomId, ex.getMessage());
        }
    }
}
