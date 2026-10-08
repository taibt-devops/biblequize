package com.biblequiz.api;

import com.biblequiz.modules.adminai.AIGenerationService;
import com.biblequiz.modules.group.entity.ChurchGroup;
import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.entity.GroupQuizSet;
import com.biblequiz.modules.group.repository.ChurchGroupRepository;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.group.repository.GroupQuizSetRepository;
import com.biblequiz.modules.group.service.ChurchGroupService;
import com.biblequiz.modules.group.service.GroupStreakService;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChurchGroupController.class)
class ChurchGroupControllerTest extends BaseControllerTest {

    @MockBean
    private ChurchGroupService churchGroupService;

    @MockBean
    private GroupStreakService groupStreakService;

    @MockBean
    private GroupQuizSetRepository groupQuizSetRepository;

    @MockBean
    private ChurchGroupRepository churchGroupRepository;

    // GroupMemberRepository moved to BaseControllerTest (shared cross-test).

    @MockBean
    private QuestionRepository questionRepository;

    @MockBean
    private AIGenerationService aiGenerationService;

    @MockBean
    private com.biblequiz.modules.adminai.provider.AIProviderRouter aiProviderRouter;

    @MockBean
    private com.biblequiz.modules.adminai.quota.AIQuotaService aiQuotaService;

    @MockBean
    private RoomService roomService;

    @MockBean
    private RoomRepository roomRepository;

    @MockBean
    private RoomPlayerRepository roomPlayerRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private com.biblequiz.modules.group.service.GroupQuizSetMasteryService masteryService;

    @MockBean
    private com.biblequiz.modules.quiz.service.SessionService sessionService;

    @MockBean
    private com.biblequiz.modules.quiz.repository.QuizSessionRepository quizSessionRepository;

    @MockBean
    private com.biblequiz.modules.group.repository.GroupQuizSetMasteryRepository masteryRepository;

