package com.biblequiz.modules.room.service.mode;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.service.BattleRoyaleEngine;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.SpeedRaceScoringService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/**
 * Battle Royale — wrong (or missing) answer eliminates, with the all-wrong
 * amnesty handled inside {@link BattleRoyaleEngine}. Final order = finalRank.
 */
@Component
public class BattleRoyaleStrategy implements RoomModeStrategy {

    private static final Logger log = LoggerFactory.getLogger(BattleRoyaleStrategy.class);

    /** PCV-12 (design §2.2): mỗi người 2 mạng. */
    static final int START_LIVES = 2;
    /** Vùng nguy hiểm bắt đầu từ câu thứ 10 (đếm từ 1). */
    static final int DANGER_FROM_QUESTION = 10;
    static final int MIN_SECONDS = 10;

    private final BattleRoyaleEngine battleRoyaleEngine;
    private final SpeedRaceScoringService speedRaceScoringService;

    public BattleRoyaleStrategy(BattleRoyaleEngine battleRoyaleEngine,
                                SpeedRaceScoringService speedRaceScoringService) {
        this.battleRoyaleEngine = battleRoyaleEngine;
        this.speedRaceScoringService = speedRaceScoringService;
    }

    @Override
    public Room.RoomMode mode() {
        return Room.RoomMode.BATTLE_ROYALE;
    }

    @Override
    public String displayName() {
        return "Battle Royale";
    }

    @Override
    public int calculateScore(boolean isCorrect, int timeLimitSeconds, int reactionTimeMs) {
        // Legacy quirk: BR answers score with the Speed Race formula.
        return speedRaceScoringService.calculateScore(isCorrect, timeLimitSeconds, reactionTimeMs);
    }

    @Override
    public Comparator<RoomPlayer> leaderboardComparator() {
        return RoomService.ORDER_BY_FINAL_RANK_ASC;
    }

    /**
     * PCV-12: từ câu 10 thời gian = max(10, gốc − 2×(câu − 9)) và gắn cờ vùng nguy hiểm;
     * câu sau phần câu chính là câu quyết định.
     */
    @Override
    public RoundPlan planRound(GameLoopContext ctx, int index, com.biblequiz.modules.quiz.entity.Question question) {
        int questionNo = index + 1;
        boolean danger = questionNo >= DANGER_FROM_QUESTION;
        int seconds = ctx.timePerQuestion;
        if (danger) {
            seconds = Math.min(ctx.timePerQuestion, Math.max(MIN_SECONDS, ctx.timePerQuestion - 2 * (questionNo - 9)));
        }
        return new RoundPlan(seconds, 1, danger, index >= ctx.regularCount());
    }

    @Override
    public boolean beforeLoop(GameLoopContext ctx) {
        // PCV-12: mọi người vào trận với 2 mạng.
        battleRoyaleEngine.initLives(ctx.roomId, START_LIVES);
        int totalPlayers = (int) ctx.roomPlayerRepository
                .countByRoomIdAndPlayerStatus(ctx.roomId, RoomPlayer.PlayerStatus.ACTIVE);
        ctx.setModeState(totalPlayers);
        // Broadcast initial count
        ctx.ws.broadcastBattleRoyaleUpdate(ctx.roomId, totalPlayers, totalPlayers);
        return true;
    }

    @Override
    public boolean shouldStopBeforeRound(GameLoopContext ctx, long activeCount) {
        return activeCount <= 1; // Game ends when ≤ 1 active player
    }

    @Override
    public boolean afterRound(GameLoopContext ctx, RoomRound round, int questionIndex) {
        // PCV-12: trượt mất 1 mạng (câu quyết định: bị loại ngay); cả nhóm cùng sai thì ân xá.
        boolean showdown = questionIndex >= ctx.regularCount();
        List<BattleRoyaleEngine.EliminatedPlayerInfo> eliminated =
                battleRoyaleEngine.processRoundEnd(ctx.roomId, round.getId(), questionIndex, showdown).eliminated;
        long remaining = ctx.roomPlayerRepository
                .countByRoomIdAndPlayerStatus(ctx.roomId, RoomPlayer.PlayerStatus.ACTIVE);

        // Broadcast từng người bị loại
        for (BattleRoyaleEngine.EliminatedPlayerInfo e : eliminated) {
            ctx.ws.broadcastPlayerEliminated(ctx.roomId, e.userId, e.username, e.rank, (int) remaining);
        }

        if (!eliminated.isEmpty()) {
            int totalPlayers = ctx.<Integer>modeState();
            ctx.ws.broadcastBattleRoyaleUpdate(ctx.roomId, (int) remaining, totalPlayers);
        }
        return false;
    }

    @Override
    public void finishGame(GameLoopContext ctx) {
        // Gán rank cuối cho những người còn lại
        battleRoyaleEngine.assignFinalRanks(ctx.roomId);

        List<RoomService.LeaderboardEntryDTO> finalResults =
                ctx.roomService.buildLeaderboard(ctx.roomId, leaderboardComparator());
        ctx.roomService.endRoom(ctx.roomId);
        ctx.ws.broadcastQuizEnd(ctx.roomId, finalResults);
        log.info("Battle Royale kết thúc cho phòng {}", ctx.roomId);
    }
}
