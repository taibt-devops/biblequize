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

    @Mock
    private com.biblequiz.api.websocket.RoomWebSocketController webSocketController;

    @Mock
    private com.biblequiz.modules.group.repository.GroupQuizSetRepository groupQuizSetRepository;

    @Mock
    private com.biblequiz.modules.group.repository.GroupMemberRepository groupMemberRepository;

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

    // ── createRoom: Sprint 4 host-organizer mode ────────────────────────────

    @Test
    void createRoom_quanTroMode_shouldNotAddHostAsPlayer() {
        // hostPlaysGame=false → host stays only on Room.host FK; no RoomPlayer row.
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> inv.getArgument(0));

        Room result = roomService.createRoom("Quan Tro Room", hostUser, 4, 10, 30,
                Room.RoomMode.SPEED_RACE, false, Room.RoomDifficulty.MIXED, "ALL",
                Room.QuestionSource.DATABASE, null, Boolean.FALSE);

        assertFalse(result.isHostPlaysGame());
        // Host must NOT have been inserted as a RoomPlayer.
        verify(roomPlayerRepository, never()).save(any(RoomPlayer.class));
    }

    @Test
    void createRoom_legacyMode_shouldAddHostAsPlayer() {
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> inv.getArgument(0));
        when(roomRepository.findById(anyString())).thenAnswer(inv -> {
            Room r = new Room();
            r.setId(inv.getArgument(0));
            r.setMode(Room.RoomMode.SPEED_RACE);
            r.setCurrentPlayers(0);
            return Optional.of(r);
        });

        Room result = roomService.createRoom("Legacy Room", hostUser, 4, 10, 30,
                Room.RoomMode.SPEED_RACE, false, Room.RoomDifficulty.MIXED, "ALL",
                Room.QuestionSource.DATABASE, null, Boolean.TRUE);

        assertTrue(result.isHostPlaysGame());
        verify(roomPlayerRepository).save(any(RoomPlayer.class));
    }

    @Test
    void createRoom_legacyOverload_defaultsToHostPlaysTrue() {
        // Backward-compat overload (no hostPlaysGame param) keeps old behavior:
        // ChurchGroup "Tự ôn" + "Chơi cùng nhau" rely on this.
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> inv.getArgument(0));
        when(roomRepository.findById(anyString())).thenAnswer(inv -> {
            Room r = new Room();
            r.setId(inv.getArgument(0));
            r.setMode(Room.RoomMode.SPEED_RACE);
            r.setCurrentPlayers(0);
            return Optional.of(r);
        });

        Room result = roomService.createRoom("Compat Room", hostUser, 4, 10, 30,
                Room.RoomMode.SPEED_RACE, false, Room.RoomDifficulty.MIXED, "ALL",
                Room.QuestionSource.DATABASE, null);

        assertTrue(result.isHostPlaysGame());
        verify(roomPlayerRepository).save(any(RoomPlayer.class));
    }

    @Test
    void joinRoom_byHostInQuanTroMode_isNoOpReturnsRoom() throws Exception {
        // Host hitting /join in Quan Tro mode (e.g. stale link) must NOT be
        // added as RoomPlayer — would break the no-host-in-scoring invariant.
        testRoom.setHostPlaysGame(false);
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "host-1"))
                .thenReturn(Optional.empty());

        Room result = roomService.joinRoom("ABC123", hostUser);

        assertEquals("room-1", result.getId());
        verify(roomPlayerRepository, never()).save(any(RoomPlayer.class));
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
    void joinRoom_organizerHostRejoinsInProgress_shouldReturnRoomWithoutPlayerRow() throws Exception {
        // Quản trò mode: the organizer host has no RoomPlayer row, so the
        // LEFT-row rejoin path can never match them — they must still be able
        // to re-enter their own live room (e.g. after closing the tab).
        testRoom.setStatus(Room.RoomStatus.IN_PROGRESS);
        testRoom.setHostPlaysGame(false);
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));

        Room result = roomService.joinRoom("ABC123", hostUser);

        assertEquals("room-1", result.getId());
        verify(roomPlayerRepository, never()).save(any(RoomPlayer.class));
    }

    @Test
    void joinRoom_roomFull_shouldThrowException() {
        testRoom.setMaxPlayers(1);
        testRoom.setCurrentPlayers(1);
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));

        assertThrows(Exception.class, () -> roomService.joinRoom("ABC123", playerUser));
    }

    @Test
    void joinRoom_alreadyJoined_shouldReturnRoomIdempotently() throws Exception {
        // Idempotent join: re-joining a room you're already a member of just
        // returns the room (FE then navigates back into the lobby) instead of
        // surfacing a confusing "already a member" error.
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1"))
                .thenReturn(Optional.of(new RoomPlayer()));

        Room result = roomService.joinRoom("ABC123", playerUser);

        assertEquals("room-1", result.getId());
        // No new player added, no stale-lobby cleanup triggered.
        verify(roomPlayerRepository, never()).save(any(RoomPlayer.class));
        verify(roomPlayerRepository, never()).findActiveRoomIdsByUserId(anyString());
    }

    // ── RoomDetailsDTO quiz set context exposure ────────────────────────────

    @Test
    void getRoomDetails_withQuizSet_populatesQuizSetContextFields() throws Exception {
        testRoom.setGroupQuizSetId("qs-1");
        var group = new com.biblequiz.modules.group.entity.ChurchGroup();
        group.setId("group-1");
        var qs = new com.biblequiz.modules.group.entity.GroupQuizSet();
        qs.setId("qs-1");
        qs.setName("Sáng Thế Ký · Chương 1");
        qs.setGroup(group);
        qs.setQuestionIds(List.of("q1", "q2", "q3", "q4"));

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of());
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));

        var details = roomService.getRoomDetails("room-1");

        assertEquals("qs-1", details.groupQuizSetId);
        assertEquals("Sáng Thế Ký · Chương 1", details.groupQuizSetName);
        assertEquals(Integer.valueOf(4), details.quizSetTotalQuestions);
        assertEquals("group-1", details.groupId);
    }

    @Test
    void getRoomDetails_withoutQuizSet_quizSetFieldsNull() throws Exception {
        testRoom.setGroupQuizSetId(null);

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of());

        var details = roomService.getRoomDetails("room-1");

        assertNull(details.groupQuizSetId);
        assertNull(details.groupQuizSetName);
        assertNull(details.quizSetTotalQuestions);
        assertNull(details.groupId);
        verify(groupQuizSetRepository, never()).findById(anyString());
    }

    // ── joinRoom: SECURITY (Audit Gap 1 — group quiz set membership gate) ────

    @Test
    void joinRoom_coPlayRoom_member_succeeds() throws Exception {
        // Member of the group owning the quiz set must be able to join.
        testRoom.setGroupQuizSetId("qs-1");
        var group = new com.biblequiz.modules.group.entity.ChurchGroup();
        group.setId("group-1");
        var qs = new com.biblequiz.modules.group.entity.GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);
        var member = new com.biblequiz.modules.group.entity.GroupMember();
        member.setRole(com.biblequiz.modules.group.entity.GroupMember.GroupRole.MEMBER);

        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1"))
                .thenReturn(Optional.empty());
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "player-1"))
                .thenReturn(Optional.of(member));
        when(roomPlayerRepository.findActiveRoomIdsByUserId("player-1")).thenReturn(List.of());
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomRepository.save(any(Room.class))).thenReturn(testRoom);

        Room result = roomService.joinRoom("ABC123", playerUser);

        assertEquals("room-1", result.getId());
        verify(roomPlayerRepository).save(any(RoomPlayer.class));
    }

    @Test
    void joinRoom_coPlayRoom_nonMember_throwsForbidden() {
        testRoom.setGroupQuizSetId("qs-1");
        var group = new com.biblequiz.modules.group.entity.ChurchGroup();
        group.setId("group-1");
        var qs = new com.biblequiz.modules.group.entity.GroupQuizSet();
        qs.setId("qs-1");
        qs.setGroup(group);

        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1"))
                .thenReturn(Optional.empty());
        when(groupQuizSetRepository.findById("qs-1")).thenReturn(Optional.of(qs));
        when(groupMemberRepository.findByGroupIdAndUserId("group-1", "player-1"))
                .thenReturn(Optional.empty()); // NOT a member

        Exception ex = assertThrows(Exception.class,
                () -> roomService.joinRoom("ABC123", playerUser));
        assertTrue(ex.getMessage().contains("thanh vien"),
                "Expected forbidden message, got: " + ex.getMessage());
        verify(roomPlayerRepository, never()).save(any(RoomPlayer.class));
    }

    @Test
    void joinRoom_regularRoom_noMembershipCheck() throws Exception {
        // Regression: rooms WITHOUT groupQuizSetId must skip the membership
        // gate entirely (existing public/private multiplayer behavior).
        testRoom.setGroupQuizSetId(null);

        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1"))
                .thenReturn(Optional.empty());
        when(roomPlayerRepository.findActiveRoomIdsByUserId("player-1")).thenReturn(List.of());
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomRepository.save(any(Room.class))).thenReturn(testRoom);

        Room result = roomService.joinRoom("ABC123", playerUser);

        assertEquals("room-1", result.getId());
        verify(groupQuizSetRepository, never()).findById(anyString());
        verify(groupMemberRepository, never()).findByGroupIdAndUserId(anyString(), anyString());
    }

    @Test
    void joinRoom_coPlayRoom_existingPlayer_skipsMembershipCheck() throws Exception {
        // Mid-game rejoin: even if the user got removed from the group,
        // the existing RoomPlayer row keeps them in the round they're already in.
        testRoom.setGroupQuizSetId("qs-1");

        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1"))
                .thenReturn(Optional.of(new RoomPlayer()));

        Room result = roomService.joinRoom("ABC123", playerUser);

        assertEquals("room-1", result.getId());
        verify(groupQuizSetRepository, never()).findById(anyString());
    }

    // ── joinRoom: GAP-J 1-active-room-per-user (SPEC v1.1 §8.7) ──────────────

    @Test
    void joinRoom_userInAnotherActiveRoom_shouldThrowAlreadyInAnotherRoom() {
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1")).thenReturn(Optional.empty());
        when(roomPlayerRepository.findActiveRoomIdsByUserId("player-1"))
                .thenReturn(List.of("other-room-id"));

        Exception ex = assertThrows(Exception.class,
                () -> roomService.joinRoom("ABC123", playerUser));
        assertEquals("ALREADY_IN_ANOTHER_ROOM", ex.getMessage());
        verify(roomPlayerRepository, never()).save(any(RoomPlayer.class));
    }

    @Test
    void joinRoom_userInSameRoom_isNotBlockedByActiveCheck() throws Exception {
        // Edge case: the active-rooms query returns the room they're trying
        // to join (race between the membership check and the active query).
        // Should fall through to addPlayer instead of throwing.
        when(roomRepository.findByRoomCode("ABC123")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "player-1")).thenReturn(Optional.empty());
        when(roomPlayerRepository.findActiveRoomIdsByUserId("player-1"))
                .thenReturn(List.of("room-1")); // same room as target
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomRepository.save(any(Room.class))).thenReturn(testRoom);

        Room result = roomService.joinRoom("ABC123", playerUser);

        assertEquals("room-1", result.getId());
        verify(roomPlayerRepository).save(any(RoomPlayer.class));
    }

    // ── startRoom: host implicitly ready ─────────────────────────────────────

    @Test
    void startRoom_hostNotReadyButOthersReady_shouldStart() throws Exception {
        // Bug fix 2026-05-07: host clicking "Start" implies they're ready —
        // they don't need to also click "Ready" on themselves first. Only
        // non-host players are checked.
        testRoom.setCurrentPlayers(2); // canStart() requires >= 2

        RoomPlayer hostPlayer = new RoomPlayer("hp-1", testRoom, hostUser, "Host");
        hostPlayer.setIsReady(false); // host hasn't toggled ready
        RoomPlayer otherPlayer = new RoomPlayer("op-1", testRoom, playerUser, "Player");
        otherPlayer.setIsReady(true);

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1"))
                .thenReturn(List.of(hostPlayer, otherPlayer));
        when(roomRepository.markInProgressIfLobby(eq("room-1"), any())).thenReturn(1);

        roomService.startRoom("room-1", "host-1");

        assertEquals(Room.RoomStatus.IN_PROGRESS, testRoom.getStatus());
    }

    @Test
    void startRoom_otherPlayerNotReady_shouldThrow() {
        testRoom.setCurrentPlayers(2);

        RoomPlayer hostPlayer = new RoomPlayer("hp-1", testRoom, hostUser, "Host");
        hostPlayer.setIsReady(true);
        RoomPlayer otherPlayer = new RoomPlayer("op-1", testRoom, playerUser, "Player");
        otherPlayer.setIsReady(false); // not ready

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1"))
                .thenReturn(List.of(hostPlayer, otherPlayer));

        Exception ex = assertThrows(Exception.class,
                () -> roomService.startRoom("room-1", "host-1"));
        assertEquals("Tất cả người chơi phải sẵn sàng", ex.getMessage());
    }

    @Test
    void startRoom_secondConcurrentStart_throwsAndDoesNotStartTwice() {
        // PCV-4: hai lần bấm "Bắt đầu" cùng lúc (Đấu nhanh: hai người chơi) — lệnh cập nhật
        // có điều kiện chỉ thành công một lần; lần sau nhận 0 dòng ⇒ báo lỗi, không chạy vòng thứ hai.
        RoomPlayer hostPlayer = new RoomPlayer("hp-1", testRoom, hostUser, "Host");
        RoomPlayer otherPlayer = new RoomPlayer("op-1", testRoom, playerUser, "Player");
        otherPlayer.setIsReady(true);
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of(hostPlayer, otherPlayer));
        when(roomRepository.markInProgressIfLobby(eq("room-1"), any())).thenReturn(0);

        Exception ex = assertThrows(Exception.class, () -> roomService.startRoom("room-1", "host-1"));
        assertEquals("Phòng đã bắt đầu", ex.getMessage());
    }

    @Test
    void revertStart_putsRoomBackInLobby() {
        testRoom.setStatus(Room.RoomStatus.IN_PROGRESS);
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));

        roomService.revertStart("room-1");

        assertEquals(Room.RoomStatus.LOBBY, testRoom.getStatus());
        assertNull(testRoom.getStartedAt());
        verify(roomRepository).save(testRoom);
    }

    @Test
    void startRoom_battleRoyaleWithTwoPlayers_throwsModeMinimum() {
        // PCV-5: Sinh tồn cần ≥ 3 người.
        testRoom.setMode(Room.RoomMode.BATTLE_ROYALE);
        RoomPlayer hostPlayer = new RoomPlayer("hp-1", testRoom, hostUser, "Host");
        RoomPlayer otherPlayer = new RoomPlayer("op-1", testRoom, playerUser, "Player");
        otherPlayer.setIsReady(true);
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of(hostPlayer, otherPlayer));

        Exception ex = assertThrows(Exception.class, () -> roomService.startRoom("room-1", "host-1"));
        assertEquals("Sinh tồn cần ít nhất 3 người chơi", ex.getMessage());
        verify(roomRepository, never()).markInProgressIfLobby(any(), any());
    }

    @Test
    void createRoom_suddenDeathMaxPlayersCappedAt12() {
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(Room.class))).thenAnswer(inv -> inv.getArgument(0));

        Room r = roomService.createRoom("Phòng", hostUser, 40, 10, 20, Room.RoomMode.SUDDEN_DEATH, false,
                Room.RoomDifficulty.MIXED, "ALL", Room.QuestionSource.DATABASE, null, Boolean.FALSE);

        assertEquals(12, r.getMaxPlayers());
    }

    // ── startRoom: Sprint 4 Quản trò mode ────────────────────────────────────

    @Test
    void startRoom_quanTroModeTwoNonHostPlayersReady_shouldStart() throws Exception {
        // Quan Tro mode: host is NOT a RoomPlayer; need ≥2 non-host RoomPlayers.
        testRoom.setHostPlaysGame(false);

        User other = new User();
        other.setId("player-2");
        other.setName("Other Player");
        RoomPlayer p1 = new RoomPlayer("rp-1", testRoom, playerUser, "Player");
        p1.setIsReady(true);
        RoomPlayer p2 = new RoomPlayer("rp-2", testRoom, other, "Other");
        p2.setIsReady(true);

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of(p1, p2));
        when(roomRepository.markInProgressIfLobby(eq("room-1"), any())).thenReturn(1);

        roomService.startRoom("room-1", "host-1");

        assertEquals(Room.RoomStatus.IN_PROGRESS, testRoom.getStatus());
    }

    @Test
    void startRoom_quanTroModeOnlyOneNonHostPlayer_shouldThrowQuanTroMessage() {
        testRoom.setHostPlaysGame(false);
        RoomPlayer p1 = new RoomPlayer("rp-1", testRoom, playerUser, "Player");
        p1.setIsReady(true);

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of(p1));

        Exception ex = assertThrows(Exception.class,
                () -> roomService.startRoom("room-1", "host-1"));
        assertEquals("Cần ít nhất 2 người chơi (không tính Quản trò)", ex.getMessage());
    }

    @Test
    void startRoom_quanTroModePlayerNotReady_shouldThrow() {
        testRoom.setHostPlaysGame(false);
        User other = new User();
        other.setId("player-2");
        other.setName("Other");
        RoomPlayer p1 = new RoomPlayer("rp-1", testRoom, playerUser, "Player");
        p1.setIsReady(true);
        RoomPlayer p2 = new RoomPlayer("rp-2", testRoom, other, "Other");
        p2.setIsReady(false); // not ready

        when(roomRepository.findById("room-1")).thenReturn(Optional.of(testRoom));
        when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(List.of(p1, p2));

        Exception ex = assertThrows(Exception.class,
                () -> roomService.startRoom("room-1", "host-1"));
        assertEquals("Tất cả người chơi phải sẵn sàng", ex.getMessage());
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
