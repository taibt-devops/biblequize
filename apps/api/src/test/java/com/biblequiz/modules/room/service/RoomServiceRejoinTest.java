package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Review: vào lại giữa trận (mất mạng > 60 giây rồi quay lại) trả đúng trạng thái theo mode — không hồi sinh
 * "bóng" Sinh tồn miễn phí, khán giả Đấu vương không thành người đấu.
 */
@ExtendWith(MockitoExtension.class)
class RoomServiceRejoinTest {

    @Mock private RoomRepository roomRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomWebSocketController webSocketController;
    @Mock private RoomStateService roomStateService;
    @InjectMocks private RoomService roomService;

    private final Room room = new Room();
    private final User me = new User();
    private RoomPlayer row;

    @BeforeEach
    void setUp() {
        User host = new User();
        host.setId("host");
        room.setId("room-1");
        room.setRoomCode("ROOM11");
        room.setHost(host);
        room.setHostPlaysGame(true);
        room.setStatus(Room.RoomStatus.IN_PROGRESS);
        me.setId("u1");
        row = new RoomPlayer("p1", room, me, "Minh");
        row.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(roomRepository.findByRoomCode("ROOM11")).thenReturn(Optional.of(room));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "u1")).thenReturn(Optional.of(row));
    }

    @Test
    void battleRoyale_eliminatedPlayerComesBackAsAGhost() throws Exception {
        room.setMode(Room.RoomMode.BATTLE_ROYALE);
        row.setEliminatedRound(4);

        roomService.joinRoom("ROOM11", me);

        assertEquals(RoomPlayer.PlayerStatus.ELIMINATED, row.getPlayerStatus());
    }

    @Test
    void battleRoyale_survivorComesBackActive() throws Exception {
        room.setMode(Room.RoomMode.BATTLE_ROYALE);

        roomService.joinRoom("ROOM11", me);

        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, row.getPlayerStatus());
    }

    @Test
    void suddenDeath_spectatorComesBackAsASpectator_duelistComesBackActive() throws Exception {
        room.setMode(Room.RoomMode.SUDDEN_DEATH);
        when(roomStateService.getSdChampion("room-1")).thenReturn("king");
        when(roomStateService.getSdChallenger("room-1")).thenReturn("other");

        roomService.joinRoom("ROOM11", me);
        assertEquals(RoomPlayer.PlayerStatus.SPECTATOR, row.getPlayerStatus());

        row.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(roomStateService.getSdChallenger("room-1")).thenReturn("u1");
        roomService.joinRoom("ROOM11", me);
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, row.getPlayerStatus());
    }

    @Test
    void speedRace_comesBackActive() throws Exception {
        room.setMode(Room.RoomMode.SPEED_RACE);

        roomService.joinRoom("ROOM11", me);

        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, row.getPlayerStatus());
    }
}
