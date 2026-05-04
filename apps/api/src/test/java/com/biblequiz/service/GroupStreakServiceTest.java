package com.biblequiz.service;

import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.group.service.GroupStreakService;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GroupStreakServiceTest {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock
    private GroupMemberRepository groupMemberRepository;

    @Mock
    private UserDailyProgressRepository udpRepository;

    @InjectMocks
    private GroupStreakService groupStreakService;

    private final String groupId = "group-1";

    private GroupMember member(String userId) {
        User u = new User();
        u.setId(userId);
        GroupMember m = new GroupMember();
        m.setUser(u);
        return m;
    }

    private void stubMembers() {
        when(groupMemberRepository.findByGroupId(groupId)).thenReturn(Arrays.asList(
                member("u1"), member("u2"), member("u3")));
    }

    @Test
    void emptyGroup_returnsZeros() {
        when(groupMemberRepository.findByGroupId("empty")).thenReturn(new ArrayList<>());

        Map<String, Object> result = groupStreakService.getGroupStreak("empty");

        assertEquals(0, result.get("currentStreak"));
        assertEquals(0, result.get("longestStreak"));
        assertEquals(0, result.get("todayActiveCount"));
        assertEquals(0, result.get("totalMembers"));
        verifyNoInteractions(udpRepository);
    }

    @Test
    void noActiveDays_currentAndLongestZero() {
        stubMembers();
        when(udpRepository.findDistinctActiveDatesByUserIdsBetween(anyList(), any(), any()))
                .thenReturn(new ArrayList<>());
        when(udpRepository.countDistinctActiveMembersOnDate(anyList(), any())).thenReturn(0L);

        Map<String, Object> result = groupStreakService.getGroupStreak(groupId);

        assertEquals(0, result.get("currentStreak"));
        assertEquals(0, result.get("longestStreak"));
        assertEquals(0, result.get("todayActiveCount"));
        assertEquals(3, result.get("totalMembers"));
    }

    @Test
    void trailingThreeDays_currentStreakIsThree() {
        stubMembers();
        LocalDate today = LocalDate.now(VN_ZONE);
        List<LocalDate> active = Arrays.asList(today, today.minusDays(1), today.minusDays(2));

        when(udpRepository.findDistinctActiveDatesByUserIdsBetween(anyList(), any(), any()))
                .thenReturn(active);
        when(udpRepository.countDistinctActiveMembersOnDate(anyList(), eq(today))).thenReturn(2L);

        Map<String, Object> result = groupStreakService.getGroupStreak(groupId);

        assertEquals(3, result.get("currentStreak"));
        assertEquals(3, result.get("longestStreak"));
        assertEquals(2, result.get("todayActiveCount"));
    }

    @Test
    void gapYesterday_currentZeroLongestPriorRun() {
        stubMembers();
        LocalDate today = LocalDate.now(VN_ZONE);
        // active: today missing, yesterday missing, prior 4 consecutive days
        List<LocalDate> active = Arrays.asList(
                today.minusDays(2), today.minusDays(3), today.minusDays(4), today.minusDays(5));

        when(udpRepository.findDistinctActiveDatesByUserIdsBetween(anyList(), any(), any()))
                .thenReturn(active);
        when(udpRepository.countDistinctActiveMembersOnDate(anyList(), eq(today))).thenReturn(0L);

        Map<String, Object> result = groupStreakService.getGroupStreak(groupId);

        assertEquals(0, result.get("currentStreak"));
        assertEquals(4, result.get("longestStreak"));
    }

    @Test
    void todayActiveYesterdayGap_currentOne() {
        stubMembers();
        LocalDate today = LocalDate.now(VN_ZONE);
        List<LocalDate> active = Arrays.asList(today, today.minusDays(2));

        when(udpRepository.findDistinctActiveDatesByUserIdsBetween(anyList(), any(), any()))
                .thenReturn(active);
        when(udpRepository.countDistinctActiveMembersOnDate(anyList(), eq(today))).thenReturn(1L);

        Map<String, Object> result = groupStreakService.getGroupStreak(groupId);

        assertEquals(1, result.get("currentStreak"));
        assertEquals(1, result.get("longestStreak"));
    }
}
