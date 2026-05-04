package com.biblequiz.modules.group.service;

import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Group streak (Option A): a day counts toward the streak if at least 1 member
 * has UserDailyProgress with questionsCounted > 0 on that day. currentStreak is
 * the trailing run from today; longestStreak is the max run within a 365-day window.
 * Days are bucketed by Asia/Ho_Chi_Minh (UTC+7) to align with VN user expectation.
 */
@Service
public class GroupStreakService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int LONGEST_LOOKBACK_DAYS = 365;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private UserDailyProgressRepository udpRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getGroupStreak(String groupId) {
        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        int totalMembers = members.size();
        Map<String, Object> result = new LinkedHashMap<>();

        if (totalMembers == 0) {
            result.put("currentStreak", 0);
            result.put("longestStreak", 0);
            result.put("todayActiveCount", 0);
            result.put("totalMembers", 0);
            return result;
        }

        List<String> userIds = members.stream()
                .map(m -> m.getUser().getId())
                .collect(Collectors.toList());

        LocalDate today = LocalDate.now(VN_ZONE);
        LocalDate windowStart = today.minusDays(LONGEST_LOOKBACK_DAYS - 1);

        Set<LocalDate> activeDays = new HashSet<>(
                udpRepository.findDistinctActiveDatesByUserIdsBetween(userIds, windowStart, today));

        int currentStreak = 0;
        for (LocalDate d = today; !d.isBefore(windowStart); d = d.minusDays(1)) {
            if (activeDays.contains(d)) {
                currentStreak++;
            } else {
                break;
            }
        }

        int longestStreak = 0;
        int run = 0;
        for (LocalDate d = windowStart; !d.isAfter(today); d = d.plusDays(1)) {
            if (activeDays.contains(d)) {
                run++;
                if (run > longestStreak) longestStreak = run;
            } else {
                run = 0;
            }
        }

        long todayActiveCount = udpRepository.countDistinctActiveMembersOnDate(userIds, today);

        result.put("currentStreak", currentStreak);
        result.put("longestStreak", longestStreak);
        result.put("todayActiveCount", (int) todayActiveCount);
        result.put("totalMembers", totalMembers);
        return result;
    }
}