    @MockBean
    private com.biblequiz.modules.group.service.GroupCollectiveGrowthService collectiveGrowthService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test");
        testUser.setEmail("test@example.com");
        testUser.setRole("USER");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
    }

    // ── POST /api/groups ─────────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void createGroup_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("id", "group-1");
        serviceResult.put("name", "My Group");
        serviceResult.put("code", "ABC123");
        serviceResult.put("memberCount", 1);

        when(churchGroupService.createGroup(eq("My Group"), eq("A church group"), anyBoolean(), any(User.class)))
                .thenReturn(serviceResult);

        mockMvc.perform(post("/api/groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"My Group\",\"description\":\"A church group\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.group.id").value("group-1"))
                .andExpect(jsonPath("$.group.name").value("My Group"));
    }

    // ── POST /api/groups/join ────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void joinGroup_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("groupId", "group-1");
        serviceResult.put("role", "MEMBER");

        when(churchGroupService.joinGroup(eq("ABC123"), any(User.class)))
                .thenReturn(serviceResult);

        mockMvc.perform(post("/api/groups/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"ABC123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.groupId").value("group-1"));
    }

    // ── DELETE /api/groups/{id}/leave ─────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void leaveGroup_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("success", true);

        when(churchGroupService.leaveGroup(eq("group-1"), any(User.class)))
                .thenReturn(serviceResult);

        mockMvc.perform(delete("/api/groups/group-1/leave"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── GET /api/groups/{id} ─────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getGroupDetails_shouldReturn200() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("id", "group-1");
        serviceResult.put("name", "My Group");
        serviceResult.put("memberCount", 5);

        when(churchGroupService.getGroupDetails(eq("group-1"), any())).thenReturn(serviceResult);

        mockMvc.perform(get("/api/groups/group-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.group.id").value("group-1"));
    }

    // ── GET /api/groups/{id}/collective-growth (BL-23) ───────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getCollectiveGrowth_asMember_returns200() throws Exception {
        GroupMember member = new GroupMember();
        member.setRole(GroupMember.GroupRole.MEMBER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(member));
        Map<String, Object> growth = new LinkedHashMap<>();
        growth.put("totalLearned", 120L);
        growth.put("nextMilestone", 250L);
        when(collectiveGrowthService.getCollectiveGrowth("group-1")).thenReturn(growth);

        mockMvc.perform(get("/api/groups/group-1/collective-growth"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.growth.totalLearned").value(120))
                .andExpect(jsonPath("$.growth.nextMilestone").value(250));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getCollectiveGrowth_nonMember_returns400() throws Exception {
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/groups/group-1/collective-growth"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ── GET /api/groups/me (HM-P1-1 Home live hint) ──────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getMyGroup_inGroup_returnsHasGroupTrueWithName() throws Exception {
        Map<String, Object> serviceResult = new LinkedHashMap<>();
        serviceResult.put("hasGroup", true);
        serviceResult.put("groupId", "group-42");
        serviceResult.put("groupName", "Hội Thánh Phước Lành");
        serviceResult.put("memberCount", 12);
        serviceResult.put("role", "MEMBER");

        when(churchGroupService.getMyGroup("user-1")).thenReturn(serviceResult);

        mockMvc.perform(get("/api/groups/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasGroup").value(true))
                .andExpect(jsonPath("$.groupId").value("group-42"))
                .andExpect(jsonPath("$.groupName").value("Hội Thánh Phước Lành"))
                .andExpect(jsonPath("$.memberCount").value(12))
                .andExpect(jsonPath("$.role").value("MEMBER"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getMyGroup_notInAnyGroup_returnsHasGroupFalse() throws Exception {
        when(churchGroupService.getMyGroup("user-1")).thenReturn(Map.of("hasGroup", false));

        mockMvc.perform(get("/api/groups/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasGroup").value(false));
    }

    @Test
    void getMyGroup_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/groups/me"))
                .andExpect(status().isUnauthorized());
    }

    // ── GET /api/groups/{id}/leaderboard (BL-16: retired → 410 Gone) ─────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getLeaderboard_isRetired_returns410WithDeprecatedCode() throws Exception {
        mockMvc.perform(get("/api/groups/group-1/leaderboard"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("LEADERBOARD_DEPRECATED"));
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    // ── POST /api/groups/{id}/live-rooms (Feature A — renamed from /live-quiz per spec v1.1) ──────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void createLiveQuiz_asLeader_returnsRoomInfo() throws Exception {
        // Membership: LEADER
        GroupMember leaderMember = new GroupMember();
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(leaderMember));

        // Quiz set belongs to group
        ChurchGroup group = new ChurchGroup();
        group.setId("group-1");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setName("Sáng Thế Ký");
        qs.setGroup(group);
        qs.setQuestionIds(List.of("q1", "q2", "q3"));
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        // RoomService.createRoom returns a stub room
        Room createdRoom = new Room();
        createdRoom.setId("room-99");
        createdRoom.setRoomCode("NVQ8X3");
        createdRoom.setRoomName("Sáng Thế Ký");
        createdRoom.setMode(Room.RoomMode.GROUP_LIVE_SEQUENTIAL);
        createdRoom.setHost(testUser);
        when(roomService.createRoom(anyString(), any(User.class), anyInt(), anyInt(), anyInt(),
                eq(Room.RoomMode.GROUP_LIVE_SEQUENTIAL), anyBoolean(),
                any(), anyString(), any(), any())).thenReturn(createdRoom);
        when(roomRepository.save(any(Room.class))).thenReturn(createdRoom);

        mockMvc.perform(post("/api/groups/group-1/live-rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quizSetId\":\"qs-1\",\"timePerQuestion\":30}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.room.id").value("room-99"))
                .andExpect(jsonPath("$.room.roomCode").value("NVQ8X3"))
                .andExpect(jsonPath("$.room.mode").value("GROUP_LIVE_SEQUENTIAL"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createLiveQuiz_asMember_returns403() throws Exception {
        GroupMember memberMember = new GroupMember();
        memberMember.setRole(GroupMember.GroupRole.MEMBER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(memberMember));

        mockMvc.perform(post("/api/groups/group-1/live-rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quizSetId\":\"qs-1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createLiveQuiz_missingQuizSetId_returns400() throws Exception {
        GroupMember leaderMember = new GroupMember();
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(leaderMember));

        mockMvc.perform(post("/api/groups/group-1/live-rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createLiveQuiz_quizSetWrongGroup_returns403() throws Exception {
        GroupMember leaderMember = new GroupMember();
        leaderMember.setRole(GroupMember.GroupRole.LEADER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(leaderMember));

        ChurchGroup otherGroup = new ChurchGroup();
        otherGroup.setId("group-other");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(otherGroup);
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        mockMvc.perform(post("/api/groups/group-1/live-rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quizSetId\":\"qs-1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void createGroup_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"My Group\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SPEC v1.1 §15.2 implementation gaps — controller wiring tests
    // Verify HTTP status codes + structured "code" field that FE branches on.
    // ═══════════════════════════════════════════════════════════════════════

    // ── GAP-E: createGroup MAX_GROUPS_OWNED → 422 + code ─────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void createGroup_maxOwned_returns422WithStructuredCode() throws Exception {
        when(churchGroupService.createGroup(anyString(), any(), anyBoolean(), any(User.class)))
                .thenThrow(new RuntimeException("MAX_GROUPS_OWNED"));

        mockMvc.perform(post("/api/groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Third Group\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("MAX_GROUPS_OWNED"))
                .andExpect(jsonPath("$.message").exists());
    }

    // ── GAP-F: joinGroup MAX_GROUPS_JOINED → 422 + code ──────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void joinGroup_maxJoined_returns422WithStructuredCode() throws Exception {
        when(churchGroupService.joinGroup(eq("ABC123"), any(User.class)))
                .thenThrow(new RuntimeException("MAX_GROUPS_JOINED"));

        mockMvc.perform(post("/api/groups/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"ABC123\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MAX_GROUPS_JOINED"));
    }

    // ── GAP-L: joinGroup KICK_COOLDOWN_ACTIVE → 422 + code ───────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void joinGroup_recentlyKicked_returns422WithCooldownCode() throws Exception {
        when(churchGroupService.joinGroup(eq("ABC123"), any(User.class)))
                .thenThrow(new RuntimeException("KICK_COOLDOWN_ACTIVE"));

        mockMvc.perform(post("/api/groups/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"ABC123\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("KICK_COOLDOWN_ACTIVE"));
    }

    // ── GAP-L: kickMember accepts optional reason body ───────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void kickMember_withReason_passesReasonToService() throws Exception {
        Map<String, Object> ok = new LinkedHashMap<>();
        ok.put("success", true);
        when(churchGroupService.kickMember(eq("group-1"), anyString(), eq("member-1"), eq("spam")))
                .thenReturn(ok);

        mockMvc.perform(delete("/api/groups/group-1/members/member-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"spam\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void kickMember_withoutBody_passesNullReason() throws Exception {
        Map<String, Object> ok = new LinkedHashMap<>();
        ok.put("success", true);
        when(churchGroupService.kickMember(eq("group-1"), anyString(), eq("member-1"), isNull()))
                .thenReturn(ok);

        mockMvc.perform(delete("/api/groups/group-1/members/member-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── GAP-M: POST /api/groups/{id}/report ──────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void reportGroup_validReason_returns201() throws Exception {
        Map<String, Object> svc = new LinkedHashMap<>();
        svc.put("id", "report-1");
        svc.put("status", "OPEN");
        when(churchGroupService.reportGroup(eq("group-1"), any(User.class), eq("SPAM"), anyString()))
                .thenReturn(svc);

        mockMvc.perform(post("/api/groups/group-1/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"SPAM\",\"note\":\"advertising stuff\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.report.id").value("report-1"))
                .andExpect(jsonPath("$.report.status").value("OPEN"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void reportGroup_invalidReason_returns400WithCode() throws Exception {
        when(churchGroupService.reportGroup(anyString(), any(User.class), anyString(), any()))
                .thenThrow(new RuntimeException("INVALID_REASON"));

        mockMvc.perform(post("/api/groups/group-1/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"BOGUS\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REASON"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void reportGroup_alreadyReported_returns422WithCode() throws Exception {
        when(churchGroupService.reportGroup(anyString(), any(User.class), anyString(), any()))
                .thenThrow(new RuntimeException("ALREADY_REPORTED"));

        mockMvc.perform(post("/api/groups/group-1/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"HARASSMENT\",\"note\":\"x\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ALREADY_REPORTED"));
    }

    @Test
    void reportGroup_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/groups/group-1/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"SPAM\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── GET /api/groups/{groupId}/quiz-sets/{setId}/my-attempts ──────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getMyAttempts_member_zeroAttempts_returnsEmptyListWithEmptySummary() throws Exception {
        GroupMember member = new GroupMember();
        member.setRole(GroupMember.GroupRole.MEMBER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(member));

        ChurchGroup group = new ChurchGroup();
        group.setId("group-1");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        when(quizSessionRepository.findCompletedByGroupQuizSetIdAndOwnerId(
                eq("qs-1"), eq("user-1"), any())).thenReturn(List.of());

        Map<String, Object> emptyMastery = new LinkedHashMap<>();
        emptyMastery.put("totalAttempts", 0);
        emptyMastery.put("bestScore", 0);
        emptyMastery.put("bestAccuracy", null);
        emptyMastery.put("questionsLearned", 0);
        when(masteryService.getMastery("qs-1", "user-1")).thenReturn(emptyMastery);

        mockMvc.perform(get("/api/groups/group-1/quiz-sets/qs-1/my-attempts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.attempts").isArray())
                .andExpect(jsonPath("$.attempts.length()").value(0))
                .andExpect(jsonPath("$.masterySummary.totalAttempts").value(0))
                .andExpect(jsonPath("$.masterySummary.bestScore").value(0));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getMyAttempts_member_withAttempts_returnsListAndSummary() throws Exception {
        GroupMember member = new GroupMember();
        member.setRole(GroupMember.GroupRole.MEMBER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(member));

        ChurchGroup group = new ChurchGroup();
        group.setId("group-1");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        com.biblequiz.modules.quiz.entity.QuizSession s1 =
                new com.biblequiz.modules.quiz.entity.QuizSession();
        s1.setId("sess-1");
        s1.setScore(80);
        s1.setCorrectAnswers(8);
        s1.setTotalQuestions(10);
        s1.setEndedAt(java.time.LocalDateTime.now());
        when(quizSessionRepository.findCompletedByGroupQuizSetIdAndOwnerId(
                eq("qs-1"), eq("user-1"), any())).thenReturn(List.of(s1));

        Map<String, Object> mastery = new LinkedHashMap<>();
        mastery.put("totalAttempts", 3);
        mastery.put("bestScore", 90);
        mastery.put("bestAccuracy", new java.math.BigDecimal("90.00"));
        mastery.put("questionsLearned", 7);
        when(masteryService.getMastery("qs-1", "user-1")).thenReturn(mastery);

        mockMvc.perform(get("/api/groups/group-1/quiz-sets/qs-1/my-attempts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.attempts.length()").value(1))
                .andExpect(jsonPath("$.attempts[0].sessionId").value("sess-1"))
                .andExpect(jsonPath("$.attempts[0].score").value(80))
                .andExpect(jsonPath("$.attempts[0].correctAnswers").value(8))
                .andExpect(jsonPath("$.attempts[0].totalQuestions").value(10))
                .andExpect(jsonPath("$.attempts[0].accuracy").value(80.0))
                .andExpect(jsonPath("$.masterySummary.totalAttempts").value(3))
                .andExpect(jsonPath("$.masterySummary.bestScore").value(90))
                .andExpect(jsonPath("$.masterySummary.learnedQuestionsCount").value(7));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getMyAttempts_nonMember_returns403() throws Exception {
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/groups/group-1/quiz-sets/qs-1/my-attempts"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ── GET /api/groups/{groupId}/quiz-sets/{setId}/leaderboard ─────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getQuizSetLeaderboard_empty_returnsEmptyEntriesAndNullMyRank() throws Exception {
        GroupMember member = new GroupMember();
        member.setRole(GroupMember.GroupRole.MEMBER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(member));

        ChurchGroup group = new ChurchGroup();
        group.setId("group-1");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        when(masteryRepository.findLeaderboardByQuizSetId(eq("qs-1"), any())).thenReturn(List.of());
        when(masteryRepository.countByQuizSetId("qs-1")).thenReturn(0L);

        mockMvc.perform(get("/api/groups/group-1/quiz-sets/qs-1/leaderboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(0))
                .andExpect(jsonPath("$.myRank").doesNotExist())
                .andExpect(jsonPath("$.totalParticipants").value(0));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getQuizSetLeaderboard_multiplePlayers_sortedAndComputesMyRank() throws Exception {
        GroupMember member = new GroupMember();
        member.setRole(GroupMember.GroupRole.MEMBER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(member));

        ChurchGroup group = new ChurchGroup();
        group.setId("group-1");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        com.biblequiz.modules.group.entity.GroupQuizSetMastery m1 =
                new com.biblequiz.modules.group.entity.GroupQuizSetMastery();
        m1.setUserId("user-A");
        m1.setBestScore(95);
        m1.setBestAccuracy(new java.math.BigDecimal("95.00"));
        m1.setTotalAttempts(2);

        com.biblequiz.modules.group.entity.GroupQuizSetMastery m2 =
                new com.biblequiz.modules.group.entity.GroupQuizSetMastery();
        m2.setUserId("user-1");
        m2.setBestScore(80);
        m2.setBestAccuracy(new java.math.BigDecimal("80.00"));
        m2.setTotalAttempts(1);

        when(masteryRepository.findLeaderboardByQuizSetId(eq("qs-1"), any()))
                .thenReturn(List.of(m1, m2));
        when(masteryRepository.countByQuizSetId("qs-1")).thenReturn(2L);

        User userA = new User();
        userA.setId("user-A");
        userA.setName("Alpha");
        when(userRepository.findAllById(anyList()))
                .thenReturn(List.of(userA, testUser));

        mockMvc.perform(get("/api/groups/group-1/quiz-sets/qs-1/leaderboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].rank").value(1))
                .andExpect(jsonPath("$.entries[0].userId").value("user-A"))
                .andExpect(jsonPath("$.entries[0].bestScore").value(95))
                .andExpect(jsonPath("$.entries[1].rank").value(2))
                .andExpect(jsonPath("$.entries[1].userId").value("user-1"))
                .andExpect(jsonPath("$.myRank").value(2))
                .andExpect(jsonPath("$.totalParticipants").value(2));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getQuizSetLeaderboard_nonMember_returns403() throws Exception {
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.empty());

        mockMvc.perform(get("/api/groups/group-1/quiz-sets/qs-1/leaderboard"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getMyAttempts_quizSetFromDifferentGroup_returns403() throws Exception {
        GroupMember member = new GroupMember();
        member.setRole(GroupMember.GroupRole.MEMBER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(member));

        ChurchGroup other = new ChurchGroup();
        other.setId("group-OTHER");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(other);
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        mockMvc.perform(get("/api/groups/group-1/quiz-sets/qs-1/my-attempts"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ── POST /api/groups/{id}/ai-generate (Phase D approval split) ─────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void groupAiGenerate_leader_quotaOk_returnsDraftsWithProvider() throws Exception {
        GroupMember leader = new GroupMember();
        leader.setRole(GroupMember.GroupRole.LEADER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(leader));

        when(aiQuotaService.tryAcquire(anyInt())).thenReturn(true);
        when(aiProviderRouter.generate(any(), any())).thenReturn(
                new com.biblequiz.modules.adminai.provider.AIGenerationResult(
                        List.of(Map.of("content", "Q1", "options", List.of("A", "B", "C", "D"), "correctAnswer", 0)),
                        100, 50, "deepseek"));

        String body = "{\"book\":\"John\",\"chapter\":3,\"count\":1,\"difficulty\":\"MEDIUM\"}";
        mockMvc.perform(post("/api/groups/group-1/ai-generate")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.provider").value("deepseek"))
                .andExpect(jsonPath("$.questions.length()").value(1));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void groupAiGenerate_quotaExhausted_returns429() throws Exception {
        GroupMember leader = new GroupMember();
        leader.setRole(GroupMember.GroupRole.LEADER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(leader));

        when(aiQuotaService.tryAcquire(anyInt())).thenReturn(false);
        when(aiQuotaService.snapshot()).thenReturn(
                new com.biblequiz.modules.adminai.quota.AIQuotaService.Usage(200, 200, 0));

        String body = "{\"book\":\"John\",\"chapter\":3,\"count\":5,\"difficulty\":\"MEDIUM\"}";
        mockMvc.perform(post("/api/groups/group-1/ai-generate")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.remaining").value(0));
        // Router must NOT be called when quota is exhausted.
        verify(aiProviderRouter, never()).generate(any(), any());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void groupAiGenerate_nonLeader_returns403() throws Exception {
        // Not a member at all → requireLeaderOrMod throws IllegalArgumentException → 403.
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.empty());

        String body = "{\"book\":\"John\",\"chapter\":3,\"count\":1}";
        mockMvc.perform(post("/api/groups/group-1/ai-generate")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
        verify(aiQuotaService, never()).tryAcquire(anyInt());
    }

    // ── AEU-2: quiz-set AI generate carries distractor-quality to the response ──

    @Test
    @WithMockUser(username = "test@example.com")
    @SuppressWarnings("unchecked")
    void quizSetAiGenerate_annotatesQuality_andPassesDistractorsThrough() throws Exception {
        GroupMember leader = new GroupMember();
        leader.setRole(GroupMember.GroupRole.LEADER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(leader));

        ChurchGroup group = new ChurchGroup();
        group.setId("group-1");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);
        qs.setQuestionIds(new java.util.ArrayList<>());
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        when(aiQuotaService.tryAcquire(anyInt())).thenReturn(true);
        when(aiQuotaService.snapshot()).thenReturn(
                new com.biblequiz.modules.adminai.quota.AIQuotaService.Usage(1, 200, 199));

        // AI draft includes the declared distractors metadata.
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("content", "Q1");
        draft.put("options", List.of("A", "B", "C", "D"));
        draft.put("correctAnswer", 2);
        draft.put("distractors", List.of(
                Map.of("index", 0, "errorType", "nearby_passage", "almostRight", false),
                Map.of("index", 1, "errorType", "wrong_detail", "almostRight", true),
                Map.of("index", 3, "errorType", "true_but_off", "almostRight", false)));
        when(aiProviderRouter.generate(any(), any())).thenReturn(
                new com.biblequiz.modules.adminai.provider.AIGenerationResult(
                        List.of(draft), 100, 50, "deepseek"));

        // Stub annotateQuality to mutate drafts in place like the real implementation.
        doAnswer(inv -> {
            List<Map<String, Object>> qList = inv.getArgument(0);
            for (Map<String, Object> q : qList) {
                q.put("_quality", Map.of("valid", true, "duplicateErrorType", false,
                        "almostRightCount", 1, "requiredAlmostRight", 1, "reasons", List.of()));
            }
            return null;
        }).when(aiGenerationService).annotateQuality(any());

        String body = "{\"countMedium\":1,\"book\":\"John\",\"chapterFrom\":3}";
        mockMvc.perform(post("/api/groups/group-1/quiz-sets/qs-1/ai-generate")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.questions[0].distractors.length()").value(3))
                .andExpect(jsonPath("$.questions[0].distractors[1].errorType").value("wrong_detail"))
                .andExpect(jsonPath("$.questions[0]._quality.valid").value(true));

        verify(aiGenerationService).annotateQuality(any());
        // Group-owned: saved outside the shared Ranked/Practice pool.
        verify(questionRepository).save(argThat((com.biblequiz.modules.quiz.entity.Question q) -> "ai-group".equals(q.getSource())
                && Boolean.FALSE.equals(q.getIsActive())));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void addQuestionToSet_savesGroupQuestionOutsideSharedPool() throws Exception {
        GroupMember leader = new GroupMember();
        leader.setRole(GroupMember.GroupRole.LEADER);
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "user-1"))
                .thenReturn(Optional.of(leader));
        ChurchGroup group = new ChurchGroup();
        group.setId("group-1");
        GroupQuizSet qs = new GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);
        qs.setQuestionIds(new java.util.ArrayList<>());
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        String body = "{\"content\":\"Ai đóng tàu?\",\"book\":\"Sáng Thế Ký\",\"chapter\":6,"
                + "\"options\":[\"Nô-ê\",\"Áp-ra-ham\",\"Môi-se\",\"Đa-vít\"],\"correctAnswer\":0}";
        mockMvc.perform(post("/api/groups/group-1/quiz-sets/qs-1/questions")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.totalQuestions").value(1));

        verify(questionRepository).save(argThat((com.biblequiz.modules.quiz.entity.Question q) -> "group-custom".equals(q.getSource())
                && Boolean.FALSE.equals(q.getIsActive())));
    }
}
