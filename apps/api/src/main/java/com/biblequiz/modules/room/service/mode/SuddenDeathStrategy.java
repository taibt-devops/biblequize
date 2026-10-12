package com.biblequiz.modules.room.service.mode;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.SpeedRaceScoringService;
import com.biblequiz.modules.room.service.SuddenDeathMatchService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/**
 * Sudden Death — 1v1 king-of-the-hill driven by
 * {@link SuddenDeathMatchService}. The round structure still fits the
 * standard loop (expected answers is just a constant 2); the match
 * choreography (MATCH_END pause + next-challenger pull) lives in afterRound.
 */
@Component
public class SuddenDeathStrategy implements RoomModeStrategy {

    private static final Logger log = LoggerFactory.getLogger(SuddenDeathStrategy.class);

    private final SuddenDeathMatchService suddenDeathMatchService;
    private final SpeedRaceScoringService speedRaceScoringService;

    public SuddenDeathStrategy(SuddenDeathMatchService suddenDeathMatchService,
                               SpeedRaceScoringService speedRaceScoringService) {
        this.suddenDeathMatchService = suddenDeathMatchService;
        this.speedRaceScoringService = speedRaceScoringService;
    }

    @Override
    public Room.RoomMode mode() {
        return Room.RoomMode.SUDDEN_DEATH;
    }

    @Override
    public String displayName() {
        return "Sudden Death";
    }

    @Override
    public int calculateScore(boolean isCorrect, int timeLimitSeconds, int reactionTimeMs) {
        // Legacy quirk: SD answers score with the Speed Race formula (match
        // outcome itself is decided by SuddenDeathMatchService, not points).
        return speedRaceScoringService.calculateScore(isCorrect, timeLimitSeconds, reactionTimeMs);
    }

    @Override
    public Comparator<RoomPlayer> leaderboardComparator() {
        return RoomService.ORDER_BY_FINAL_RANK_ASC;
    }

    @Override
    public boolean beforeLoop(GameLoopContext ctx) {
        // Init queue: all players to SPECTATOR, sorted by join time
        suddenDeathMatchService.initializeQueue(ctx.roomId);

        // Start first match
        SuddenDeathMatchService.MatchInfo match = suddenDeathMatchService.startNextMatch(ctx.roomId);
        if (match == null) {
            ctx.roomService.endRoom(ctx.roomId);
            ctx.ws.broadcastQuizEnd(ctx.roomId, List.of());
            return false;
        }
        ctx.ws.broadcastMatchStart(ctx.roomId, match.championId, match.championName, match.championStreak,
                match.challengerId, match.challengerName, suddenDeathMatchService.getQueueSize(ctx.roomId));
        return true;
    }

    @Override
    public int expectedAnswers(GameLoopContext ctx, long activeCount) {
        // Sudden Death: only champion + challenger play this round (1v1).
        // End as soon as both have submitted.
        return 2;
    }

    @Override
    public boolean afterRound(GameLoopContext ctx, RoomRound round, int questionIndex)
            throws InterruptedException {
        // Process match outcome
        SuddenDeathMatchService.MatchResult result =
                suddenDeathMatchService.processRound(ctx.roomId, round.getId());
        if (result.outcome == SuddenDeathMatchService.MatchOutcome.MATCH_ENDED) {
            ctx.ws.broadcastMatchEnd(ctx.roomId,
                    result.winner.userId, result.winner.username, result.winner.streak,
                    result.loser.userId, result.loser.username);

            Thread.sleep(2000L); // pause before next match

            // PCV-15: mọi người đã đấu và vua đủ chuỗi ⇒ kết thúc (ngân sách câu là giới hạn còn lại).
            if (suddenDeathMatchService.shouldEndAfterMatch(ctx.roomId)) {
                return true;
            }
            // Start next match if challengers remain
            if (suddenDeathMatchService.hasNextChallenger(ctx.roomId)) {
                SuddenDeathMatchService.MatchInfo match = suddenDeathMatchService.startNextMatch(ctx.roomId);
                if (match != null) {
                    ctx.ws.broadcastMatchStart(ctx.roomId, match.championId, match.championName,
                            match.championStreak, match.challengerId, match.challengerName,
                            suddenDeathMatchService.getQueueSize(ctx.roomId));
                } else {
                    return true;
                }
            } else {
                // No more challengers → game over (legacy kept the
                // between-question sleep before breaking out)
                if (questionIndex < ctx.questions.size() - 1) {
                    Thread.sleep(ctx.betweenQuestionDelayMs);
                }
                return true;
            }
        }
        return false;
    }

    @Override
    public void finishGame(GameLoopContext ctx) {
        suddenDeathMatchService.assignFinalRanks(ctx.roomId);
        List<RoomService.LeaderboardEntryDTO> finalResults =
                ctx.roomService.buildLeaderboard(ctx.roomId, leaderboardComparator());
        ctx.roomService.endRoom(ctx.roomId);
        ctx.ws.broadcastQuizEnd(ctx.roomId, finalResults);
        log.info("Sudden Death kết thúc cho phòng {}", ctx.roomId);
    }
}
