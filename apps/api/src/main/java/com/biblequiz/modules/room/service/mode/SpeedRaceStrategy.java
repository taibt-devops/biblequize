package com.biblequiz.modules.room.service.mode;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.service.RankAssigner;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.SpeedRaceScoringService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/**
 * Default mode — the race for points. Wraps {@link SpeedRaceScoringService};
 * the standard loop needs no extra hooks beyond the shared structure.
 */
@Component
public class SpeedRaceStrategy implements RoomModeStrategy {

    private static final Logger log = LoggerFactory.getLogger(SpeedRaceStrategy.class);

    private final SpeedRaceScoringService speedRaceScoringService;

    public SpeedRaceStrategy(SpeedRaceScoringService speedRaceScoringService) {
        this.speedRaceScoringService = speedRaceScoringService;
    }

    @Override
    public Room.RoomMode mode() {
        return Room.RoomMode.SPEED_RACE;
    }

    @Override
    public String displayName() {
        return "Speed Race";
    }

    @Override
    public int calculateScore(boolean isCorrect, int timeLimitSeconds, int reactionTimeMs) {
        return speedRaceScoringService.calculateScore(isCorrect, timeLimitSeconds, reactionTimeMs);
    }

    /** PCV-11 (design §2.1): đúng liên tiếp lần 2 +10, lần 3 +20, từ lần 4 trở đi +30. */
    @Override
    public int streakBonus(int streak) {
        if (streak >= 4) return 30;
        if (streak == 3) return 20;
        if (streak == 2) return 10;
        return 0;
    }

    /** PCV-11: câu chốt — câu cuối nhân đôi toàn bộ điểm của câu đó. */
    @Override
    public RoundPlan planRound(GameLoopContext ctx, int index, com.biblequiz.modules.quiz.entity.Question question) {
        boolean last = index == ctx.questions.size() - 1;
        return new RoundPlan(ctx.timePerQuestion, last ? 2 : 1, false, false);
    }

    @Override
    public Comparator<RoomPlayer> leaderboardComparator() {
        return RoomService.ORDER_BY_FINAL_RANK_ASC;
    }

    @Override
    public void finishGame(GameLoopContext ctx) {
        // PCV-6: chốt hạng (điểm → câu đúng → tốc độ; bằng hệt thì đồng hạng) trước khi công bố.
        List<RoomPlayer> players = ctx.roomPlayerRepository.findByRoomId(ctx.roomId);
        RankAssigner.assign(players, RankAssigner.BY_SCORE_ACCURACY_SPEED);
        ctx.roomPlayerRepository.saveAll(players);
        List<RoomService.LeaderboardEntryDTO> finalResults =
                ctx.roomService.buildLeaderboard(ctx.roomId, leaderboardComparator());
        ctx.roomService.endRoom(ctx.roomId);
        ctx.ws.broadcastQuizEnd(ctx.roomId, finalResults);
        log.info("Speed Race kết thúc cho phòng {}", ctx.roomId);
    }
}
