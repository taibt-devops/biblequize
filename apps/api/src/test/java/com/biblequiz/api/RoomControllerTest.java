package com.biblequiz.api;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.service.RoomQuizService;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RoomController.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RoomControllerTest extends BaseControllerTest {

    @MockBean
    private RoomService roomService;

    @MockBean
    private RoomQuizService roomQuizService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private com.biblequiz.modules.room.service.DailyQuickMatchCounter dailyQuickMatchCounter;

    // RoomWebSocketController, RoomStateService, RoomAnalyticsService, and
    // HostControlService are already provided by BaseControllerTest.

    @MockBean
    private com.biblequiz.modules.room.service.QuickMatchQuestionSourceService quickMatchQuestionSource;

    @MockBean
    private com.biblequiz.modules.ranked.service.UserTierService userTierService;

    private User testUser;
    private Room testRoom;
    private RoomService.RoomDetailsDTO testRoomDetails;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test User");
        testUser.setEmail("test@example.com");
        testUser.setRole("USER");

        testRoom = new Room();
        testRoom.setId("room-1");
        testRoom.setRoomCode("ABC123");
        testRoom.setRoomName("Test Room");
        testRoom.setMode(Room.RoomMode.SPEED_RACE);
        testRoom.setMaxPlayers(4);
        testRoom.setCurrentPlayers(1);
        testRoom.setQuestionCount(10);
        testRoom.setTimePerQuestion(30);
        testRoom.setHost(testUser);
        testRoom.setIsPublic(false);
        testRoom.setStatus(Room.RoomStatus.LOBBY);

        testRoomDetails = new RoomService.RoomDetailsDTO(testRoom, List.of());

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
    }

    // ── POST /api/rooms ──────────────────────────────────────────────────────

    @Test
    @Order(1)
    @WithMockUser(username = "test@example.com")
    void createRoom_withValidData_shouldReturn200() throws Exception {
        // RoomService.createRoom now takes 13 args — language was added (V65)
        // so DATABASE-source selection can filter vi/en. The shorter overloads
        // still exist but the controller calls the 13-arg one.
        when(roomService.createRoom(anyString(), any(User.class), anyInt(), anyInt(), anyInt(), any(), anyBoolean(), any(), any(), any(), any(), any(), anyString()))
                .thenReturn(testRoom);
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);

        mockMvc.perform(post("/api/rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomName\":\"My Room\",\"maxPlayers\":4,\"mode\":\"SPEED_RACE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.room.roomCode").value("ABC123"));
    }

    @Test
    @Order(2)
    void createRoom_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomName\":\"My Room\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── POST /api/rooms/join ─────────────────────────────────────────────────

    @Test
    @Order(3)
    @WithMockUser(username = "test@example.com")
    void joinRoom_withValidCode_shouldReturn200() throws Exception {
        when(roomService.joinRoom("ABC123", testUser)).thenReturn(testRoom);
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);

        mockMvc.perform(post("/api/rooms/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomCode\":\"ABC123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @Order(4)
    @WithMockUser(username = "test@example.com")
    void joinRoom_withMissingCode_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/rooms/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomCode\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ── GET /api/rooms/{id} ──────────────────────────────────────────────────

    @Test
    @Order(5)
    @WithMockUser(username = "test@example.com")
    void getRoomDetails_shouldReturn200() throws Exception {
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);

        mockMvc.perform(get("/api/rooms/room-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.room.id").value("room-1"));
    }

    @Test
    @Order(6)
    @WithMockUser(username = "test@example.com")
    void getRoomDetails_notFound_shouldReturn404() throws Exception {
        when(roomService.getRoomDetails("non-existent"))
                .thenThrow(new RuntimeException("Room not found"));

        mockMvc.perform(get("/api/rooms/non-existent"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ── PATCH /api/rooms/{id}/settings (PCV-18) ──────────────────────────────

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void updateSettings_asHost_returnsRoom() throws Exception {
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/rooms/room-1/settings")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"BATTLE_ROYALE\",\"questionCount\":15,\"timePerQuestion\":20,\"difficulty\":\"HARD\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        verify(roomService).updateSettings(eq("room-1"), eq("user-1"), eq(new RoomService.SettingsUpdate(
                com.biblequiz.modules.room.entity.Room.RoomMode.BATTLE_ROYALE, 15, 20,
                com.biblequiz.modules.room.entity.Room.RoomDifficulty.HARD)));
    }

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void updateSettings_unknownMode_returns400() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/rooms/room-1/settings")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"NOPE\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/rooms/{id}/rematch (PCV-17) ────────────────────────────────

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void rematch_returnsTheNewRoom() throws Exception {
        com.biblequiz.modules.room.entity.Room fresh = new com.biblequiz.modules.room.entity.Room();
        fresh.setId("room-2");
        when(roomService.rematch(eq("room-1"), any())).thenReturn(new RoomService.RematchResult(fresh, true));
        when(roomService.getRoomDetails("room-2")).thenReturn(testRoomDetails);

        mockMvc.perform(post("/api/rooms/room-1/rematch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.created").value(true));
    }

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void rematch_beforeTheGameEnds_returns400() throws Exception {
        when(roomService.rematch(eq("room-1"), any())).thenThrow(new Exception("Trận chưa kết thúc"));

        mockMvc.perform(post("/api/rooms/room-1/rematch"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Trận chưa kết thúc"));
    }

    // ── POST /api/rooms/{id}/shuffle-teams (PCV-14) ──────────────────────────

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void shuffleTeams_asHost_returnsRoomState() throws Exception {
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);
        doNothing().when(roomService).shuffleTeams("room-1", "user-1");

        mockMvc.perform(post("/api/rooms/room-1/shuffle-teams"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        verify(roomService).shuffleTeams("room-1", "user-1");
    }

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void shuffleTeams_notAllowed_returns400WithReason() throws Exception {
        doThrow(new Exception("Chỉ chủ phòng mới xáo đội được")).when(roomService).shuffleTeams("room-1", "user-1");

        mockMvc.perform(post("/api/rooms/room-1/shuffle-teams"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Chỉ chủ phòng mới xáo đội được"));
    }

    // ── POST /api/rooms/{id}/start ───────────────────────────────────────────

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void startRoom_asHost_shouldReturn200() throws Exception {
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);
        doNothing().when(roomService).startRoom("room-1", "user-1");

        mockMvc.perform(post("/api/rooms/room-1/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void startRoom_serverOutOfGameThreads_returns503AndRevertsToLobby() throws Exception {
        // PCV-4: hết luồng cho trận ⇒ không để phòng kẹt IN_PROGRESS không có vòng chơi.
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);
        doNothing().when(roomService).startRoom("room-1", "user-1");
        doThrow(new org.springframework.core.task.TaskRejectedException("full"))
                .when(roomQuizService).runQuiz(anyString(), anyInt(), anyInt(), any());

        mockMvc.perform(post("/api/rooms/room-1/start"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVER_BUSY"));
        verify(roomService).revertStart("room-1");
    }

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void quickMatch_aiSource_isDisabled() throws Exception {
        // PCV-8: câu AI chưa duyệt + luồng vào trận chưa từng dùng chúng ⇒ tắt hẳn.
        mockMvc.perform(post("/api/rooms/quick-match")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"SPEED_RACE\",\"source\":\"AI_GENERATED\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error").value("AI_SOURCE_DISABLED"));
        verify(quickMatchQuestionSource, never()).generateAiPayload(any(), anyInt(), anyInt(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    @Order(7)
    @WithMockUser(username = "test@example.com")
    void quickMatch_database_isNotDailyCapped() throws Exception {
        // PCV-8: giới hạn 3 trận/ngày chỉ dành cho nguồn AI (tốn tiền); kho câu hỏi không giới hạn.
        when(dailyQuickMatchCounter.hasReachedCap("user-1")).thenReturn(true);
        when(quickMatchQuestionSource.pickDatabaseIds(any(), anyInt(), any())).thenReturn(java.util.List.of("q1"));
        when(roomService.createQuickMatchRoom(any(), any(), any(), anyInt(), anyInt(), anyInt(), any(), any(), any()))
                .thenReturn(testRoom);
        when(roomService.getRoomDetails(any())).thenReturn(testRoomDetails);

        mockMvc.perform(post("/api/rooms/quick-match")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"SPEED_RACE\",\"source\":\"DATABASE\"}"))
                .andExpect(status().isOk());
        verify(dailyQuickMatchCounter, never()).increment(any());
    }

    // ── POST /api/rooms/{id}/leave ───────────────────────────────────────────

    @Test
    @Order(8)
    @WithMockUser(username = "test@example.com")
    void leaveRoom_shouldReturn200() throws Exception {
        doNothing().when(roomService).leaveRoom("room-1", "user-1");

        mockMvc.perform(post("/api/rooms/room-1/leave"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── GET /api/rooms/public ────────────────────────────────────────────────

    @Test
    @Order(9)
    @WithMockUser(username = "test@example.com")
    void getPublicRooms_shouldReturn200() throws Exception {
        // L-6: controller now calls the viewer-aware overload
        when(roomService.getPublicRooms(any())).thenReturn(List.of());

        mockMvc.perform(get("/api/rooms/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.rooms").isArray());
    }

    // ── GET /api/rooms/{id}/leaderboard ──────────────────────────────────────

    @Test
    @Order(10)
    @WithMockUser(username = "test@example.com")
    void getRoomLeaderboard_shouldReturn200() throws Exception {
        when(roomService.getRoomLeaderboard("room-1")).thenReturn(List.of());

        mockMvc.perform(get("/api/rooms/room-1/leaderboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.leaderboard").isArray());
    }

    // ── POST /api/rooms/{id}/switch-team ─────────────────────────────────────

    @Test
    @Order(11)
    @WithMockUser(username = "test@example.com")
    void switchTeam_shouldReturn200() throws Exception {
        doNothing().when(roomService).switchTeam("room-1", "user-1");
        when(roomService.getRoomDetails("room-1")).thenReturn(testRoomDetails);

        mockMvc.perform(post("/api/rooms/room-1/switch-team"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── TC-ROOM-005: POST /api/rooms/{id}/kick ──────────────────────────────

    @Test
    @Order(13)
    @WithMockUser(username = "test@example.com")
    void TC_ROOM_005_kickPlayer_byHost_shouldReturn200() throws Exception {
        doNothing().when(roomService).kickPlayer("room-1", "user-1", "player-2");

        mockMvc.perform(post("/api/rooms/room-1/kick")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"player-2\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @Order(14)
    @WithMockUser(username = "test@example.com")
    void kickPlayer_notHost_shouldReturn403() throws Exception {
        doThrow(new RuntimeException("FORBIDDEN"))
                .when(roomService).kickPlayer("room-1", "user-1", "player-2");

        mockMvc.perform(post("/api/rooms/room-1/kick")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"player-2\"}"))
                .andExpect(status().isForbidden());
    }

    // ── TC-ROOM-006: POST /api/rooms/join when room full ────────────────────

    @Test
    @Order(12)
    @WithMockUser(username = "test@example.com")
    void TC_ROOM_006_joinRoom_whenRoomFull_shouldReturnError() throws Exception {
        when(roomService.joinRoom("FULL01", testUser))
                .thenThrow(new Exception("Phòng đã đầy người"));

        mockMvc.perform(post("/api/rooms/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomCode\":\"FULL01\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Phòng đã đầy người"));
    }
}
