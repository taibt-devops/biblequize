package com.biblequiz.modules.room.service.mode;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.service.RankAssigner;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.SequentialScoringService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * GROUP_LIVE_SEQUENTIAL (co-play) — latch-driven flow that does not share
 * the standard loop: no pause/end-early checks, no ROUND_END broadcast
 * (QUESTION_REVEALED instead), no between-question sleep, and the host
 * advances questions manually. Kept as a custom game loop on purpose.
 */
@Component
public class SequentialStrategy implements RoomModeStrategy {

    private static final Logger log = LoggerFactory.getLogger(SequentialStrategy.class);

    private final SequentialScoringService sequentialScoringService;

    public SequentialStrategy(SequentialScoringService sequentialScoringService) {
        this.sequentialScoringService = sequentialScoringService;
    }

    @Override
    public Room.RoomMode mode() {
        return Room.RoomMode.GROUP_LIVE_SEQUENTIAL;
    }

    @Override
    public String displayName() {
        return "Group Live Sequential";
    }

    @Override
    public int calculateScore(boolean isCorrect, int timeLimitSeconds, int reactionTimeMs) {
        // Sequential: đúng = 100, sai = 0 — no time bonus.
        return sequentialScoringService.calculateScore(isCorrect);
    }

    @Override
    public boolean defersAnswerFeedback() {
        return true;
    }

    @Override
    public Comparator<RoomPlayer> leaderboardComparator() {
        return RoomService.ORDER_BY_FINAL_RANK_ASC;
    }

    @Override
    public boolean hasCustomGameLoop() {
        return true;
    }

    /**
     * Sequential mode: chờ all players trả lời (early-wake nếu xong sớm) → reveal
     * đáp án + per-player answers → đợi host bấm "Sang câu tiếp" → next question.
     * Khác Speed Race ở chỗ score đơn giản (đúng=100, sai=0) và pause cho thảo luận.
     */
    @Override
    public void runGameLoop(GameLoopContext ctx) throws InterruptedException {
        String roomId = ctx.roomId;
        List<Question> questions = ctx.questions;

        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            RoomRound round = ctx.roundSaver.save(roomId,
                    new RoomRound(UUID.randomUUID().toString(), null, i, q.getId(), LocalDateTime.now()));
            ctx.roomStateService.setCurrentRoundId(roomId, round.getId());
            // PCV-11a: đáp án của vòng giữ ở máy chủ (chấm được câu trong bộ câu tự soạn).
            ctx.roomStateService.setAnswerKey(roomId,
                    com.biblequiz.modules.room.service.RoomStateService.AnswerKey.of(q));

            int activePlayers = (int) ctx.roomPlayerRepository
                    .countByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ACTIVE);
            sequentialScoringService.beginRound(roomId, activePlayers);

            ctx.ws.broadcastQuestionStart(roomId, i, questions.size(),
                    ctx.questionDtoFactory.build(q), ctx.timePerQuestion);

            // Wait until all answered OR timeout (timer câu hỏi + 1 giây ân hạn như các mode khác — câu trả lời
            // gửi ở giây cuối, tới trễ vì mạng, vẫn được chấm trước khi công bố đáp án).
            boolean allAnswered = sequentialScoringService.awaitAllAnsweredOrTimeoutMs(roomId,
                    ctx.timePerQuestion * 1000L + com.biblequiz.modules.room.service.RoomAnswerProcessor.ROUND_GRACE_MS);
            log.info("[Sequential] room={} q={} allAnswered={} answered={}/{}",
                    roomId, i, allAnswered,
                    sequentialScoringService.answeredCount(roomId),
                    sequentialScoringService.totalPlayers(roomId));

            round.setEndedAt(LocalDateTime.now());
            ctx.roomRoundRepository.save(round);

            // Reveal — gather per-player answers + correct answer
            ctx.ws.broadcastQuestionRevealed(roomId, round.getId(), q.getCorrectAnswer().get(0), q.getExplanation());

            // Wait host's manual advance (bounded by 10-min safety)
            boolean leaderAdvanced = sequentialScoringService.awaitLeaderAdvance(roomId);
            sequentialScoringService.clearRound(roomId);
            if (!leaderAdvanced) {
                log.warn("[Sequential] room={} leader advance timeout — auto-skip to next", roomId);
            }
        }

        finishGame(ctx);
    }

    @Override
    public void finishGame(GameLoopContext ctx) {
        // PCV-6: chốt hạng giống Đua tốc độ.
        List<RoomPlayer> players = ctx.roomPlayerRepository.findByRoomId(ctx.roomId);
        RankAssigner.assign(players, RankAssigner.BY_SCORE_ACCURACY_SPEED);
        ctx.roomPlayerRepository.saveAll(players);
        List<RoomService.LeaderboardEntryDTO> finalResults =
                ctx.roomService.buildLeaderboard(ctx.roomId, leaderboardComparator());
        ctx.roomService.endRoom(ctx.roomId);
        ctx.ws.broadcastQuizEnd(ctx.roomId, finalResults);
        log.info("Group Live Sequential kết thúc cho phòng {}", ctx.roomId);
    }
}
