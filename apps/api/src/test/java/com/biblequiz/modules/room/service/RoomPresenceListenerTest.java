package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.TaskScheduler;

import java.util.Optional;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Sprint 2.5 L-5 — verifies the disconnect-grace branches without
 * waiting for the real TaskScheduler tick. Calls
 * {@link RoomPresenceListener#handleGraceEnd(String, java.util.Set)}
 * directly.
 */
@ExtendWith(MockitoExtension.class)
class RoomPresenceListenerTest {

    @Mock private PresenceTracker presenceTracker;
    @Mock private RoomRepository roomRepository;
    @Mock private RoomService roomService;
    @Mock private UserRepository userRepository;
    @Mock private RoomWebSocketController webSocketController;
    @Mock private TaskScheduler taskScheduler;

    private RoomPresenceListener listener;

    private static final String ROOM_ID = "room-1";
    private static final String EMAIL = "ghost@example.com";
    private static final String USER_ID = "user-ghost";

    @BeforeEach
    void setUp() {
        listener = new RoomPresenceListener(presenceTracker, roomRepository, roomService,
                userRepository, webSocketController, taskScheduler);
    }

    private User user(String id, String name) {
        User u = new User();
        u.setId(id);
        u.setName(name);
        return u;
    }

    private Room lobbyHostedBy(User host) {
        Room r = new Room();
        r.setId(ROOM_ID);
        r.setStatus(Room.RoomStatus.LOBBY);
        r.setHost(host);
        return r;
    }

    @Test
    void graceEnd_userReconnected_isNoop() {
        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(true);

        listener.handleGraceEnd(EMAIL, Set.of(ROOM_ID));

        verifyNoInteractions(roomService, webSocketController, roomRepository);
    }

    @Test
    void graceEnd_unknownEmail_isNoop() {
        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        listener.handleGraceEnd(EMAIL, Set.of(ROOM_ID));

        verifyNoInteractions(roomService, webSocketController);
    }

    @Test
    void graceEnd_nonHostNoOtherActives_endsWithAllDisconnected() {
        User ghost = user(USER_ID, "Ghost");
        User host = user("user-host", "Host");
        Room room = lobbyHostedBy(host);

        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(ghost));
        when(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));
        when(roomService.countOccupiedHumans(ROOM_ID)).thenReturn(0L);

        listener.handleGraceEnd(EMAIL, Set.of(ROOM_ID));

        verify(roomService).markPlayerLeft(ROOM_ID, USER_ID);
        verify(webSocketController).broadcastRoomEnded(ROOM_ID,
                WebSocketMessage.RoomEndedReason.ALL_DISCONNECTED);
        verify(roomService).endRoom(ROOM_ID);
    }

    @Test
    void graceEnd_nonHostOthersStillActive_doesNotEndRoom() {
        User ghost = user(USER_ID, "Ghost");
        User host = user("user-host", "Host");
        Room room = lobbyHostedBy(host);

        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(ghost));
        when(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));
        when(roomService.countOccupiedHumans(ROOM_ID)).thenReturn(2L);

        listener.handleGraceEnd(EMAIL, Set.of(ROOM_ID));

        verify(roomService).markPlayerLeft(ROOM_ID, USER_ID);
        verify(roomService, never()).endRoom(any());
        verify(webSocketController, never()).broadcastRoomEnded(any(), any());
    }

    @Test
    void graceEnd_hostWithSuccessor_promotesAndBroadcastsHostChanged() {
        User ghostHost = user(USER_ID, "Ghost");
        User successor = user("user-next", "Next");
        Room room = new Room();
        room.setId(ROOM_ID);
        room.setStatus(Room.RoomStatus.IN_PROGRESS);
        room.setHost(ghostHost);

        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(ghostHost));
        when(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));
        when(roomService.promoteNextHost(ROOM_ID)).thenReturn(Optional.of(successor));

        listener.handleGraceEnd(EMAIL, Set.of(ROOM_ID));

        verify(roomService).markPlayerLeft(ROOM_ID, USER_ID);
        verify(roomService).promoteNextHost(ROOM_ID);
        verify(webSocketController).broadcastHostChanged(ROOM_ID, "user-next", "Next");
        verify(roomService, never()).endRoom(any());
        verify(webSocketController, never()).broadcastRoomEnded(any(), any());
    }

    @Test
    void graceEnd_hostNoSuccessor_endsWithHostGone() {
        User ghostHost = user(USER_ID, "Ghost");
        Room room = lobbyHostedBy(ghostHost);

        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(ghostHost));
        when(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));
        when(roomService.promoteNextHost(ROOM_ID)).thenReturn(Optional.empty());

        listener.handleGraceEnd(EMAIL, Set.of(ROOM_ID));

        verify(roomService).markPlayerLeft(ROOM_ID, USER_ID);
        verify(webSocketController).broadcastRoomEnded(ROOM_ID,
                WebSocketMessage.RoomEndedReason.HOST_GONE);
        verify(roomService).endRoom(ROOM_ID);
        verify(webSocketController, never()).broadcastHostChanged(any(), any(), any());
    }

    @Test
    void graceEnd_roomAlreadyEnded_skipsAllSideEffects() {
        User ghost = user(USER_ID, "Ghost");
        Room ended = lobbyHostedBy(user("user-host", "Host"));
        ended.setStatus(Room.RoomStatus.ENDED);

        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(ghost));
        when(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(ended));

        listener.handleGraceEnd(EMAIL, Set.of(ROOM_ID));

        verify(roomService, never()).markPlayerLeft(any(), any());
        verify(roomService, never()).endRoom(any());
        verify(webSocketController, never()).broadcastRoomEnded(any(), any());
    }

    @Test
    void graceEnd_oneRoomFails_secondRoomStillProcessed() {
        User ghost = user(USER_ID, "Ghost");
        Room a = lobbyHostedBy(user("host-a", "A"));
        Room b = lobbyHostedBy(user("host-b", "B"));
        a.setId("room-a");
        b.setId("room-b");

        when(presenceTracker.userHasActiveSession(EMAIL)).thenReturn(false);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(ghost));
        when(roomRepository.findById("room-a")).thenReturn(Optional.of(a));
        when(roomRepository.findById("room-b")).thenReturn(Optional.of(b));
        doThrow(new RuntimeException("boom")).when(roomService).markPlayerLeft(eq("room-a"), any());

        listener.handleGraceEnd(EMAIL, Set.of("room-a", "room-b"));

        // room-b should still be processed even though room-a threw
        verify(roomService).markPlayerLeft("room-b", USER_ID);
    }
}
