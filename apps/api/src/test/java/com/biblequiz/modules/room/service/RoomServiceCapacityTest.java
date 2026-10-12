package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Review PCV-20: chỗ đã dùng (sức chứa, "x/tối đa") tính cả người máy; "phòng còn ai" chỉ tính người thật.
 */
@ExtendWith(MockitoExtension.class)
class RoomServiceCapacityTest {

    @Mock private RoomRepository roomRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomWebSocketController webSocketController;
    @Mock private UserRepository userRepository;
    @InjectMocks private RoomService roomService;

    private final Room room = new Room();
    private RoomPlayer me;

    @BeforeEach
    void setUp() {
        User host = new User();
        host.setId("u1");
        room.setId("room-1");
        room.setHost(host);
        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMaxPlayers(4);
        me = new RoomPlayer("p1", room, host, "Minh");
        lenient().when(roomRepository.findById("room-1")).thenReturn(Optional.of(room));
        lenient().when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "u1")).thenReturn(Optional.of(me));
    }

    @Test
    void lastHumanLeavesTheLobby_roomWithOnlyBotsIsClosed() throws Exception {
        when(roomPlayerRepository.countOccupiedByRoomId("room-1")).thenReturn(2L);       // còn 2 người máy
        when(roomPlayerRepository.countOccupiedHumansByRoomId("room-1")).thenReturn(0L);

        roomService.leaveRoom("room-1", "u1");

        assertEquals(2, room.getCurrentPlayers(), "chỗ đã dùng tính cả người máy");
        verify(webSocketController).broadcastRoomEnded("room-1", WebSocketMessage.RoomEndedReason.EMPTY_LOBBY);
        verify(roomRepository).delete(room);
    }

    @Test
    void aHumanLeaves_otherHumansRemain_roomStays() throws Exception {
        when(roomPlayerRepository.countOccupiedByRoomId("room-1")).thenReturn(3L);
        when(roomPlayerRepository.countOccupiedHumansByRoomId("room-1")).thenReturn(1L);

        roomService.leaveRoom("room-1", "u1");

        assertEquals(3, room.getCurrentPlayers());
        verify(roomRepository, never()).delete(any(Room.class));
    }

    @Test
    void presence_countsHumansOnly() {
        when(roomPlayerRepository.countOccupiedHumansByRoomId("room-1")).thenReturn(0L);
        assertEquals(0, roomService.countOccupiedHumans("room-1"));
    }
}
