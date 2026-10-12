package com.biblequiz.modules.room.service.mode;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;

import java.util.Comparator;

/**
 * Per-mode behavior of the multiplayer quiz flow. One Spring bean per
 * {@link Room.RoomMode}, collected into {@link RoomModeRegistry}.
 *
 * <p>Structure-only contract: implementations wrap the pre-existing
 * engines/scoring services and must not change scoring, timing or STOMP
 * payload shapes.
 */
public interface RoomModeStrategy {

    Room.RoomMode mode();

    /** Label used in the runner's log lines (kept identical to legacy logs). */
    String displayName();

    /**
     * Server-side score for one validated answer. Legacy quirk kept on
     * purpose: every non-sequential mode scores with the Speed Race formula.
     */
    int calculateScore(boolean isCorrect, int timeLimitSeconds, int reactionTimeMs);

    /**
     * True when ANSWER_SUBMITTED must hide correctness/points until the
     * reveal step (GROUP_LIVE_SEQUENTIAL).
     */
    default boolean defersAnswerFeedback() {
        return false;
    }

    /**
     * PCV-11: điểm thưởng khi đúng liên tiếp {@code streak} câu (đã tính câu này).
     * Mặc định không thưởng — chỉ Đua tốc độ dùng.
     */
    default int streakBonus(int streak) {
        return 0;
    }

    /**
     * PCV-11/12: cách chạy câu thứ {@code index} — thời gian, hệ số, cờ vùng nguy hiểm/câu quyết định.
     * Mặc định: thời gian của phòng, ×1.
     */
    default RoundPlan planRound(GameLoopContext ctx, int index, com.biblequiz.modules.quiz.entity.Question question) {
        return RoundPlan.standard(ctx.timePerQuestion);
    }

    /** Ordering of this mode's final leaderboard. */
    Comparator<RoomPlayer> leaderboardComparator();

    // ── Hooks for the standard game loop (RoomQuizService.runStandardLoop) ──

    /**
     * Runs once before the question loop. Return false to abort the game —
     * the hook is then responsible for ending the room + QUIZ_END broadcast.
     */
    default boolean beforeLoop(GameLoopContext ctx) throws InterruptedException {
        return true;
    }

    /** Stop condition evaluated at the top of each round. */
    default boolean shouldStopBeforeRound(GameLoopContext ctx, long activeCount) {
        return false;
    }

    /** Number of submissions that closes the round early (waitForRoundEnd). */
    default int expectedAnswers(GameLoopContext ctx, long activeCount) {
        return (int) activeCount;
    }

    /** Runs after the ROUND_END broadcast. Return true to leave the loop. */
    default boolean afterRound(GameLoopContext ctx, RoomRound round, int questionIndex)
            throws InterruptedException {
        return false;
    }

    /** Final results + endRoom + QUIZ_END broadcast (and the final log line). */
    void finishGame(GameLoopContext ctx);

    /** Modes whose round flow cannot share the standard loop (Sequential). */
    default boolean hasCustomGameLoop() {
        return false;
    }

    /** Full-loop override for {@link #hasCustomGameLoop()} modes. */
    default void runGameLoop(GameLoopContext ctx) throws InterruptedException {
        throw new UnsupportedOperationException("No custom game loop for " + mode());
    }
}
