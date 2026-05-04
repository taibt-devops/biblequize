package com.biblequiz.api;

import com.biblequiz.modules.adminai.AIGenerationService;
import com.biblequiz.modules.group.repository.ChurchGroupRepository;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.group.repository.GroupQuizSetRepository;
import com.biblequiz.modules.group.service.ChurchGroupService;
import com.biblequiz.modules.group.service.GroupStreakService;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
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

    @MockBean
    private GroupMemberRepository groupMemberRepository;

    @MockBean
    private QuestionRepository questionRepository;

    @MockBean
    private AIGenerationService aiGenerationService;

    @MockBean
    private RoomService roomService;

    @MockBean
    private RoomRepository roomRepository;

    @MockBean
    private RoomPlayerRepository roomPlayerRepository;

    @MockBean
    private UserRepository userRepository;

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

        when(churchGroupService.getGroupDetails("group-1")).thenReturn(serviceResult);

        mockMvc.perform(get("/api/groups/group-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.group.id").value("group-1"));
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

    // ── GET /api/groups/{id}/leaderboard ─────────────────────────────────────

    @Test
    @WithMockUser(username = "test@example.com")
    void getLeaderboard_shouldReturn200() throws Exception {
        when(churchGroupService.getLeaderboard("group-1", "weekly"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/groups/group-1/leaderboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.leaderboard").isArray());
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    @Test
    void createGroup_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"My Group\"}"))
                .andExpect(status().isUnauthorized());
    }
}
