package com.biblequiz.service;

import com.biblequiz.modules.room.entity.Challenge;
import com.biblequiz.modules.room.repository.ChallengeRepository;
import com.biblequiz.modules.room.service.ChallengeService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SocialFunTest {

    @Mock private ChallengeRepository challengeRepository;
    @Mock private UserRepository userRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;

    private ChallengeService challengeService;
    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        challengeService = new ChallengeService(challengeRepository, userRepository, messagingTemplate);
        // Chuyển trạng thái có điều kiện (còn PENDING) — xem ChallengeServiceTest cho các nhánh thua.
        lenient().when(challengeRepository.transitionFromPending(anyString(), any())).thenReturn(1);

        userA = new User();
        userA.setId("user-a");
        userA.setName("Alice");
        userA.setEmail("alice@test.com");

        userB = new User();
        userB.setId("user-b");
        userB.setName("Bob");
        userB.setEmail("bob@test.com");
    }

    // === Challenge Tests ===

    @Test
    void createChallenge_cannotChallengeSelf() {
        assertThatThrownBy(() -> challengeService.createChallenge("user-a", "user-a"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("yourself");
    }

    @Test
    void createChallenge_sendsWebSocketNotification() {
        when(userRepository.findById("user-a")).thenReturn(Optional.of(userA));
        when(userRepository.findById("user-b")).thenReturn(Optional.of(userB));
        when(challengeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Challenge result = challengeService.createChallenge("user-a", "user-b");

        assertThat(result.getStatus()).isEqualTo(Challenge.Status.PENDING);
        verify(messagingTemplate).convertAndSendToUser(eq("bob@test.com"), eq("/queue/challenges"), any());
    }

    @Test
    void createChallenge_expiresAfter5Minutes() {
        when(userRepository.findById("user-a")).thenReturn(Optional.of(userA));
        when(userRepository.findById("user-b")).thenReturn(Optional.of(userB));
        when(challengeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Challenge result = challengeService.createChallenge("user-a", "user-b");

        assertThat(result.getExpiresAt()).isAfter(LocalDateTime.now().plusMinutes(4));
        assertThat(result.getExpiresAt()).isBefore(LocalDateTime.now().plusMinutes(6));
    }

    @Test
    void acceptChallenge_updatesStatus() throws Exception {
        // PCV-23: nhận lời mở phòng thách đấu — chi tiết ở ChallengeServiceTest.
        com.biblequiz.modules.room.service.RoomService roomService = mock(com.biblequiz.modules.room.service.RoomService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(challengeService, "roomService", roomService);
        com.biblequiz.modules.room.entity.Room room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("DUEL01");
        when(roomService.createRoom(anyString(), eq(userA), anyInt(), anyInt(), anyInt(), any(), anyBoolean(), any(), anyString(), any(), any(), anyBoolean(), anyString()))
                .thenReturn(room);
        Challenge challenge = new Challenge("c-1", userA, userB, LocalDateTime.now().plusMinutes(5));
        when(challengeRepository.findById("c-1")).thenReturn(Optional.of(challenge));
        when(challengeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        challengeService.acceptChallenge("c-1", "user-b");

        assertThat(challenge.getStatus()).isEqualTo(Challenge.Status.ACCEPTED);
        assertThat(challenge.getRoomId()).isEqualTo("room-1");
    }

    @Test
    void acceptChallenge_rejectsWrongUser() {
        Challenge challenge = new Challenge("c-1", userA, userB, LocalDateTime.now().plusMinutes(5));
        when(challengeRepository.findById("c-1")).thenReturn(Optional.of(challenge));

        assertThatThrownBy(() -> challengeService.acceptChallenge("c-1", "user-a"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Not your challenge");
    }

    @Test
    void acceptChallenge_rejectsExpired() {
        Challenge challenge = new Challenge("c-1", userA, userB, LocalDateTime.now().minusMinutes(1));
        when(challengeRepository.findById("c-1")).thenReturn(Optional.of(challenge));
        when(challengeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThatThrownBy(() -> challengeService.acceptChallenge("c-1", "user-b"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void declineChallenge_updatesStatus() {
        Challenge challenge = new Challenge("c-1", userA, userB, LocalDateTime.now().plusMinutes(5));
        when(challengeRepository.findById("c-1")).thenReturn(Optional.of(challenge));

        challengeService.declineChallenge("c-1", "user-b");

        assertThat(challenge.getStatus()).isEqualTo(Challenge.Status.DECLINED);
    }

    @Test
    void getPendingChallenges_filtersExpired() {
        Challenge valid = new Challenge("c-1", userA, userB, LocalDateTime.now().plusMinutes(3));
        Challenge expired = new Challenge("c-2", userA, userB, LocalDateTime.now().minusMinutes(1));

        when(challengeRepository.findByChallengedIdAndStatus("user-b", Challenge.Status.PENDING))
                .thenReturn(List.of(valid, expired));

        List<Challenge> pending = challengeService.getPendingChallenges("user-b");

        assertThat(pending).hasSize(1);
        assertThat(pending.get(0).getId()).isEqualTo("c-1");
    }

    // === Challenge Entity Tests ===

    @Test
    void challenge_isExpired_returnsTrueWhenPastExpiry() {
        Challenge c = new Challenge("c-1", userA, userB, LocalDateTime.now().minusSeconds(1));
        assertThat(c.isExpired()).isTrue();
    }

    @Test
    void challenge_isExpired_returnsFalseWhenStillValid() {
        Challenge c = new Challenge("c-1", userA, userB, LocalDateTime.now().plusMinutes(5));
        assertThat(c.isExpired()).isFalse();
    }
}
