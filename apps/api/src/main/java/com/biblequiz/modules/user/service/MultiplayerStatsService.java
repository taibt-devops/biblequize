package com.biblequiz.modules.user.service;

import com.biblequiz.modules.achievement.repository.UserAchievementRepository;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.service.DailyQuickMatchCounter;
import com.biblequiz.modules.user.dto.WeeklyMultiplayerStatsDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

/**
 * MPP-2 — Aggregate weekly multiplayer stats for the Phòng Chơi sidebar
 * widget. Replaces the meaningless "Vị trí #1" with multiplayer-context
 * data: wins this week, win rate, MVP achievement count.
 *
 * Week boundary = Monday 00:00 (system zone — matches existing leaderboard
 * period convention; see UserDailyProgressRepository week queries).
 *
 * MVP category constant follows Achievement.category convention used in
 * existing seed data ("MULTIPLAYER_MVP"). Caller can override category via
 * the static field if seeding diverges in future.
 */
@Service
public class MultiplayerStatsService {

    public static final String MVP_CATEGORY = "MULTIPLAYER_MVP";

    @Autowired private RoomPlayerRepository roomPlayerRepository;
    @Autowired private UserAchievementRepository userAchievementRepository;
    @Autowired private DailyQuickMatchCounter dailyQuickMatchCounter;

    public WeeklyMultiplayerStatsDTO getWeeklyStats(String userId) {
        LocalDateTime weekStart = computeWeekStart();
        LocalDateTime now = LocalDateTime.now();

        List<RoomPlayer> matches = roomPlayerRepository.findEndedMatchesInWindow(userId, weekStart, now);
        long totalMatches = matches.size();
        // PCV-20: thắng chỉ tính phòng có ít nhất 2 người thật (thắng toàn người máy không phải thắng).
        long wins = matches.stream()
                .filter(rp -> rp.getFinalRank() != null && rp.getFinalRank() == 1)
                .filter(rp -> humans(rp) >= 2)
                .count();
        double winRate = totalMatches == 0 ? 0.0 : (double) wins / totalMatches;

        // PCV-6: MVP = trận người chơi có điểm cao nhất trong phòng ≥ 3 người. Trước đây đếm
        // thành tích category MULTIPLAYER_MVP — category này chưa từng được trao nên luôn 0.
        long mvpCount = matches.stream().filter(this::isMvp).count();

        return new WeeklyMultiplayerStatsDTO(
                "weekly",
                weekStart,
                wins,
                totalMatches,
                winRate,
                mvpCount,
                dailyQuickMatchCounter.getRemainingToday(userId));
    }

    private boolean isMvp(RoomPlayer me) {
        if (me.getScore() == null || me.getScore() <= 0) return false;
        List<RoomPlayer> roster = roomPlayerRepository.findByRoomId(me.getRoom().getId());
        // PCV-20: phòng phải có ít nhất 3 người thật.
        if (roster.stream().filter(p -> !p.isBot()).count() < 3) return false;
        int top = roster.stream().mapToInt(p -> p.getScore() != null ? p.getScore() : 0).max().orElse(0);
        return me.getScore() == top;
    }

    private long humans(RoomPlayer me) {
        return roomPlayerRepository.findByRoomId(me.getRoom().getId()).stream().filter(p -> !p.isBot()).count();
    }

    /** Monday 00:00 of the current calendar week, system zone. */
    private LocalDateTime computeWeekStart() {
        return LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atTime(LocalTime.MIDNIGHT);
    }
}
