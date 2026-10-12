package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.Challenge;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.ChallengeRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-23 — Thách đấu bạn bè (design §3.3). */
@ExtendWith(MockitoExtension.class)
class ChallengeServiceTest {

    @Mock private ChallengeRepository challengeRepository;
    @Mock private UserRepository userRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private RoomService roomService;

    private ChallengeService service;
    private final User minh = user("minh", "Minh", false);
    private final User lan = user("lan", "Lan", false);

    private static User user(String id, String name, boolean bot) {
        User u = new User();
        u.setId(id);
        u.setName(name);
        u.setEmail(id + "@mail");
        u.setIsBot(bot);
        return u;
    }

    private Challenge pending(LocalDateTime expiresAt) {
        Challenge c = new Challenge("ch-1", minh, lan, expiresAt);
        when(challengeRepository.findById("ch-1")).thenReturn(Optional.of(c));
        return c;
    }

    @BeforeEach
    void setUp() {
        service = new ChallengeService(challengeRepository, userRepository, messagingTemplate);
        ReflectionTestUtils.setField(service, "roomService", roomService);
        lenient().when(userRepository.findById("minh")).thenReturn(Optional.of(minh));
        lenient().when(userRepository.findById("lan")).thenReturn(Optional.of(lan));
        lenient().when(challengeRepository.save(any(Challenge.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void cannotChallengeABot() {
        User bot = user("bot-01", "Máy An", true);
        when(userRepository.findById("bot-01")).thenReturn(Optional.of(bot));
        assertThrows(IllegalArgumentException.class, () -> service.createChallenge("minh", "bot-01"));
    }

    @Test
    void secondChallengeToTheSamePerson_returnsTheOneStillWaiting() {
        Challenge waiting = new Challenge("ch-old", minh, lan, LocalDateTime.now().plusMinutes(3));
        when(challengeRepository.findByChallengedIdAndStatus("lan", Challenge.Status.PENDING)).thenReturn(List.of(waiting));

        assertEquals("ch-old", service.createChallenge("minh", "lan").getId());
        verify(challengeRepository, never()).save(any());
    }

    @Test
    void accept_createsAPrivateSpeedRaceForBoth_andRemembersTheRoom() throws Exception {
        Challenge c = pending(LocalDateTime.now().plusMinutes(4));
        Room room = new Room();
        room.setId("room-9");
        room.setRoomCode("DUEL99");
        when(roomService.createRoom(anyString(), eq(minh), eq(2), eq(10), eq(20), eq(Room.RoomMode.SPEED_RACE), eq(false),
                eq(Room.RoomDifficulty.MIXED), eq("ALL"), eq(Room.QuestionSource.DATABASE), isNull(), eq(true), anyString()))
                .thenReturn(room);

        Map<String, String> r = service.acceptChallenge("ch-1", "lan");

        verify(roomService).joinRoom("DUEL99", lan);
        assertEquals("room-9", r.get("roomId"));
        assertEquals("DUEL99", r.get("roomCode"));
        assertEquals(Challenge.Status.ACCEPTED, c.getStatus());
        assertEquals("room-9", c.getRoomId());
    }

    @Test
    void accept_afterExpiryOrCancel_createsNoRoom() throws Exception {
        pending(LocalDateTime.now().minusSeconds(1));
        assertThrows(IllegalArgumentException.class, () -> service.acceptChallenge("ch-1", "lan"));

        Challenge c = pending(LocalDateTime.now().plusMinutes(4));
        c.setStatus(Challenge.Status.CANCELLED);
        assertThrows(IllegalArgumentException.class, () -> service.acceptChallenge("ch-1", "lan"));
        verifyNoInteractions(roomService);
    }

    @Test
    void onlyTheChallengerCancels_andOnlyWhileWaiting() {
        Challenge c = pending(LocalDateTime.now().plusMinutes(4));
        assertThrows(IllegalArgumentException.class, () -> service.cancelChallenge("ch-1", "lan"));

        service.cancelChallenge("ch-1", "minh");
        assertEquals(Challenge.Status.CANCELLED, c.getStatus());
    }

    @Test
    void status_isVisibleToBothSides_only() {
        Challenge c = pending(LocalDateTime.now().plusMinutes(4));
        c.setStatus(Challenge.Status.ACCEPTED);
        c.setRoomId("room-9");

        Map<String, Object> view = service.getChallenge("ch-1", "minh");
        assertEquals("ACCEPTED", view.get("status"));
        assertEquals("room-9", view.get("roomId"));
        assertEquals("Lan", view.get("challengedName"));
        assertThrows(IllegalArgumentException.class, () -> service.getChallenge("ch-1", "stranger"));
    }

    @Test
    void waitingPastExpiry_readsAsExpired() {
        pending(LocalDateTime.now().minusSeconds(5));
        assertEquals("EXPIRED", service.getChallenge("ch-1", "minh").get("status"));
        assertEquals(0L, service.getChallenge("ch-1", "minh").get("secondsLeft"));
    }

    /** expiresAt là giờ JVM không kèm múi — máy khách đếm ngược theo số giây còn lại do máy chủ tính. */
    @Test
    void status_carriesSecondsLeft_fromTheServerClock() {
        pending(LocalDateTime.now().plusMinutes(4));
        Object left = service.getChallenge("ch-1", "minh").get("secondsLeft");
        assertTrue(left instanceof Long && (Long) left > 230 && (Long) left <= 240, String.valueOf(left));
    }
}
