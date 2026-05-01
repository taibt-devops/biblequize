package com.biblequiz.service;

import com.biblequiz.modules.group.entity.ChurchGroup;
import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.entity.GroupQuizSet;
import com.biblequiz.modules.group.repository.ChurchGroupRepository;
import com.biblequiz.modules.group.repository.GroupAnnouncementRepository;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.group.repository.GroupQuizSetRepository;
import com.biblequiz.modules.group.entity.GroupAnnouncement;
import com.biblequiz.modules.group.service.ChurchGroupService;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChurchGroupServiceTest {

    @Mock
    private ChurchGroupRepository churchGroupRepository;

    @Mock
    private GroupMemberRepository groupMemberRepository;

    @Mock
    private GroupAnnouncementRepository groupAnnouncementRepository;

    @Mock
    private GroupQuizSetRepository groupQuizSetRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserDailyProgressRepository udpRepository;

    @InjectMocks
    private ChurchGroupService churchGroupService;

    private User leaderUser;
    private User memberUser;
    private ChurchGroup testGroup;

    @BeforeEach
    void setUp() {
        leaderUser = new User();
        leaderUser.setId("leader-1");
        leaderUser.setName("Leader");
        leaderUser.setEmail("leader@example.com");

        memberUser = new User();
        memberUser.setId("member-1");
        memberUser.setName("Member");
        memberUser.setEmail("member@example.com");

        testGroup = new ChurchGroup();
        testGroup.setId("group-1");
        testGroup.setName("Test Group");
        testGroup.setGroupCode("ABC123");
        testGroup.setLeader(leaderUser);
        testGroup.setMemberCount(1);
        testGroup.setMaxMembers(200);
    }

    // ── createGroup (TC-GROUP-001) ───────────────────────────────────────────

    @Test
    void createGroup_shouldCreateGroupAndLeaderMember() {
        when(churchGroupRepository.findByGroupCode(anyString())).thenReturn(Optional.empty());
        when(churchGroupRepository.save(any(ChurchGroup.class))).thenAnswer(inv -> inv.getArgument(0));
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> result = churchGroupService.createGroup("My Group", "A description", leaderUser);

        assertNotNull(result.get("id"));
        assertEquals("My Group", result.get("name"));
        assertNotNull(result.get("code"));
        assertEquals(1, result.get("memberCount"));
        verify(churchGroupRepository).save(any(ChurchGroup.class));
        verify(groupMemberRepository).save(argThat(member ->
                member.getRole() == GroupMember.GroupRole.LEADER));
    }

    // ── joinGroup (TC-GROUP-002) ─────────────────────────────────────────────

    @Test
    void joinGroup_shouldCreateMember() {
        when(churchGroupRepository.findByGroupCode("ABC123")).thenReturn(Optional.of(testGroup));
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1")).thenReturn(Optional.empty());
        when(groupMemberRepository.save(any(GroupMember.class))).thenAnswer(inv -> inv.getArgument(0));
        when(churchGroupRepository.save(any(ChurchGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> result = churchGroupService.joinGroup("ABC123", memberUser);

        assertEquals("group-1", result.get("groupId"));
        assertEquals("MEMBER", result.get("role"));
        verify(groupMemberRepository).save(argThat(member ->
                member.getRole() == GroupMember.GroupRole.MEMBER));
        verify(churchGroupRepository).save(argThat(group ->
                group.getMemberCount() == 2));
    }

    // ── joinGroup full (TC-GROUP-006) ────────────────────────────────────────

    @Test
    void joinGroup_fullGroup_shouldThrow() {
        testGroup.setMemberCount(200);
        testGroup.setMaxMembers(200);
        when(churchGroupRepository.findByGroupCode("ABC123")).thenReturn(Optional.of(testGroup));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.joinGroup("ABC123", memberUser));

        assertEquals("Nhom da day", ex.getMessage());
        verify(groupMemberRepository, never()).save(any());
    }

    @Test
    void joinGroup_alreadyMember_shouldThrow() {
        GroupMember existingMember = new GroupMember();
        existingMember.setId("gm-1");
        existingMember.setGroup(testGroup);
        existingMember.setUser(memberUser);

        when(churchGroupRepository.findByGroupCode("ABC123")).thenReturn(Optional.of(testGroup));
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(existingMember));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.joinGroup("ABC123", memberUser));

        assertEquals("Ban da la thanh vien cua nhom nay", ex.getMessage());
    }

    // ── leaveGroup (TC-GROUP-008) ────────────────────────────────────────────

    @Test
    void leaveGroup_normalMember_shouldSucceed() {
        GroupMember member = new GroupMember();
        member.setId("gm-1");
        member.setGroup(testGroup);
        member.setUser(memberUser);
        member.setRole(GroupMember.GroupRole.MEMBER);

        testGroup.setMemberCount(2);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(member));
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));
        when(churchGroupRepository.save(any(ChurchGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> result = churchGroupService.leaveGroup("group-1", memberUser);

        assertEquals(true, result.get("success"));
        verify(groupMemberRepository).delete(member);
        verify(churchGroupRepository).save(argThat(group -> group.getMemberCount() == 1));
    }

    // ── leaveGroup leader (TC-GROUP-009) ─────────────────────────────────────

    @Test
    void leaveGroup_leader_shouldThrowLeaderCannotLeave() {
        GroupMember leaderMember = new GroupMember();
        leaderMember.setId("gm-leader");
        leaderMember.setGroup(testGroup);
        leaderMember.setUser(leaderUser);
        leaderMember.setRole(GroupMember.GroupRole.LEADER);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "leader-1"))
                .thenReturn(Optional.of(leaderMember));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.leaveGroup("group-1", leaderUser));

        assertEquals("LEADER_CANNOT_LEAVE", ex.getMessage());
        verify(groupMemberRepository, never()).delete(any());
    }

    // ── getAnalytics non-leader (TC-GROUP-005) ──────────────────────────────

    @Test
    void getAnalytics_nonLeader_shouldThrow() {
        GroupMember regularMember = new GroupMember();
        regularMember.setId("gm-1");
        regularMember.setGroup(testGroup);
        regularMember.setUser(memberUser);
        regularMember.setRole(GroupMember.GroupRole.MEMBER);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(regularMember));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.getAnalytics("group-1", "member-1"));

        assertEquals("Khong co quyen truy cap", ex.getMessage());
    }

    // ── createQuizSet leader (TC-GROUP-007) ──────────────────────────────────

    @Test
    void createQuizSet_leader_shouldSucceed() {
        GroupMember leaderMember = new GroupMember();
        leaderMember.setId("gm-leader");
        leaderMember.setGroup(testGroup);
        leaderMember.setUser(leaderUser);
        leaderMember.setRole(GroupMember.GroupRole.LEADER);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "leader-1"))
                .thenReturn(Optional.of(leaderMember));
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));
        when(groupQuizSetRepository.save(any(GroupQuizSet.class))).thenAnswer(inv -> inv.getArgument(0));

        List<String> questionIds = List.of("q-1", "q-2", "q-3");
        Map<String, Object> result = churchGroupService.createQuizSet("group-1", "leader-1", "Quiz 1", questionIds);

        assertNotNull(result.get("id"));
        assertEquals("Quiz 1", result.get("name"));
        assertEquals(questionIds, result.get("questionIds"));
        verify(groupQuizSetRepository).save(any(GroupQuizSet.class));
    }

    @Test
    void createQuizSet_regularMember_shouldThrow() {
        GroupMember regularMember = new GroupMember();
        regularMember.setId("gm-1");
        regularMember.setGroup(testGroup);
        regularMember.setUser(memberUser);
        regularMember.setRole(GroupMember.GroupRole.MEMBER);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(regularMember));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.createQuizSet("group-1", "member-1", "Quiz 1", List.of("q-1")));

        assertEquals("Khong co quyen tao quiz set", ex.getMessage());
        verify(groupQuizSetRepository, never()).save(any());
    }

    // ── updateGroup ───────────────────────────────────────────────────────

    @Test
    void updateGroup_leaderCanUpdate() {
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));
        when(churchGroupRepository.save(any(ChurchGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> result = churchGroupService.updateGroup("group-1", "leader-1",
                "New Name", "New Desc", true, 100);

        assertEquals("New Name", result.get("name"));
        assertEquals("New Desc", result.get("description"));
        assertEquals(true, result.get("isPublic"));
        assertEquals(100, result.get("maxMembers"));
    }

    @Test
    void updateGroup_nonLeader_shouldThrow() {
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));

        assertThrows(RuntimeException.class,
                () -> churchGroupService.updateGroup("group-1", "member-1", "X", null, null, null));
    }

    @Test
    void updateGroup_maxMembersBelowCurrent_shouldThrow() {
        testGroup.setMemberCount(10);
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.updateGroup("group-1", "leader-1", null, null, null, 5));

        assertTrue(ex.getMessage().contains("khong the nho hon"));
    }

    // ── deleteGroup ───────────────────────────────────────────────────────

    @Test
    void deleteGroup_leaderCanDelete() {
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));
        when(churchGroupRepository.save(any(ChurchGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> result = churchGroupService.deleteGroup("group-1", "leader-1");

        assertEquals(true, result.get("success"));
        verify(groupMemberRepository).deleteByGroupId("group-1");
        verify(churchGroupRepository, atLeast(1)).save(argThat(g -> g.getDeletedAt() != null));
    }

    @Test
    void deleteGroup_nonLeader_shouldThrow() {
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));

        assertThrows(RuntimeException.class,
                () -> churchGroupService.deleteGroup("group-1", "member-1"));
    }

    // ── kickMember ────────────────────────────────────────────────────────

    @Test
    void kickMember_leaderCanKickMember() {
        GroupMember leaderMember = new GroupMember();
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        leaderMember.setUser(leaderUser);

        GroupMember targetMember = new GroupMember();
        targetMember.setRole(GroupMember.GroupRole.MEMBER);
        targetMember.setUser(memberUser);

        testGroup.setMemberCount(2);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "leader-1"))
                .thenReturn(Optional.of(leaderMember));
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(targetMember));
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));
        when(churchGroupRepository.save(any(ChurchGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> result = churchGroupService.kickMember("group-1", "leader-1", "member-1");

        assertEquals(true, result.get("success"));
        verify(groupMemberRepository).delete(targetMember);
    }

    @Test
    void kickMember_cannotKickSelf() {
        assertThrows(RuntimeException.class,
                () -> churchGroupService.kickMember("group-1", "leader-1", "leader-1"));
    }

    @Test
    void kickMember_cannotKickLeader() {
        GroupMember modMember = new GroupMember();
        modMember.setRole(GroupMember.GroupRole.MOD);
        modMember.setUser(memberUser);

        GroupMember leaderMember = new GroupMember();
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        leaderMember.setUser(leaderUser);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(modMember));
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "leader-1"))
                .thenReturn(Optional.of(leaderMember));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.kickMember("group-1", "member-1", "leader-1"));

        assertEquals("Khong the kick leader", ex.getMessage());
    }

    @Test
    void kickMember_regularMember_shouldThrow() {
        GroupMember regularMember = new GroupMember();
        regularMember.setRole(GroupMember.GroupRole.MEMBER);
        regularMember.setUser(memberUser);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(regularMember));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.kickMember("group-1", "member-1", "other-user"));

        assertEquals("Chi leader hoac mod moi duoc kick", ex.getMessage());
    }

    // ── createAnnouncement ────────────────────────────────────────────────

    @Test
    void createAnnouncement_leaderCanCreate() {
        GroupMember leaderMember = new GroupMember();
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        leaderMember.setUser(leaderUser);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "leader-1"))
                .thenReturn(Optional.of(leaderMember));
        when(churchGroupRepository.findById("group-1")).thenReturn(Optional.of(testGroup));
        when(groupAnnouncementRepository.save(any(GroupAnnouncement.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> result = churchGroupService.createAnnouncement("group-1", "leader-1", "Hello group!");

        assertEquals("Hello group!", result.get("body"));
        assertNotNull(result.get("id"));
        verify(groupAnnouncementRepository).save(any(GroupAnnouncement.class));
    }

    @Test
    void createAnnouncement_tooLong_shouldThrow() {
        String longContent = "x".repeat(501);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> churchGroupService.createAnnouncement("group-1", "leader-1", longContent));

        assertTrue(ex.getMessage().contains("500"));
    }

    @Test
    void createAnnouncement_regularMember_shouldThrow() {
        GroupMember regularMember = new GroupMember();
        regularMember.setRole(GroupMember.GroupRole.MEMBER);
        regularMember.setUser(memberUser);

        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "member-1"))
                .thenReturn(Optional.of(regularMember));

        assertThrows(RuntimeException.class,
                () -> churchGroupService.createAnnouncement("group-1", "member-1", "Test"));
    }

    // ── getAnnouncements ──────────────────────────────────────────────────

    @Test
    void getAnnouncements_shouldReturnPaginatedResults() {
        GroupAnnouncement a1 = new GroupAnnouncement();
        a1.setId("ann-1");
        a1.setContent("First");
        a1.setAuthor(leaderUser);

        when(groupAnnouncementRepository.findByGroupIdPaginated(eq("group-1"), any()))
                .thenReturn(List.of(a1));
        when(groupAnnouncementRepository.countByGroupId("group-1")).thenReturn(1L);

        Map<String, Object> result = churchGroupService.getAnnouncements("group-1", 20, 0);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        assertEquals(1, items.size());
        assertEquals("First", items.get(0).get("body"));
        assertEquals(1L, result.get("total"));
        assertEquals(false, result.get("hasMore"));
    }
}
