package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;

/**
 * SPEC §5.4.0 R4 / R5 — wires STOMP lifecycle events into the room
 * lifecycle. When a session disconnects we wait
 * {@code biblequiz.room.reconnect-grace-seconds} (default 60s); if the
 * user has not opened a new session in that window we treat them as
 * having left the room. Special cases:
 *
 * <ul>
 *   <li>If the disconnected user was the host, promote the longest-tenured
 *       remaining ACTIVE player and broadcast {@code HOST_CHANGED}.</li>
 *   <li>If no successor exists (host was the last member or last ACTIVE),
 *       end the room with reason {@code HOST_GONE} and broadcast
 *       {@code ROOM_ENDED}.</li>
 *   <li>If a non-host disconnects and no ACTIVE players remain, end the
 *       room with reason {@code ALL_DISCONNECTED}.</li>
 * </ul>
 *
 * <p>Battle Royale absence-elimination (audit G9) is intentionally
 * deferred — it requires reaching into BattleRoyaleEngine state, tracked
 * for Sprint 3.
 */
@Component
public class RoomPresenceListener {

    private static final Logger log = LoggerFactory.getLogger(RoomPresenceListener.class);

    private static final String TOPIC_PREFIX = "/topic/room/";

    private final PresenceTracker presenceTracker;
    private final RoomRepository roomRepository;
    private final RoomService roomService;
    private final UserRepository userRepository;
    private final RoomWebSocketController webSocketController;
    private final TaskScheduler taskScheduler;

    @Value("${biblequiz.room.reconnect-grace-seconds:60}")
    private int graceSeconds;

    public RoomPresenceListener(PresenceTracker presenceTracker,
                                RoomRepository roomRepository,
                                RoomService roomService,
                                UserRepository userRepository,
                                RoomWebSocketController webSocketController,
                                TaskScheduler taskScheduler) {
        this.presenceTracker = presenceTracker;
        this.roomRepository = roomRepository;
        this.roomService = roomService;
        this.userRepository = userRepository;
        this.webSocketController = webSocketController;
        this.taskScheduler = taskScheduler;
    }

    @EventListener
    public void onConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String email = principalName(event.getUser());
        if (sessionId == null || email == null) return;
        presenceTracker.onConnect(sessionId, email);
    }

    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String destination = accessor.getDestination();
        if (sessionId == null || destination == null || !destination.startsWith(TOPIC_PREFIX)) return;
        String roomId = destination.substring(TOPIC_PREFIX.length());
        if (roomId.isEmpty()) return;
        presenceTracker.onSubscribe(sessionId, roomId);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        Optional<PresenceTracker.SessionState> stateOpt = presenceTracker.onDisconnect(sessionId);
        if (stateOpt.isEmpty()) return;
        PresenceTracker.SessionState state = stateOpt.get();
        if (state.rooms.isEmpty()) return;

        // Schedule the grace check. If the user reconnects (any new
        // session before the deadline) we no-op.
        Instant deadline = Instant.now().plusSeconds(graceSeconds);
        taskScheduler.schedule(() -> handleGraceEnd(state.userEmail, state.rooms), deadline);
        log.info("[ROOM-PRESENCE] Scheduled grace check for user={} rooms={} in {}s",
                state.userEmail, state.rooms, graceSeconds);
    }

    /** Visible for tests so we don't have to wait on the real scheduler. */
    void handleGraceEnd(String userEmail, Set<String> roomIds) {
        if (presenceTracker.userHasActiveSession(userEmail)) {
            log.debug("[ROOM-PRESENCE] User {} reconnected before grace deadline", userEmail);
            return;
        }
        Optional<User> userOpt = userRepository.findByEmail(userEmail);
        if (userOpt.isEmpty()) {
            log.warn("[ROOM-PRESENCE] No user row for email {}; abandoning grace handler", userEmail);
            return;
        }
        String userId = userOpt.get().getId();

        for (String roomId : roomIds) {
            try {
                handleGraceEndForRoom(userId, roomId);
            } catch (Exception e) {
                log.error("[ROOM-PRESENCE] Failed to handle grace end for user={} room={}",
                        userId, roomId, e);
            }
        }
    }

    private void handleGraceEndForRoom(String userId, String roomId) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) return;
        if (room.getStatus() == Room.RoomStatus.ENDED || room.getStatus() == Room.RoomStatus.CANCELLED) return;

        boolean wasHost = room.getHost() != null && userId.equals(room.getHost().getId());

        // Step 1: mark the no-show player as LEFT.
        roomService.markPlayerLeft(roomId, userId);

        if (wasHost) {
            Optional<User> next = roomService.promoteNextHost(roomId);
            if (next.isPresent()) {
                User newHost = next.get();
                webSocketController.broadcastHostChanged(roomId, newHost.getId(), newHost.getName());
                log.info("[ROOM-PRESENCE] Promoted {} → host of room {} (old host {} timed out)",
                        newHost.getId(), roomId, userId);
                return;
            }
            // No successor → end room.
            webSocketController.broadcastRoomEnded(roomId, WebSocketMessage.RoomEndedReason.HOST_GONE);
            roomService.endRoom(roomId);
            log.info("[ROOM-PRESENCE] Ended room {} — host {} disconnected, no successor", roomId, userId);
            return;
        }

        // Non-host: end the room only when no ACTIVE players remain
        // (covers "all disconnected" in IN_PROGRESS).
        // Chỉ đếm người thật: phòng chỉ còn người máy cũng kết thúc.
        if (roomService.countOccupiedHumans(roomId) == 0) {
            webSocketController.broadcastRoomEnded(roomId,
                    WebSocketMessage.RoomEndedReason.ALL_DISCONNECTED);
            roomService.endRoom(roomId);
            log.info("[ROOM-PRESENCE] Ended room {} — last active player {} disconnected",
                    roomId, userId);
        }
    }

    private static String principalName(Principal p) {
        return p == null ? null : p.getName();
    }
}
