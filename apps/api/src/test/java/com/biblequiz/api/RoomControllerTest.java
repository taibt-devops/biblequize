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
        when(roomService.createRoom(anyString(), any(User.class), anyInt(), anyInt(), anyInt(), any(), anyBoolean(), any(), any(), any(), any()))
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
        when(roomService.getPublicRooms()).thenReturn(List.of());

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
