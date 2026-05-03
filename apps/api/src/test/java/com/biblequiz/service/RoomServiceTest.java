package com.biblequiz.service;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private RoomPlayerRepository roomPlayerRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private RoomService roomService;

    private User hostUser;
    private User playerUser;
    private Room testRoom;

    @BeforeEach
    void setUp() {
        hostUser = new User();
        hostUser.setId("host-1");
        hostUser.setName("Host User");
        hostUser.setEmail("host@example.com");

        playerUser = new User();
        playerUser.setId("player-1");
        playerUser.setName("Player User");
        playerUser.setEmail("player@example.com");

        testRoom = new Room();
        testRoom.setId("room-1");
        testRoom.setRoomCode("ABC123");
        testRoom.setRoomName("Test Room");
        testRoom.setHost(hostUser);
        testRoom.setMaxPlayers(4);
        testRoom.setCurrentPlayers(1);
        testRoom.setQuestionCount(10);
        testRoom.setTimePerQuestion(30);
        testRoom.setStatus(Room.RoomStatus.LOBBY);
        testRoom.setMode(Room.RoomMode.SPEED_RACE);
        testRoom.setIsPublic(false);
    }

    // ── createRoom ───────────────────────────────────────────────────────────

    @Test
    void createRoom_shouldCreateRoomAndAddHost() {
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> inv.getArgument(0));
        when(roomRepository.findById(anyString())).thenAnswer(inv -> {
            Room r = new Room();
            r.setId(inv.getArgument(0));
            r.setMode(Room.RoomMode.SPEED_RACE);
            r.setCurrentPlayers(0);
            return Optional.of(r);
        });

        Room result = roomService.createRoom("My Room", hostUser, 4, 10, 30, Room.RoomMode.SPEED_RACE, false,
                Room.RoomDifficulty.MIXED, "ALL", Room.QuestionSource.DATABASE, null);

        assertNotNull(result.getId());
        assertNotNull(result.getRoomCode());
        assertEquals("My Room", result.getRoomName());
        assertEquals(Room.RoomStatus.LOBBY, result.getStatus());
        verify(roomRepository, atLeastOnce()).save(any(Room.class));
        verify(roomPlayerRepository).save(any(RoomPlayer.class));
    }

    @Test
    void createRoom_withDefaultValues_shouldUseDefaults() {
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> inv.getArgument(0));
        when(roomRepository.findById(anyString())).thenAnswer(inv -> {
            Room r = new Room();
            r.setId(inv.getArgument(0));
            r.setMode(Room.RoomMode.SPEED_RACE);
            r.setCurrentPlayers(0);
            return Optional.of(r);
        });

        Room result = roomService.createRoom("Room", hostUser, null, null, null, null, null, null, null, null, null);

        assertEquals(4, result.getMaxPlayers());
        assertEquals(10, result.getQuestionCount());
        assertEquals(30, result.getTimePerQuestion());
        assertEquals(Room.RoomMode.SPEED_RACE, result.getMode());
        assertFalse(result.getIsPublic());
    }

    // ── joinRoom ─────────────────────────────────────────────────────────────

    @Test
    void joinRoom_validCode_shouldAddPlayer() throws Exception {
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1")).thenReturn(Optional.empty());
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomRepository.save(any(Room.class))).thenReturn(testRoom);

        Room result = roomService.joinRoom("ABC123", playerUser);

        assertEquals("room-1", result.getId());
        verify(roomPlayerRepository).save(any(RoomPlayer.class));
    }

    @Test
    void joinRoom_invalidCode_shouldThrowException() {
        when(roomRepository.findByRoomCode("INVALID")).thenReturn(Optional.empty());

        assertThrows(Exception.class, () -> roomService.joinRoom("INVALID", playerUser));
    }

    @Test
    void joinRoom_gameStarted_shouldThrowException() {
        testRoom.setStatus(Room.RoomStatus.IN_PROGRESS);
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));

        assertThrows(Exception.class, () -> roomService.joinRoom("ABC123", playerUser));
    }

    @Test
    void joinRoom_roomFull_shouldThrowException() {
        testRoom.setMaxPlayers(1);
        testRoom.setCurrentPlayers(1);
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));

        assertThrows(Exception.class, () -> roomService.joinRoom("ABC123", playerUser));
    }

    @Test
    void joinRoom_alreadyJoined_shouldThrowException() {
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1"))
                .thenReturn(Optional.of(new RoomPlayer()));

        assertThrows(Exception.class, () -> roomService.joinRoom("ABC123", playerUser));
    }

    // ── getRoomDetails ───────────────────────────────────────────────────────

    @Test
    void getRoomDetails_existingRoom_shouldReturnDetails() throws Exception {
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of());

        RoomService.RoomDetailsDTO details = roomService.getRoomDetails("room-1");

        assertEquals("room-1", details.id);
        assertEquals("ABC123", details.roomCode);
        assertEquals(Room.RoomMode.SPEED_RACE, details.mode);
    }

    @Test
    void getRoomDetails_nonExistent_shouldThrowException() {
        when(roomRepository.findById("non-existent")).thenReturn(Optional.empty());

        assertThrows(Exception.class, () -> roomService.getRoomDetails("non-existent"));
    }

    // ── switchTeam ───────────────────────────────────────────────────────────

    @Test
    void switchTeam_teamVsTeam_shouldToggleTeam() throws Exception {
        testRoom.setMode(Room.RoomMode.TEAM_VS_TEAM);
        RoomPlayer player = new RoomPlayer();
        player.setTeam(RoomPlayer.Team.A);

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1"))
                .thenReturn(Optional.of(player));

        roomService.switchTeam("room-1", "player-1");

        assertEquals(RoomPlayer.Team.B, player.getTeam());
    }

    @Test
    void switchTeam_notTeamMode_shouldThrowException() {
        testRoom.setMode(Room.RoomMode.SPEED_RACE);
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));

        assertThrows(Exception.class, () -> roomService.switchTeam("room-1", "player-1"));
    }
}
