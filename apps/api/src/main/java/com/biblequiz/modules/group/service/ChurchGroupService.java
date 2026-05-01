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
        String code = generateGroupCode();

        ChurchGroup group = new ChurchGroup();
        group.setId(UUID.randomUUID().toString());
        group.setName(name);
        group.setGroupCode(code);
        group.setDescription(description);
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
        result.put("memberCount", group.getMemberCount());
        result.put("role", primary.getRole().name());
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

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", group.getId());
        result.put("name", group.getName());
        result.put("code", group.getGroupCode());
        result.put("description", group.getDescription());
        result.put("avatarUrl", group.getAvatarUrl());
        result.put("isPublic", group.getIsPublic());
        result.put("maxMembers", group.getMaxMembers());
        result.put("memberCount", group.getMemberCount());
        result.put("leaderId", group.getLeader().getId());
        result.put("createdAt", group.getCreatedAt());
        result.put("members", memberList);
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

        int totalMembers = groupMemberRepository.countByGroupId(groupId);

        // Count members who played today (have UserDailyProgress with questionsCounted > 0)
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        long activeToday = members.stream()
                .filter(m -> {
                    Optional<UserDailyProgress> udp = udpRepository.findByUserIdAndDate(m.getUser().getId(), today);
                    return udp.isPresent() && udp.get().getQuestionsCounted() != null && udp.get().getQuestionsCounted() > 0;
                })
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMembers", totalMembers);
        result.put("activeToday", (int) activeToday);
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
