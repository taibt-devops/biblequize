package com.biblequiz.api;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.room.service.RoomAnswerProcessor;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.RoomStateService;
import com.biblequiz.modules.room.service.SequentialScoringService;
import com.biblequiz.modules.room.service.SpeedRaceScoringService;
import com.biblequiz.modules.room.service.mode.RoomModeRegistry;
import com.biblequiz.modules.room.service.mode.SequentialStrategy;
import com.biblequiz.modules.room.service.mode.SpeedRaceStrategy;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomWebSocketControllerTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private RoomService roomService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoomStateService roomStateService;

    @Mock
    private RoomPlayerRepository roomPlayerRepository;

    @Mock
    private RoomAnswerRepository roomAnswerRepository;

    @Mock
    private RoomRoundRepository roomRoundRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private SpeedRaceScoringService speedRaceScoringService;

    @Mock
    private SequentialScoringService sequentialScoringService;

    @Mock
    private RoomRepository roomRepository;

    @InjectMocks
    private RoomWebSocketController controller;

    private User testUser;
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test Player");
        testUser.setEmail("test@example.com");
        testUser.setAvatarUrl("https://avatar.url");

        authentication = mock(Authentication.class);
        lenient().when(authentication.getName()).thenReturn("test@example.com");

        // Real answer pipeline wired with the same mocks so the existing
        // handleAnswer_* assertions still exercise validation/persistence.
        RoomModeRegistry registry = new RoomModeRegistry(List.of(
                new SpeedRaceStrategy(speedRaceScoringService),
                new SequentialStrategy(sequentialScoringService)));
        RoomAnswerProcessor answerProcessor = new RoomAnswerProcessor(
                roomStateService, roomAnswerRepository, roomRoundRepository,
                roomPlayerRepository, questionRepository, roomRepository, registry);
        ReflectionTestUtils.setField(controller, "answerProcessor", answerProcessor);
    }

    // ── handlePlayerJoin ─────────────────────────────────────────────────────

    @Test
    void handlePlayerJoin_shouldBroadcastPlayerJoined() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        var room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("ABC");
        room.setRoomName("Test");
        room.setHost(testUser);
        room.setMaxPlayers(4);
        room.setCurrentPlayers(1);
        room.setQuestionCount(10);
        room.setTimePerQuestion(30);
        room.setMode(com.biblequiz.modules.room.entity.Room.RoomMode.SPEED_RACE);
        room.setIsPublic(false);
        room.setStatus(com.biblequiz.modules.room.entity.Room.RoomStatus.LOBBY);

        RoomService.RoomDetailsDTO realDetails = new RoomService.RoomDetailsDTO(room, List.of());
        when(roomService.getRoomDetails("room-1")).thenReturn(realDetails);
        when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.empty());

        controller.handlePlayerJoin("room-1", Map.of(), authentication);

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        WebSocketMessage.Message sent = msgCaptor.getValue();
        assertEquals(WebSocketMessage.MessageTypes.PLAYER_JOINED, sent.getType());
    }

    @Test
    void questionStartData_4argCtor_populatesStartedAtMsWithSystemTime() {
        long before = System.currentTimeMillis();
        WebSocketMessage.QuestionStartData data = new WebSocketMessage.QuestionStartData(
                3, 15, Map.of("id", "q-3"), 30);
        long after = System.currentTimeMillis();

        assertNotNull(data.startedAtMs);
        assertTrue(data.startedAtMs >= before && data.startedAtMs <= after,
                "startedAtMs should be between " + before + " and " + after + ", got " + data.startedAtMs);
        assertEquals(3, data.questionIndex);
        assertEquals(30, data.timeLimit);
    }

    @Test
    void questionStartData_5argCtor_acceptsExplicitStartedAtMs() {
        WebSocketMessage.QuestionStartData data = new WebSocketMessage.QuestionStartData(
                0, 10, Map.of(), 30, 1_700_000_000_000L);
        assertEquals(1_700_000_000_000L, data.startedAtMs);
    }

    @Test
    void handlePlayerJoin_withActiveQuestion_shouldResyncQuestion() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        var room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("ABC");
        room.setRoomName("Test");
        room.setHost(testUser);
        room.setMaxPlayers(4);
        room.setCurrentPlayers(1);
        room.setQuestionCount(10);
        room.setTimePerQuestion(30);
        room.setMode(com.biblequiz.modules.room.entity.Room.RoomMode.SPEED_RACE);
        room.setIsPublic(false);
        room.setStatus(com.biblequiz.modules.room.entity.Room.RoomStatus.IN_PROGRESS);

        when(roomService.getRoomDetails("room-1")).thenReturn(new RoomService.RoomDetailsDTO(room, List.of()));

        WebSocketMessage.QuestionStartData questionData = new WebSocketMessage.QuestionStartData(1, 10, Map.of("id", "q-1"), 30);
        when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.of(questionData));

        controller.handlePlayerJoin("room-1", Map.of(), authentication);

        // Should send 2 messages: PLAYER_JOINED + QUESTION_START (resync)
        verify(messagingTemplate, times(2)).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    // ── handlePlayerLeave ────────────────────────────────────────────────────

    @Test
    void handlePlayerLeave_shouldBroadcastPlayerLeft() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        controller.handlePlayerLeave("room-1", Map.of(), authentication);

        verify(roomService).leaveRoom("room-1", "user-1");

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        assertEquals(WebSocketMessage.MessageTypes.PLAYER_LEFT, msgCaptor.getValue().getType());
    }

    // ── handlePlayerReady ────────────────────────────────────────────────────

    @Test
    void handlePlayerReady_shouldToggleAndBroadcast() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        var room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("ABC");
        room.setRoomName("Test");
        room.setHost(testUser);
        room.setMaxPlayers(4);
        room.setCurrentPlayers(1);
        room.setQuestionCount(10);
        room.setTimePerQuestion(30);
        room.setMode(com.biblequiz.modules.room.entity.Room.RoomMode.SPEED_RACE);
        room.setIsPublic(false);
        room.setStatus(com.biblequiz.modules.room.entity.Room.RoomStatus.LOBBY);

        var roomPlayer = new RoomPlayer();
        roomPlayer.setUser(testUser);
        roomPlayer.setIsReady(true);

        when(roomService.getRoomDetails("room-1")).thenReturn(new RoomService.RoomDetailsDTO(room, List.of(roomPlayer)));

        controller.handlePlayerReady("room-1", authentication);

        verify(roomService).togglePlayerReady("room-1", "user-1");

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        String type = msgCaptor.getValue().getType();
        assertTrue(type.equals(WebSocketMessage.MessageTypes.PLAYER_READY)
                || type.equals(WebSocketMessage.MessageTypes.PLAYER_UNREADY));
    }

    // ── handleStartQuiz ──────────────────────────────────────────────────────

    @Test
    void handleStartQuiz_shouldBroadcastRoomStarting() {
        controller.handleStartQuiz("room-1", Map.of(), authentication);

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        assertEquals(WebSocketMessage.MessageTypes.ROOM_STARTING, msgCaptor.getValue().getType());
    }

    // ── handleAnswerSubmission ───────────────────────────────────────────────

    @Test
    void handleAnswer_validAnswer_shouldBroadcastAndUpdateScore() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));
        when(roomAnswerRepository.existsByRoundIdAndUserId("round-1", "user-1")).thenReturn(false);

        RoomPlayer roomPlayer = new RoomPlayer();
        roomPlayer.setUser(testUser);
        roomPlayer.setScore(0);
        roomPlayer.setTotalAnswered(0);
        roomPlayer.setCorrectAnswers(0);
        roomPlayer.setAverageReactionTime(0.0);
        roomPlayer.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "user-1")).thenReturn(Optional.of(roomPlayer));

        // Mock question state
        Question question = new Question();
        question.setId("q-1");
        question.setCorrectAnswer(List.of(2));
        when(questionRepository.findById("q-1")).thenReturn(Optional.of(question));

        // PCV-1: máy chủ chỉ tin 5000 ms khi câu đã chạy được khoảng đó (phát 5,5 s trước).
        WebSocketMessage.QuestionStartData questionState = new WebSocketMessage.QuestionStartData(
                0, 10, Map.of("id", "q-1"), 30, System.currentTimeMillis() - 5_500);
        when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.of(questionState));
        when(speedRaceScoringService.calculateScore(true, 30, 5000)).thenReturn(133);

        RoomRound round = new RoomRound();
        round.setId("round-1");
        when(roomRoundRepository.findById("round-1")).thenReturn(Optional.of(round));

        // Mock getRoomDetails for broadcastScoreUpdate
        var room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("ABC");
        room.setRoomName("Test");
        room.setHost(testUser);
        room.setMaxPlayers(4);
        room.setCurrentPlayers(1);
        room.setQuestionCount(10);
        room.setTimePerQuestion(30);
        room.setMode(com.biblequiz.modules.room.entity.Room.RoomMode.SPEED_RACE);
        room.setIsPublic(false);
        room.setStatus(com.biblequiz.modules.room.entity.Room.RoomStatus.IN_PROGRESS);

        when(roomService.getRoomDetails("room-1")).thenReturn(new RoomService.RoomDetailsDTO(room, List.of(roomPlayer)));

        Map<String, Object> payload = Map.of(
                "questionIndex", 0,
                "answerIndex", 2,
                "reactionTimeMs", 5000);

        controller.handleAnswerSubmission("room-1", payload, authentication);

        // Should save answer
        verify(roomAnswerRepository).save(any(RoomAnswer.class));
        // Should update player score
        verify(roomPlayerRepository).save(argThat(p -> p.getScore() == 133));
        // Should broadcast ANSWER_SUBMITTED + SCORE_UPDATE
        verify(messagingTemplate, atLeast(2)).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    @Test
    void handleAnswer_duplicateAnswer_shouldBeIgnored() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));
        when(roomAnswerRepository.existsByRoundIdAndUserId("round-1", "user-1")).thenReturn(true);

        // Lenient: controller returns early before reaching this mock
        RoomPlayer roomPlayer = new RoomPlayer();
        roomPlayer.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        lenient().when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "user-1")).thenReturn(Optional.of(roomPlayer));

        Map<String, Object> payload = Map.of("questionIndex", 0, "answerIndex", 1, "reactionTimeMs", 3000);

        controller.handleAnswerSubmission("room-1", payload, authentication);

        // Should NOT broadcast anything (duplicate blocked)
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(WebSocketMessage.Message.class));
    }

    @Test
    void handleAnswer_eliminatedPlayer_shouldBeIgnored() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));
        when(roomAnswerRepository.existsByRoundIdAndUserId("round-1", "user-1")).thenReturn(false);

        RoomPlayer roomPlayer = new RoomPlayer();
        roomPlayer.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED);
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "user-1")).thenReturn(Optional.of(roomPlayer));

        Map<String, Object> payload = Map.of("questionIndex", 0, "answerIndex", 1, "reactionTimeMs", 3000);

        controller.handleAnswerSubmission("room-1", payload, authentication);

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(WebSocketMessage.Message.class));
    }

    @Test
    void handleAnswer_leftPlayer_shouldBeIgnored() {
        // 2026-06-12: a player marked LEFT by the disconnect-grace handler can
        // still have a live STOMP session (slept tab waking up). Their answer
        // must be rejected — it would otherwise bump correctAnswers, the BR
        // final-ranking tie-break, while they are "out of the room".
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));
        when(roomAnswerRepository.existsByRoundIdAndUserId("round-1", "user-1")).thenReturn(false);

        RoomPlayer roomPlayer = new RoomPlayer();
        roomPlayer.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "user-1")).thenReturn(Optional.of(roomPlayer));

        Map<String, Object> payload = Map.of("questionIndex", 0, "answerIndex", 1, "reactionTimeMs", 3000);

        controller.handleAnswerSubmission("room-1", payload, authentication);

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(WebSocketMessage.Message.class));
    }

    // ── Broadcast helpers ────────────────────────────────────────────────────

    @Test
    void broadcastQuestionStart_shouldStoreStateAndSend() {
        Question q = new Question();
        q.setId("q-1");

        controller.broadcastQuestionStart("room-1", 0, 10, q, 30);

        verify(roomStateService).setCurrentQuestion(eq("room-1"), any(WebSocketMessage.QuestionStartData.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    @Test
    void broadcastQuizEnd_shouldClearStateAndSend() {
        controller.broadcastQuizEnd("room-1", List.of());

        verify(roomStateService).clearRoomState("room-1");
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    @Test
    void broadcastRoundEnd_shouldSendCorrectIndexAndLeaderboard() {
        when(roomService.getRoomLeaderboard("room-1")).thenReturn(List.of());

        controller.broadcastRoundEnd("room-1", 2);

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        assertEquals(WebSocketMessage.MessageTypes.ROUND_END, msgCaptor.getValue().getType());
    }

    @Test
    void broadcastRoundEnd_closesRoundBeforeRevealing() {
        when(roomService.getRoomLeaderboard("room-1")).thenReturn(List.of());

        controller.broadcastRoundEnd("room-1", 2);

        var order = inOrder(roomStateService, messagingTemplate);
        order.verify(roomStateService).closeCurrentRound("room-1");
        order.verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    @Test
    void broadcastQuestionRevealed_closesRoundBeforeRevealing() throws Exception {
        when(roomAnswerRepository.findByRoundId("round-1")).thenReturn(List.of());
        var room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("ABC");
        room.setRoomName("Test");
        room.setHost(testUser);
        room.setMode(com.biblequiz.modules.room.entity.Room.RoomMode.GROUP_LIVE_SEQUENTIAL);
        when(roomService.getRoomDetails("room-1")).thenReturn(new RoomService.RoomDetailsDTO(room, List.of()));
        when(roomService.getRoomLeaderboard("room-1")).thenReturn(List.of());

        controller.broadcastQuestionRevealed("room-1", "round-1", 1, "giải thích");

        var order = inOrder(roomStateService, messagingTemplate);
        order.verify(roomStateService).closeCurrentRound("room-1");
        order.verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    @Test
    void broadcastPlayerEliminated_shouldSendEliminationData() {
        controller.broadcastPlayerEliminated("room-1", "user-1", "Player1", 3, 2);

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        assertEquals(WebSocketMessage.MessageTypes.PLAYER_ELIMINATED, msgCaptor.getValue().getType());
    }

    @Test
    void broadcastTeamAssignment_shouldSendTeamData() {
        var players = List.of(
                new WebSocketMessage.TeamAssignmentData.TeamPlayerInfo("u1", "Player1", "A"),
                new WebSocketMessage.TeamAssignmentData.TeamPlayerInfo("u2", "Player2", "B"));

        controller.broadcastTeamAssignment("room-1", players);

        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    @Test
    void broadcastMatchStart_shouldSendSuddenDeathData() {
        controller.broadcastMatchStart("room-1", "u1", "Champion", 3, "u2", "Challenger", 5);

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        assertEquals(WebSocketMessage.MessageTypes.MATCH_START, msgCaptor.getValue().getType());
    }

    // ── Error handling ───────────────────────────────────────────────────────

    @Test
    void handlePlayerJoin_withError_shouldBroadcastError() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.empty());

        controller.handlePlayerJoin("room-1", Map.of(), authentication);

        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        assertEquals(WebSocketMessage.MessageTypes.ERROR, msgCaptor.getValue().getType());
    }

    // ── TC-ROOM-003: Timeout — question auto-advances (server-side) ──────────

    @Test
    void broadcastQuestionStart_shouldSetRoundAndQuestion() {
        Question q = new Question();
        q.setId("q-timeout");

        RoomRound round = new RoomRound();
        round.setId("round-timeout");

        controller.broadcastQuestionStart("room-1", 3, 10, q, 15);

        // Verify state is stored for the current question
        verify(roomStateService).setCurrentQuestion(eq("room-1"), argThat(data ->
                data.questionIndex == 3 && data.totalQuestions == 10 && data.timeLimit == 15));

        // Verify question broadcast
        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());
        assertEquals(WebSocketMessage.MessageTypes.QUESTION_START, msgCaptor.getValue().getType());
    }

    // ── TC-ROOM-004: Player reconnect mid-game — state resync ────────────────

    @Test
    void handlePlayerJoin_midGame_shouldResyncQuestionAndState() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        var room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("XYZ");
        room.setRoomName("Reconnect Test");
        room.setHost(testUser);
        room.setMaxPlayers(4);
        room.setCurrentPlayers(2);
        room.setQuestionCount(10);
        room.setTimePerQuestion(30);
        room.setMode(com.biblequiz.modules.room.entity.Room.RoomMode.SPEED_RACE);
        room.setIsPublic(false);
        room.setStatus(com.biblequiz.modules.room.entity.Room.RoomStatus.IN_PROGRESS);

        RoomPlayer player = new RoomPlayer();
        player.setUser(testUser);
        player.setScore(250);
        player.setTotalAnswered(5);
        player.setCorrectAnswers(3);
        player.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);

        when(roomService.getRoomDetails("room-1"))
                .thenReturn(new RoomService.RoomDetailsDTO(room, List.of(player)));

        // Active question at index 5 — player should receive this on reconnect
        WebSocketMessage.QuestionStartData activeQuestion = new WebSocketMessage.QuestionStartData(
                5, 10, Map.of("id", "q-5", "content", "Question 5"), 30);
        when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.of(activeQuestion));

        controller.handlePlayerJoin("room-1", Map.of(), authentication);

        // Should broadcast PLAYER_JOINED + resync QUESTION_START
        ArgumentCaptor<WebSocketMessage.Message> msgCaptor = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate, times(2)).convertAndSend(eq("/topic/room/room-1"), msgCaptor.capture());

        List<WebSocketMessage.Message> messages = msgCaptor.getAllValues();
        assertEquals(WebSocketMessage.MessageTypes.PLAYER_JOINED, messages.get(0).getType());
        assertEquals(WebSocketMessage.MessageTypes.QUESTION_START, messages.get(1).getType());
    }

    @Test
    void handlePlayerJoin_lobbyNoActiveQuestion_shouldOnlyBroadcastJoin() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        var room = new com.biblequiz.modules.room.entity.Room();
        room.setId("room-1");
        room.setRoomCode("LBY");
        room.setRoomName("Lobby Room");
        room.setHost(testUser);
        room.setMaxPlayers(4);
        room.setCurrentPlayers(1);
        room.setQuestionCount(10);
        room.setTimePerQuestion(30);
        room.setMode(com.biblequiz.modules.room.entity.Room.RoomMode.SPEED_RACE);
        room.setIsPublic(false);
        room.setStatus(com.biblequiz.modules.room.entity.Room.RoomStatus.LOBBY);

        when(roomService.getRoomDetails("room-1"))
                .thenReturn(new RoomService.RoomDetailsDTO(room, List.of()));
        when(roomStateService.getCurrentQuestion("room-1")).thenReturn(Optional.empty());

        controller.handlePlayerJoin("room-1", Map.of(), authentication);

        // Should only broadcast PLAYER_JOINED (no question resync in lobby)
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/room/room-1"), any(WebSocketMessage.Message.class));
    }

    // ── TC-ROOM: Duplicate answer in same round — ignored ────────────────────

    @Test
    void handleAnswer_sameRoundSameUser_secondAttemptIgnored() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));

        // First call: not yet answered
        when(roomAnswerRepository.existsByRoundIdAndUserId("round-1", "user-1")).thenReturn(true);

        RoomPlayer roomPlayer = new RoomPlayer();
        roomPlayer.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        lenient().when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "user-1")).thenReturn(Optional.of(roomPlayer));

        Map<String, Object> payload = Map.of("questionIndex", 0, "answerIndex", 0, "reactionTimeMs", 2000);
        controller.handleAnswerSubmission("room-1", payload, authentication);

        // No messages should be sent for duplicate
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(WebSocketMessage.Message.class));
        verify(roomAnswerRepository, never()).save(any(RoomAnswer.class));
    }

    // ── handleChat ───────────────────────────────────────────────────────────

    @Test
    void handleChat_shouldBroadcastChatMessageWithSenderName() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        controller.handleChat("room-1", Map.of("text", "  Xin chào  "), authentication);

        ArgumentCaptor<WebSocketMessage.Message> captor =
                ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), captor.capture());

        WebSocketMessage.Message msg = captor.getValue();
        assertEquals(WebSocketMessage.MessageTypes.CHAT_MESSAGE, msg.getType());

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) msg.getData();
        assertEquals("Test Player", data.get("sender"));
        assertEquals("user-1", data.get("senderId"));
        assertEquals("Xin chào", data.get("text"), "Whitespace must be trimmed");
    }

    @Test
    void handleChat_shouldDropEmptyAndWhitespaceOnly() {
        controller.handleChat("room-1", Map.of("text", ""), authentication);
        controller.handleChat("room-1", Map.of("text", "   "), authentication);

        // Empty messages never reach the user lookup or the broker.
        verify(userRepository, never()).findByEmail(anyString());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(WebSocketMessage.Message.class));
    }

    @Test
    void handleChat_shouldTruncateOverlongMessagesTo500Chars() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        String longText = "a".repeat(800);
        controller.handleChat("room-1", Map.of("text", longText), authentication);

        ArgumentCaptor<WebSocketMessage.Message> captor =
                ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/room-1"), captor.capture());

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) captor.getValue().getData();
        assertEquals(500, ((String) data.get("text")).length());
    }

    @Test
    void handleChat_shouldIgnoreNonStringTextField() {
        controller.handleChat("room-1", Map.of("text", 42), authentication);
        controller.handleChat("room-1", Map.of("notText", "hi"), authentication);

        verify(userRepository, never()).findByEmail(anyString());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(WebSocketMessage.Message.class));
    }
}
