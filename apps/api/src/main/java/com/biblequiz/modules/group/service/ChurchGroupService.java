package com.biblequiz.modules.group.service;

import com.biblequiz.modules.group.entity.ChurchGroup;
import com.biblequiz.modules.group.entity.GroupAnnouncement;
import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.entity.GroupQuizSet;
import com.biblequiz.modules.group.repository.ChurchGroupRepository;
import com.biblequiz.modules.group.repository.GroupAnnouncementRepository;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.group.repository.GroupQuizSetRepository;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
public class ChurchGroupService {

    @Autowired
    private ChurchGroupRepository churchGroupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private GroupAnnouncementRepository groupAnnouncementRepository;

    @Autowired
    private GroupQuizSetRepository groupQuizSetRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserDailyProgressRepository udpRepository;

    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int CODE_LENGTH = 6;
    private final SecureRandom random = new SecureRandom();

    public Map<String, Object> createGroup(String name, String description, User leader) {
        return createGroup(name, description, true, leader);
    }

    public Map<String, Object> createGroup(String name, String description, boolean isPublic, User leader) {
        String code = generateGroupCode();

        ChurchGroup group = new ChurchGroup();
        group.setId(UUID.randomUUID().toString());
        group.setName(name);
        group.setGroupCode(code);
        group.setDescription(description);
        group.setIsPublic(isPublic);
        group.setLeader(leader);
        group.setMemberCount(1);
        churchGroupRepository.save(group);

        GroupMember leaderMember = new GroupMember();
        leaderMember.setId(UUID.randomUUID().toString());
        leaderMember.setGroup(group);
        leaderMember.setUser(leader);
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        groupMemberRepository.save(leaderMember);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", group.getId());
        result.put("name", group.getName());
        result.put("code", group.getGroupCode());
        result.put("isPublic", group.getIsPublic());
        result.put("memberCount", group.getMemberCount());
        return result;
    }

    public Map<String, Object> joinGroup(String groupCode, User user) {
        ChurchGroup group = churchGroupRepository.findByGroupCode(groupCode.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));

        if (group.isFull()) {
            throw new RuntimeException("Nhom da day");
        }

        Optional<GroupMember> existing = groupMemberRepository.findByGroupIdAndUserId(group.getId(), user.getId());
        if (existing.isPresent()) {
            throw new RuntimeException("Ban da la thanh vien cua nhom nay");
        }

        GroupMember member = new GroupMember();
        member.setId(UUID.randomUUID().toString());
        member.setGroup(group);
        member.setUser(user);
        member.setRole(GroupMember.GroupRole.MEMBER);
        groupMemberRepository.save(member);

