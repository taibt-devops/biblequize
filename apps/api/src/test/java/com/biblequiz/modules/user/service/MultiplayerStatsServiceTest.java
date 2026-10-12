package com.biblequiz.modules.user.service;

import com.biblequiz.modules.achievement.repository.UserAchievementRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.service.DailyQuickMatchCounter;
import com.biblequiz.modules.user.dto.WeeklyMultiplayerStatsDTO;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** PCV-6 — MVP = trận có điểm cao nhất, phòng ≥ 3 người (không còn dựa vào thành tích không tồn tại). */
@ExtendWith(MockitoExtension.class)
class MultiplayerStatsServiceTest {

    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private UserAchievementRepository userAchievementRepository;
    @Mock private DailyQuickMatchCounter dailyQuickMatchCounter;
    @InjectMocks private MultiplayerStatsService service;

    private static Room room(String id) {
        Room r = new Room();
        r.setId(id);
        return r;
    }

    private static RoomPlayer p(Room room, String userId, int score, Integer rank) {
        User u = new User();
        u.setId(userId);
        RoomPlayer rp = new RoomPlayer("rp-" + room.getId() + userId, room, u, userId);
        rp.setScore(score);
        rp.setFinalRank(rank);
        return rp;
    }

    @Test
    void mvp_countsTopScoreInRoomsOfThreeOrMore() {
        Room big = room("big"), small = room("small"), lost = room("lost");
        RoomPlayer meBig = p(big, "me", 900, 1);
        RoomPlayer meSmall = p(small, "me", 800, 1); // phòng 2 người — không tính MVP
        RoomPlayer meLost = p(lost, "me", 100, 3);
        when(roomPlayerRepository.findEndedMatchesInWindow(eq("me"), any(), any()))
                .thenReturn(List.of(meBig, meSmall, meLost));
        when(roomPlayerRepository.findByRoomId("big")).thenReturn(new ArrayList<>(List.of(meBig, p(big, "x", 500, 2), p(big, "y", 300, 3))));
        when(roomPlayerRepository.findByRoomId("small")).thenReturn(new ArrayList<>(List.of(meSmall, p(small, "x", 100, 2))));
        when(roomPlayerRepository.findByRoomId("lost")).thenReturn(new ArrayList<>(List.of(meLost, p(lost, "x", 500, 1), p(lost, "y", 300, 2))));

        WeeklyMultiplayerStatsDTO dto = service.getWeeklyStats("me");

        assertEquals(1, dto.mvpCount());
        assertEquals(2, dto.wins());
        assertEquals(3, dto.totalMatches());
        verifyNoInteractions(userAchievementRepository);
    }
}