        group.setMemberCount(group.getMemberCount() + 1);
        churchGroupRepository.save(group);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("groupId", group.getId());
        result.put("role", member.getRole().name());
        return result;
    }

    public Map<String, Object> leaveGroup(String groupId, User user) {
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId())
                .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));

        if (member.getRole() == GroupMember.GroupRole.LEADER) {
            throw new RuntimeException("LEADER_CANNOT_LEAVE");
        }

        groupMemberRepository.delete(member);

        ChurchGroup group = churchGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));
        group.setMemberCount(Math.max(0, group.getMemberCount() - 1));
        churchGroupRepository.save(group);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        return result;
    }

    /**
     * Returns a small "is the user in any group?" payload for the
     * Home mode-card live hint (HM-P1-1). When the user is in
     * multiple groups, picks the first by joined-at order — the home
     * card just needs ONE name to render "Trong {groupName}".
     */
    public Map<String, Object> getMyGroup(String userId) {
        List<GroupMember> memberships = groupMemberRepository.findByUserId(userId);
        if (memberships.isEmpty()) {
            return Map.of("hasGroup", false);
        }
        GroupMember primary = memberships.get(0);
        ChurchGroup group = primary.getGroup();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasGroup", true);
        result.put("groupId", group.getId());
        result.put("groupName", group.getName());
        result.put("memberCount", groupMemberRepository.countByGroupId(group.getId()));
        result.put("role", primary.getRole().name());
        return result;
    }

    /**
     * List ALL groups the user belongs to with embedded weekly summary
     * (memberCount, avgScore, accuracy, activeWeek, lastActivityAt, myRank).
     * Powers the multi-group /groups index page. Stats are NOT role-gated —
     * any member can see the group's basic weekly numbers.
     */
    public List<Map<String, Object>> listMyGroupsWithSummary(String userId) {
        List<GroupMember> memberships = groupMemberRepository.findByUserId(userId);
        if (memberships.isEmpty()) return new ArrayList<>();

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate weekStart = today.minusDays(6);

        List<Map<String, Object>> result = new ArrayList<>();
        for (GroupMember mySeat : memberships) {
            ChurchGroup group = mySeat.getGroup();
            List<GroupMember> members = groupMemberRepository.findByGroupId(group.getId());

            long totalPoints = 0;
            long totalQuestions = 0;
            int activeMembers = 0;
            int myWeekPoints = 0;
            List<Integer> memberWeekPoints = new ArrayList<>();
            LocalDateTime maxActivity = null;

            for (GroupMember m : members) {
                String mUserId = m.getUser().getId();
                if (m.getLastActiveAt() != null
                        && (maxActivity == null || m.getLastActiveAt().isAfter(maxActivity))) {
                    maxActivity = m.getLastActiveAt();
                }
                int memberPts = 0;
                int memberQs = 0;
                for (UserDailyProgress udp : udpRepository.findByUserIdAndDateBetween(mUserId, weekStart, today)) {
                    memberPts += udp.getPointsCounted() != null ? udp.getPointsCounted() : 0;
                    memberQs += udp.getQuestionsCounted() != null ? udp.getQuestionsCounted() : 0;
                }
                if (memberQs > 0) activeMembers++;
                totalPoints += memberPts;
                totalQuestions += memberQs;
                memberWeekPoints.add(memberPts);
                if (mUserId.equals(userId)) myWeekPoints = memberPts;
            }

            int avgScore = activeMembers > 0
                    ? (int) Math.round((double) totalPoints / activeMembers)
                    : 0;
            int accuracy = totalQuestions > 0
                    ? (int) Math.min(100, Math.round((double) totalPoints / (totalQuestions * 10) * 100))
                    : 0;
            final int myPoints = myWeekPoints;
            long myRank = 1 + memberWeekPoints.stream().filter(p -> p > myPoints).count();

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", group.getId());
            entry.put("name", group.getName());
            entry.put("description", group.getDescription());
            entry.put("avatarUrl", group.getAvatarUrl());
            entry.put("code", group.getGroupCode());
            entry.put("isPublic", group.getIsPublic());
            entry.put("role", mySeat.getRole().name());
            entry.put("memberCount", members.size());
            entry.put("avgScore", avgScore);
            entry.put("accuracy", accuracy);
            entry.put("activeWeek", activeMembers);
            entry.put("lastActivityAt", maxActivity);
            entry.put("myWeekPoints", myWeekPoints);
            entry.put("myRank", (int) myRank);
            result.add(entry);
        }
        return result;
    }

    public Map<String, Object> getGroupDetails(String groupId) {
        ChurchGroup group = churchGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);

        List<Map<String, Object>> memberList = members.stream().map(m -> {
            Map<String, Object> memberMap = new LinkedHashMap<>();
            memberMap.put("id", m.getUser().getId());
            memberMap.put("name", m.getUser().getName());
            memberMap.put("avatarUrl", m.getUser().getAvatarUrl());
            memberMap.put("role", m.getRole().name());
            memberMap.put("joinedAt", m.getJoinedAt());
            return memberMap;
        }).collect(Collectors.toList());

        // Self-heal: cached memberCount may drift from actual member rows (legacy data,
        // race conditions, soft-delete edge cases). Always reconcile on read.
        int actualCount = members.size();
        if (actualCount != group.getMemberCount()) {
            group.setMemberCount(actualCount);
            churchGroupRepository.save(group);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", group.getId());
        result.put("name", group.getName());
        result.put("code", group.getGroupCode());
        result.put("description", group.getDescription());
        result.put("avatarUrl", group.getAvatarUrl());
        result.put("isPublic", group.getIsPublic());
        result.put("maxMembers", group.getMaxMembers());
        result.put("memberCount", actualCount);
        result.put("leaderId", group.getLeader().getId());
        result.put("createdAt", group.getCreatedAt());
        result.put("members", memberList);
        return result;
    }

    /**
     * Discovery widget on the empty-state Groups page. Returns up to {@code limit}
     * public, non-deleted, non-locked groups. {@code featured=true} sorts by
     * memberCount (engagement proxy); {@code featured=false} sorts by createdAt
     * (newest first). No auth required — intentionally public-readable.
     */
    public List<Map<String, Object>> listPublicGroups(int limit, boolean featured) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, safeLimit);
        List<ChurchGroup> groups = featured
                ? churchGroupRepository.findPublicGroupsByMemberCountDesc(pageable)
                : churchGroupRepository.findPublicGroupsByCreatedAtDesc(pageable);

        return groups.stream().map(g -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", g.getId());
            entry.put("name", g.getName());
            entry.put("code", g.getGroupCode());
            entry.put("description", g.getDescription());
            entry.put("avatarUrl", g.getAvatarUrl());
            entry.put("memberCount", g.getMemberCount());
            entry.put("maxMembers", g.getMaxMembers());
            entry.put("createdAt", g.getCreatedAt());
            return entry;
        }).collect(Collectors.toList());
    }

    /**
     * Paginated, searchable, filterable members list for the GroupDetail
     * "members" tab. Sort options: score (joins UserDailyProgress 7-day
     * window), tier (proxy via score), activity (lastActiveAt), joined
     * (joinedAt). Filter values: leader / mod / member / inactive.
     * Inactive = lastActiveAt < now() - 7 days (or NULL fallback).
     *
     * <p>The cursor is a 1-based offset encoded as String for parity with
     * future opaque-cursor migrations; "null cursor" means start at 0.
     */
    public Map<String, Object> listMembers(String groupId, String search, String sort, String order,
                                            String filter, int limit, String cursor) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        int offset = 0;
        if (cursor != null && !cursor.isBlank()) {
            try { offset = Math.max(0, Integer.parseInt(cursor)); } catch (NumberFormatException ignored) {}
        }

        List<GroupMember> all = groupMemberRepository.findByGroupId(groupId);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate weekStart = today.minusDays(6);
        LocalDateTime inactiveThreshold = LocalDateTime.now(ZoneOffset.UTC).minusDays(7);

        // Pre-compute weekly score per member for sort=score (single pass)
        Map<String, Integer> weeklyScores = new HashMap<>();
        for (GroupMember m : all) {
            int score = udpRepository.findByUserIdAndDateBetween(m.getUser().getId(), weekStart, today).stream()
                    .mapToInt(u -> u.getPointsCounted() != null ? u.getPointsCounted() : 0)
                    .sum();
            weeklyScores.put(m.getUser().getId(), score);
        }

        // Filter
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase();
        String normalizedFilter = filter == null ? "" : filter.trim().toLowerCase();

        List<GroupMember> filtered = all.stream()
                .filter(m -> {
                    if (!normalizedSearch.isEmpty()) {
                        String name = m.getUser().getName();
                        if (name == null || !name.toLowerCase().contains(normalizedSearch)) return false;
                    }
                    if (normalizedFilter.isEmpty()) return true;
                    if ("leader".equals(normalizedFilter)) return m.getRole() == GroupMember.GroupRole.LEADER;
                    if ("mod".equals(normalizedFilter)) return m.getRole() == GroupMember.GroupRole.MOD;
                    if ("member".equals(normalizedFilter)) return m.getRole() == GroupMember.GroupRole.MEMBER;
                    if ("inactive".equals(normalizedFilter)) {
                        LocalDateTime last = m.getLastActiveAt();
                        return last == null || last.isBefore(inactiveThreshold);
                    }
                    return true;
                })
                .collect(Collectors.toList());

        // Sort
        String sortKey = sort == null ? "score" : sort.toLowerCase();
        boolean asc = "asc".equalsIgnoreCase(order);
        Comparator<GroupMember> cmp;
        switch (sortKey) {
            case "joined":
                cmp = Comparator.comparing(GroupMember::getJoinedAt,
                        Comparator.nullsLast(Comparator.naturalOrder()));
                break;
            case "activity":
                cmp = Comparator.comparing(GroupMember::getLastActiveAt,
                        Comparator.nullsLast(Comparator.naturalOrder()));
                break;
            case "tier":
                // Proxy: same direction as score ranking
                cmp = Comparator.comparingInt(m -> -weeklyScores.getOrDefault(m.getUser().getId(), 0));
                break;
            case "score":
            default:
                cmp = Comparator.comparingInt(m -> -weeklyScores.getOrDefault(m.getUser().getId(), 0));
                break;
        }
        if (asc) cmp = cmp.reversed();
        filtered.sort(cmp);

        int total = filtered.size();
        int end = Math.min(offset + safeLimit, total);
        List<GroupMember> page = offset < total ? filtered.subList(offset, end) : List.of();

        List<Map<String, Object>> items = page.stream().map(m -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId", m.getUser().getId());
            row.put("name", m.getUser().getName());
            row.put("avatarUrl", m.getUser().getAvatarUrl());
            row.put("role", m.getRole().name());
            row.put("joinedAt", m.getJoinedAt());
            row.put("lastActiveAt", m.getLastActiveAt());
            row.put("score", weeklyScores.getOrDefault(m.getUser().getId(), 0));
            return row;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("total", total);
        result.put("nextCursor", end < total ? String.valueOf(end) : null);
        result.put("hasMore", end < total);
        return result;
    }

    /**
     * Promote/demote a group member. Only the LEADER can call. Cannot
     * change another LEADER's role (single-leader invariant — transfer
     * ownership is a separate flow not part of this sprint).
     */
    public Map<String, Object> changeMemberRole(String groupId, String requesterId, String targetUserId, String newRole) {
        if (newRole == null || newRole.isBlank()) {
            throw new RuntimeException("Vai tro moi khong duoc de trong");
        }
        GroupMember.GroupRole parsed;
        try {
            parsed = GroupMember.GroupRole.valueOf(newRole.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Vai tro khong hop le: " + newRole);
        }
        if (parsed == GroupMember.GroupRole.LEADER) {
            throw new RuntimeException("Khong the gan vai tro LEADER (chuyen quyen leader la quy trinh rieng)");
        }

        GroupMember requester = groupMemberRepository.findByGroupIdAndUserId(groupId, requesterId)
                .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));
        if (requester.getRole() != GroupMember.GroupRole.LEADER) {
            throw new RuntimeException("Chi leader moi duoc doi vai tro thanh vien");
        }

        if (requesterId.equals(targetUserId)) {
            throw new RuntimeException("Khong the doi vai tro chinh minh");
        }

        GroupMember target = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
                .orElseThrow(() -> new RuntimeException("Nguoi dung khong phai thanh vien cua nhom"));
        if (target.getRole() == GroupMember.GroupRole.LEADER) {
            throw new RuntimeException("Khong the doi vai tro cua leader hien tai");
        }

        target.setRole(parsed);
        groupMemberRepository.save(target);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", targetUserId);
        result.put("role", parsed.name());
        return result;
    }

    public List<Map<String, Object>> getLeaderboard(String groupId, String period) {
        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        List<Map<String, Object>> entries = members.stream().map(m -> {
            String userId = m.getUser().getId();
            int score = 0;
            int questionsAnswered = 0;

            if ("daily".equalsIgnoreCase(period)) {
                Optional<UserDailyProgress> udp = udpRepository.findByUserIdAndDate(userId, today);
                if (udp.isPresent()) {
                    score = udp.get().getPointsCounted() != null ? udp.get().getPointsCounted() : 0;
                    questionsAnswered = udp.get().getQuestionsCounted() != null ? udp.get().getQuestionsCounted() : 0;
                }
            } else if ("weekly".equalsIgnoreCase(period)) {
                LocalDate weekStart = today.minusDays(6);
                List<UserDailyProgress> udps = udpRepository.findByUserIdAndDateBetween(userId, weekStart, today);
                score = udps.stream().mapToInt(u -> u.getPointsCounted() != null ? u.getPointsCounted() : 0).sum();
                questionsAnswered = udps.stream().mapToInt(u -> u.getQuestionsCounted() != null ? u.getQuestionsCounted() : 0).sum();
            } else {
                // all_time
                List<UserDailyProgress> all = udpRepository.findByUserIdOrderByDateDesc(userId);
                score = all.stream().mapToInt(u -> u.getPointsCounted() != null ? u.getPointsCounted() : 0).sum();
                questionsAnswered = all.stream().mapToInt(u -> u.getQuestionsCounted() != null ? u.getQuestionsCounted() : 0).sum();
            }

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("userId", userId);
            entry.put("name", m.getUser().getName());
            entry.put("avatarUrl", m.getUser().getAvatarUrl());
            entry.put("role", m.getRole().name());
            entry.put("period", period);
            entry.put("score", score);
            entry.put("questionsAnswered", questionsAnswered);
            return entry;
        }).collect(Collectors.toList());

        // Sort by score descending
        entries.sort((a, b) -> Integer.compare((int) b.get("score"), (int) a.get("score")));
        return entries;
    }

    public Map<String, Object> getAnalytics(String groupId, String requesterId) {
        GroupMember requester = groupMemberRepository.findByGroupIdAndUserId(groupId, requesterId)
                .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));

        if (requester.getRole() != GroupMember.GroupRole.LEADER && requester.getRole() != GroupMember.GroupRole.MOD) {
            throw new RuntimeException("Khong co quyen truy cap");
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate weekStart = today.minusDays(6);

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        int totalMembers = members.size();

        // ── Active counts ───────────────────────────────────────────────
        long activeToday = 0;
        long activeWeek = 0;
        long inactiveCount = 0;
        // ── Aggregates over the past 7 days for KPI panel ────────────────
        long totalQuestionsWeek = 0;
        long totalPointsWeek = 0;
        // ── Per-member tally for top contributors ratting ────────────────
        List<Map<String, Object>> contributorRows = new ArrayList<>();
        // ── Daily bucket for weekly activity chart (Mon..Sun aligned to today-6..today) ──
        int[] dailyActiveCounts = new int[7];

        for (GroupMember m : members) {
            String userId = m.getUser().getId();
            Optional<UserDailyProgress> todayUdp = udpRepository.findByUserIdAndDate(userId, today);
            boolean playedToday = todayUdp.isPresent()
                    && todayUdp.get().getQuestionsCounted() != null
                    && todayUdp.get().getQuestionsCounted() > 0;
            if (playedToday) activeToday++;

            List<UserDailyProgress> weekUdps = udpRepository.findByUserIdAndDateBetween(userId, weekStart, today);
            int memberWeekPoints = 0;
            int memberWeekQuestions = 0;
            boolean activeAnyDay = false;
            for (UserDailyProgress udp : weekUdps) {
                int q = udp.getQuestionsCounted() != null ? udp.getQuestionsCounted() : 0;
                int p = udp.getPointsCounted() != null ? udp.getPointsCounted() : 0;
                memberWeekPoints += p;
                memberWeekQuestions += q;
                if (q > 0) {
                    activeAnyDay = true;
                    int dayIdx = (int) java.time.temporal.ChronoUnit.DAYS.between(weekStart, udp.getDate());
                    if (dayIdx >= 0 && dayIdx < 7) {
                        dailyActiveCounts[dayIdx] += 1;
                    }
                }
            }
            if (activeAnyDay) activeWeek++;
            else inactiveCount++;

            totalQuestionsWeek += memberWeekQuestions;
            totalPointsWeek += memberWeekPoints;

            if (memberWeekQuestions > 0) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId", userId);
                row.put("name", m.getUser().getName());
                row.put("avatarUrl", m.getUser().getAvatarUrl());
                row.put("score", memberWeekPoints);
                row.put("questionsAnswered", memberWeekQuestions);
                contributorRows.add(row);
            }
        }

        // Top contributors: sort by score DESC, take 5
        contributorRows.sort((a, b) -> Integer.compare((int) b.get("score"), (int) a.get("score")));
        List<Map<String, Object>> topContributors = contributorRows.stream().limit(5).collect(Collectors.toList());

        // Weekly activity series — index 0 = oldest day, 6 = today
        List<Map<String, Object>> weeklyActivity = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            Map<String, Object> day = new LinkedHashMap<>();
            day.put("date", weekStart.plusDays(i).toString());
            day.put("activeCount", dailyActiveCounts[i]);
            weeklyActivity.add(day);
        }

        int avgScore = activeWeek > 0 ? (int) Math.round((double) totalPointsWeek / activeWeek) : 0;
        // Accuracy proxy: pointsPerQuestion ≈ 10 in BibleQuiz scoring. Pure derivation
        // until UserDailyProgress carries an explicit correct-count column.
        int accuracy = totalQuestionsWeek > 0
                ? (int) Math.min(100, Math.round((double) totalPointsWeek / (totalQuestionsWeek * 10) * 100))
                : 0;
        // Approximate quiz session count as questions / 10 (5-question quizzes are also possible
        // but 10-question is the dominant default). Real distinct-session count would require
        // joining QuizSession — defer until that becomes a sprint priority.
        int totalQuizzes = (int) Math.round((double) totalQuestionsWeek / 10);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMembers", totalMembers);
        result.put("activeToday", (int) activeToday);
        result.put("activeWeek", (int) activeWeek);
        result.put("inactiveCount", (int) inactiveCount);
        result.put("avgScore", avgScore);
        result.put("accuracy", accuracy);
        result.put("totalQuizzes", totalQuizzes);
        result.put("totalPointsWeek", (int) totalPointsWeek);
        result.put("totalQuestionsWeek", (int) totalQuestionsWeek);
        result.put("weeklyActivity", weeklyActivity);
        result.put("topContributors", topContributors);
        return result;
    }

    public Map<String, Object> createQuizSet(String groupId, String userId, String name, List<String> questionIds) {
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));

        if (member.getRole() != GroupMember.GroupRole.LEADER && member.getRole() != GroupMember.GroupRole.MOD) {
            throw new RuntimeException("Khong co quyen tao quiz set");
        }

        ChurchGroup group = churchGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));

        GroupQuizSet quizSet = new GroupQuizSet();
        quizSet.setId(UUID.randomUUID().toString());
        quizSet.setGroup(group);
        quizSet.setCreatedBy(member.getUser());
        quizSet.setName(name);
        quizSet.setQuestionIds(questionIds);
        groupQuizSetRepository.save(quizSet);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", quizSet.getId());
        result.put("name", quizSet.getName());
        result.put("questionIds", questionIds);
        result.put("createdAt", quizSet.getCreatedAt());
        return result;
    }

    // ── PATCH /groups/{id} ─────────────────────────────────────────────────

    public Map<String, Object> updateGroup(String groupId, String requesterId,
                                            String name, String description, Boolean isPublic, Integer maxMembers) {
        ChurchGroup group = churchGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));

        if (group.isDeleted()) throw new RuntimeException("Nhom da bi xoa");

        if (!group.getLeader().getId().equals(requesterId)) {
            throw new RuntimeException("Chi leader moi duoc cap nhat nhom");
        }

        if (name != null && !name.isBlank()) group.setName(name);
        if (description != null) group.setDescription(description);
        if (isPublic != null) group.setIsPublic(isPublic);
        if (maxMembers != null) {
            if (maxMembers < group.getMemberCount()) {
                throw new RuntimeException("maxMembers khong the nho hon so thanh vien hien tai (" + group.getMemberCount() + ")");
            }
            group.setMaxMembers(maxMembers);
        }

        churchGroupRepository.save(group);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", group.getId());
        result.put("name", group.getName());
        result.put("description", group.getDescription());
        result.put("isPublic", group.getIsPublic());
        result.put("maxMembers", group.getMaxMembers());
        return result;
    }

    // ── DELETE /groups/{id} ──────────────────────────────────────────────

    @Transactional
    public Map<String, Object> deleteGroup(String groupId, String requesterId) {
        ChurchGroup group = churchGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));

        if (!group.getLeader().getId().equals(requesterId)) {
            throw new RuntimeException("Chi leader moi duoc xoa nhom");
        }

        // Soft delete
        group.setDeletedAt(LocalDateTime.now(ZoneOffset.UTC));
        churchGroupRepository.save(group);

        // Remove all members
        groupMemberRepository.deleteByGroupId(groupId);
        group.setMemberCount(0);
        churchGroupRepository.save(group);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("groupId", groupId);
        return result;
    }

    // ── DELETE /groups/{id}/members/{userId} ─────────────────────────────

    public Map<String, Object> kickMember(String groupId, String requesterId, String targetUserId) {
        if (requesterId.equals(targetUserId)) {
            throw new RuntimeException("Khong the kick chinh minh");
        }

        GroupMember requester = groupMemberRepository.findByGroupIdAndUserId(groupId, requesterId)
                .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));

        if (requester.getRole() != GroupMember.GroupRole.LEADER && requester.getRole() != GroupMember.GroupRole.MOD) {
            throw new RuntimeException("Chi leader hoac mod moi duoc kick");
        }

        GroupMember target = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
                .orElseThrow(() -> new RuntimeException("Nguoi dung khong phai thanh vien cua nhom"));

        if (target.getRole() == GroupMember.GroupRole.LEADER) {
            throw new RuntimeException("Khong the kick leader");
        }

        groupMemberRepository.delete(target);

        ChurchGroup group = churchGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));
        group.setMemberCount(Math.max(0, group.getMemberCount() - 1));
        churchGroupRepository.save(group);

        Map<String, Object> kickResult = new LinkedHashMap<>();
        kickResult.put("success", true);
        kickResult.put("kickedUserId", targetUserId);
        return kickResult;
    }

    // ── POST /groups/{id}/announcements ──────────────────────────────────

    public Map<String, Object> createAnnouncement(String groupId, String userId, String content) {
        if (content == null || content.isBlank()) {
            throw new RuntimeException("Noi dung thong bao khong duoc de trong");
        }
        if (content.length() > 500) {
            throw new RuntimeException("Noi dung thong bao khong duoc vuot qua 500 ky tu");
        }

        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new RuntimeException("Ban khong phai thanh vien cua nhom"));

        if (member.getRole() != GroupMember.GroupRole.LEADER && member.getRole() != GroupMember.GroupRole.MOD) {
            throw new RuntimeException("Chi leader hoac mod moi duoc tao thong bao");
        }

        ChurchGroup group = churchGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Nhom khong ton tai"));

        GroupAnnouncement announcement = new GroupAnnouncement();
        announcement.setId(UUID.randomUUID().toString());
        announcement.setGroup(group);
        announcement.setAuthor(member.getUser());
        announcement.setContent(content);
        groupAnnouncementRepository.save(announcement);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", announcement.getId());
        result.put("body", announcement.getContent());
        result.put("authorId", member.getUser().getId());
        result.put("author", member.getUser().getName());
        result.put("createdAt", announcement.getCreatedAt());
        return result;
    }

    // ── GET /groups/{id}/announcements ───────────────────────────────────

    public Map<String, Object> getAnnouncements(String groupId, int limit, int offset) {
        List<GroupAnnouncement> announcements = groupAnnouncementRepository
                .findByGroupIdPaginated(groupId, PageRequest.of(offset / Math.max(1, limit), limit));

        List<Map<String, Object>> items = announcements.stream().map(a -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", a.getId());
            item.put("body", a.getContent());
            item.put("authorId", a.getAuthor().getId());
            item.put("author", a.getAuthor().getName());
            item.put("createdAt", a.getCreatedAt());
            return item;
        }).collect(Collectors.toList());

        long total = groupAnnouncementRepository.countByGroupId(groupId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("total", total);
        result.put("hasMore", offset + limit < total);
        return result;
    }

    private String generateGroupCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            code = sb.toString();
        } while (churchGroupRepository.findByGroupCode(code).isPresent());
        return code;
    }
}
