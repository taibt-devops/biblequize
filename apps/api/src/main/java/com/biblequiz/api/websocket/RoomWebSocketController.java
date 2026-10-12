package com.biblequiz.api.websocket;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.service.RoomAnswerProcessor;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.RoomStateService;
import com.biblequiz.modules.room.service.SequentialScoringService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Map;

@Controller
public class RoomWebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private RoomService roomService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomStateService roomStateService;

    @Autowired
    private RoomAnswerRepository roomAnswerRepository;

    @Autowired
    private RoomAnswerProcessor answerProcessor;

    @Autowired
    private SequentialScoringService sequentialScoringService;

    @Autowired
    private RoomRepository roomRepository;

    /**
     * Handle player joining room
     */
    @MessageMapping("/room/{roomId}/join")
    public void handlePlayerJoin(@DestinationVariable String roomId, @Payload Map<String, Object> payload,
            Authentication authentication) {
        try {
            String username = authentication.getName();
            User user = userRepository.findByEmail(username).orElseThrow();

            RoomService.RoomDetailsDTO roomDetails = roomService.getRoomDetails(roomId);

            WebSocketMessage.PlayerJoinedData playerData = new WebSocketMessage.PlayerJoinedData(
                    user.getId(),
                    user.getName(),
                    user.getAvatarUrl(),
                    roomDetails.players.stream()
                            .filter(p -> p.userId.equals(user.getId()))
                            .findFirst()
                            .orElse(null));

            WebSocketMessage.Message message = new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.PLAYER_JOINED, playerData);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, message);

            // Re-sync câu hỏi hiện tại nếu game đang chạy
            roomStateService.getCurrentQuestion(roomId).ifPresent(current -> {
                WebSocketMessage.Message syncMsg = new WebSocketMessage.Message(
                        WebSocketMessage.MessageTypes.QUESTION_START, current);
                messagingTemplate.convertAndSend("/topic/room/" + roomId, syncMsg);
            });

        } catch (Exception e) {
            sendError(roomId, "JOIN_ERROR", "Lỗi khi tham gia phòng: " + e.getMessage());
        }
    }

    /**
     * Handle player leaving room
     */
    @MessageMapping("/room/{roomId}/leave")
    public void handlePlayerLeave(@DestinationVariable String roomId, @Payload Map<String, Object> payload,
            Authentication authentication) {
        try {
            String username = authentication.getName();
            User user = userRepository.findByEmail(username).orElseThrow();

            roomService.leaveRoom(roomId, user.getId());

            Map<String, Object> leaveData = Map.of(
                    "playerId", user.getId(),
                    "username", user.getName());

            WebSocketMessage.Message message = new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.PLAYER_LEFT, leaveData);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, message);

        } catch (Exception e) {
            sendError(roomId, "LEAVE_ERROR", "Lỗi khi rời phòng: " + e.getMessage());
        }
    }

    /**
     * Handle toggling ready status
     */
    @MessageMapping("/room/{roomId}/ready")
    public void handlePlayerReady(@DestinationVariable String roomId, Authentication authentication) {
        try {
            String username = authentication.getName();
            User user = userRepository.findByEmail(username).orElseThrow();

            roomService.togglePlayerReady(roomId, user.getId());

            RoomService.RoomDetailsDTO roomDetails = roomService.getRoomDetails(roomId);
            RoomService.PlayerInfoDTO player = roomDetails.players.stream()
                    .filter(p -> p.userId.equals(user.getId()))
                    .findFirst()
                    .orElseThrow();

            WebSocketMessage.PlayerReadyData readyData = new WebSocketMessage.PlayerReadyData(
                    user.getId(), user.getName(), player.isReady);
            WebSocketMessage.Message message = new WebSocketMessage.Message(
                    player.isReady ? WebSocketMessage.MessageTypes.PLAYER_READY
                            : WebSocketMessage.MessageTypes.PLAYER_UNREADY,
                    readyData);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, message);

        } catch (Exception e) {
            sendError(roomId, "READY_ERROR", "Lỗi khi thay đổi trạng thái sẵn sàng: " + e.getMessage());
        }
    }

    /**
     * Handle starting quiz (broadcast only — actual start is done via REST /api/rooms/{id}/start)
     */
    @MessageMapping("/room/{roomId}/start")
    public void handleStartQuiz(@DestinationVariable String roomId, @Payload Map<String, Object> payload,
            Authentication authentication) {
        Map<String, Object> startData = Map.of(
                "roomId", roomId,
                "timestamp", System.currentTimeMillis());
        WebSocketMessage.Message message = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.ROOM_STARTING, startData);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }

    /**
     * Handle submitting answer — validation/scoring/persistence delegated to
     * {@link RoomAnswerProcessor}; this handler keeps the STOMP concerns
     * (principal extraction, payload parsing, broadcasts).
     */
    @MessageMapping("/room/{roomId}/answer")
    public void handleAnswerSubmission(@DestinationVariable String roomId, @Payload Map<String, Object> payload,
            Authentication authentication) {
        try {
            String username = authentication.getName();
            User user = userRepository.findByEmail(username).orElseThrow();

            int questionIndex = ((Number) payload.get("questionIndex")).intValue();
            int answerIndex = ((Number) payload.get("answerIndex")).intValue();
            int reactionTimeMs = ((Number) payload.get("reactionTimeMs")).intValue();

            RoomAnswerProcessor.AnswerResult result =
                    answerProcessor.process(roomId, user, answerIndex, reactionTimeMs);
            if (!result.accepted) {
                // Anti-cheat rejections stay silent (no error frame).
                return;
            }

            // PCV-2 (chống lộ đáp án): chỉ báo "đã trả lời". Phương án, đúng/sai, điểm và
            // thời gian của từng người chỉ được công bố ở ROUND_END / QUESTION_REVEALED khi
            // vòng đã đóng; không phát SCORE_UPDATE theo từng câu (điểm tăng = lộ đúng/sai).
            // HashMap (not Map.of) — tolerate a null display name (BUG FIX 2026-05-23).
            Map<String, Object> answerData = new java.util.HashMap<>();
            answerData.put("playerId", user.getId());
            answerData.put("username", result.displayName);
            answerData.put("questionIndex", questionIndex);
            answerData.put("answered", Boolean.TRUE);
            WebSocketMessage.Message message = new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.ANSWER_SUBMITTED, answerData);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, message);

            // Sequential coordination + progress broadcast
            if (result.deferredFeedback) {
                sequentialScoringService.recordAnswer(roomId);
                broadcastSequentialProgress(roomId,
                        sequentialScoringService.answeredCount(roomId),
                        sequentialScoringService.totalPlayers(roomId));
            }

        } catch (Exception e) {
            sendError(roomId, "ANSWER_ERROR", "Lỗi khi nộp câu trả lời: " + e.getMessage());
        }
    }

    /**
     * Host bấm "Sang câu tiếp" trong GROUP_LIVE_SEQUENTIAL mode.
     * Chỉ host mới được advance — release latch trong SequentialScoringService.
     */
    @MessageMapping("/room/{roomId}/advance")
    public void handleSequentialAdvance(@DestinationVariable String roomId, Authentication authentication) {
        try {
            String email = authentication.getName();
            User user = userRepository.findByEmail(email).orElseThrow();

            Room room = roomRepository.findById(roomId).orElse(null);
            if (room == null) return;
            if (room.getMode() != Room.RoomMode.GROUP_LIVE_SEQUENTIAL) {
                sendError(roomId, "INVALID_MODE", "Chỉ chế độ Chơi cùng nhau mới hỗ trợ Sang câu tiếp");
                return;
            }
            if (!user.getId().equals(room.getHost().getId())) {
                sendError(roomId, "NOT_HOST", "Chỉ trưởng phòng mới được chuyển câu");
                return;
            }
            sequentialScoringService.leaderAdvance(roomId);
        } catch (Exception e) {
            sendError(roomId, "ADVANCE_ERROR", "Lỗi khi chuyển câu: " + e.getMessage());
        }
    }

    private void sendError(String roomId, String errorType, String message) {
        WebSocketMessage.ErrorData errorData = new WebSocketMessage.ErrorData(errorType, message);
        WebSocketMessage.Message errorMessage = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.ERROR, errorData);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, errorMessage);
    }

    /**
     * Broadcast leaderboard update
     */
    public void broadcastLeaderboardUpdate(String roomId) {
        try {
            List<RoomService.LeaderboardEntryDTO> leaderboard = roomService.getRoomLeaderboard(roomId);
            WebSocketMessage.Message message = new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.LEADERBOARD_UPDATE, leaderboard);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
        } catch (Exception e) {
            sendError(roomId, "LEADERBOARD_ERROR", "Lỗi khi cập nhật bảng xếp hạng: " + e.getMessage());
        }
    }

    /**
     * Broadcast ROUND_END với correctIndex và leaderboard (sau khi timer hết)
     */
    public void broadcastRoundEnd(String roomId, int correctIndex) {
        // PCV-1: đóng vòng trước khi công bố đáp án — câu trả lời tới sau bị bỏ qua.
        roomStateService.closeCurrentRound(roomId);
        try {
            List<RoomService.LeaderboardEntryDTO> leaderboard = roomService.getRoomLeaderboard(roomId);
            sendRoundEnd(roomId, new WebSocketMessage.RoundEndData(correctIndex, leaderboard));
        } catch (Exception e) {
            sendError(roomId, "ROUND_END_ERROR", "Lỗi khi kết thúc câu: " + e.getMessage());
        }
    }

    /** PCV-2: công bố đầy đủ (giải thích, câu gốc, số người chọn, kết quả từng người). */
    public void broadcastRoundEnd(String roomId, WebSocketMessage.RoundEndData data) {
        roomStateService.closeCurrentRound(roomId);
        try {
            sendRoundEnd(roomId, data);
        } catch (Exception e) {
            sendError(roomId, "ROUND_END_ERROR", "Lỗi khi kết thúc câu: " + e.getMessage());
        }
    }

    private void sendRoundEnd(String roomId, WebSocketMessage.RoundEndData data) {
        messagingTemplate.convertAndSend("/topic/room/" + roomId,
                new WebSocketMessage.Message(WebSocketMessage.MessageTypes.ROUND_END, data));
    }

    /**
     * Broadcast score update for a specific player
     */
    public void broadcastScoreUpdate(String roomId, String playerId, int newScore, int correctAnswers,
            int totalAnswered) {
        try {
            RoomService.RoomDetailsDTO roomDetails = roomService.getRoomDetails(roomId);
            String username = roomDetails.players.stream()
                    .filter(p -> p.userId.equals(playerId))
                    .findFirst()
                    .map(p -> p.username)
                    .orElse("Unknown");

            WebSocketMessage.ScoreUpdateData scoreData = new WebSocketMessage.ScoreUpdateData(
                    playerId, username, newScore, correctAnswers, totalAnswered);
            WebSocketMessage.Message message = new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.SCORE_UPDATE, scoreData);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
        } catch (Exception e) {
            sendError(roomId, "SCORE_ERROR", "Lỗi khi cập nhật điểm: " + e.getMessage());
        }
    }

    /**
     * Broadcast question start
     */
    public void broadcastQuestionStart(String roomId, int questionIndex, int totalQuestions,
            Object question, int timeLimit) {
        WebSocketMessage.QuestionStartData questionData = new WebSocketMessage.QuestionStartData(
                questionIndex, totalQuestions, question, timeLimit);
        roomStateService.setCurrentQuestion(roomId, questionData);
        WebSocketMessage.Message message = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.QUESTION_START, questionData);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }

    /**
     * Broadcast quiz end
     */
    public void broadcastQuizEnd(String roomId, Object finalResults) {
        roomStateService.clearRoomState(roomId);
        Map<String, Object> endData = Map.of(
                "roomId", roomId,
                "timestamp", System.currentTimeMillis(),
                "finalResults", finalResults);
        WebSocketMessage.Message message = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.QUIZ_END, endData);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }

    /**
     * Sprint 2 S2-9 — server-emitted "system" chat lines for membership
     * events (join / leave / kick). FE renders messages with isSystem=true
     * in a different style; the unread badge ignores them so they don't
     * spam the chat indicator.
     */
    public void broadcastSystemChat(String roomId, String text) {
        Map<String, Object> data = Map.of(
                "sender", "SYSTEM",
                "text", text,
                "isSystem", true);
        messagingTemplate.convertAndSend("/topic/room/" + roomId,
                new WebSocketMessage.Message(WebSocketMessage.MessageTypes.CHAT_MESSAGE, data));
        // MPC-7: persist system lines too so reload shows join/leave context.
        roomStateService.appendChat(roomId, Map.of(
                "sender", "SYSTEM",
                "text", text,
                "isSystem", true,
                "ts", System.currentTimeMillis()));
    }

    /**
     * Sprint 2 S2-3 — atomic snapshot push so the FE can replace its
     * "fetchRoom on every PLAYER_* event" REST round-trips. The payload is
     * the same RoomDetailsDTO the REST GET endpoint serves; subscribers
     * just call setRoom(data) on receipt.
     *
     * <p>Best-effort: any exception from the snapshot read is swallowed so
     * a transient DB hiccup doesn't poison the original mutation flow
     * (the WS subscriber will catch up on the next mutation or via the
     * existing fetchRoom fallback).
     */
    public void broadcastRoomState(String roomId) {
        try {
            RoomService.RoomDetailsDTO snapshot = roomService.getRoomDetails(roomId);
            WebSocketMessage.Message msg = new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.ROOM_STATE, snapshot);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
        } catch (Exception e) {
            // Don't fail the calling mutation just because the snapshot
            // broadcast misfired — log and move on.
            org.slf4j.LoggerFactory.getLogger(RoomWebSocketController.class)
                    .warn("[ROOM-STATE] Failed to broadcast snapshot for room {}: {}",
                            roomId, e.getMessage());
        }
    }

    /**
     * SPEC §5.4.0 R4 — promote-on-host-disconnect notification. FE updates
     * its local hostId / hostName so the start button + crown move.
     */
    public void broadcastHostChanged(String roomId, String newHostId, String newHostName) {
        WebSocketMessage.HostChangedData data =
                new WebSocketMessage.HostChangedData(roomId, newHostId, newHostName);
        WebSocketMessage.Message msg = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.HOST_CHANGED, data);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
    }

    /**
     * SPEC §5.4.0 R1/R2/R5 — tell subscribers a room is going away
     * (cleanup, not a normal game finish). Emit BEFORE the room row is
     * deleted so the topic still has subscribers when the frame is sent.
     */
    public void broadcastRoomEnded(String roomId, String reason) {
        WebSocketMessage.RoomEndedData data = new WebSocketMessage.RoomEndedData(roomId, reason);
        WebSocketMessage.Message msg = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.ROOM_ENDED, data);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
    }

    /**
     * Broadcast player eliminated (Battle Royale)
     */
    public void broadcastPlayerEliminated(String roomId, String userId, String username, int rank, int activeRemaining) {
        WebSocketMessage.PlayerEliminatedData data =
                new WebSocketMessage.PlayerEliminatedData(userId, username, rank, activeRemaining);
        WebSocketMessage.Message msg = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.PLAYER_ELIMINATED, data);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
    }

    /**
     * Broadcast active player count update (Battle Royale)
     */
    public void broadcastBattleRoyaleUpdate(String roomId, int activeCount, int totalCount) {
        WebSocketMessage.BattleRoyaleUpdateData data =
                new WebSocketMessage.BattleRoyaleUpdateData(activeCount, totalCount);
        WebSocketMessage.Message msg = new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.BATTLE_ROYALE_UPDATE, data);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, msg);
    }

    /**
     * Broadcast team assignment (Team vs Team)
     */
    public void broadcastTeamAssignment(String roomId, java.util.List<WebSocketMessage.TeamAssignmentData.TeamPlayerInfo> players) {
        WebSocketMessage.TeamAssignmentData data = new WebSocketMessage.TeamAssignmentData(players);
        sendToRoom(roomId, new WebSocketMessage.Message(WebSocketMessage.MessageTypes.TEAM_ASSIGNMENT, data));
    }

    /**
     * Broadcast team score update (Team vs Team)
     */
    public void broadcastTeamScoreUpdate(String roomId, int scoreA, int scoreB) {
        WebSocketMessage.TeamScoreUpdateData data = new WebSocketMessage.TeamScoreUpdateData(scoreA, scoreB);
        sendToRoom(roomId, new WebSocketMessage.Message(WebSocketMessage.MessageTypes.TEAM_SCORE_UPDATE, data));
    }

    /**
     * Broadcast perfect round (Team vs Team)
     */
    public void broadcastPerfectRound(String roomId, boolean teamAPerfect, boolean teamBPerfect) {
        WebSocketMessage.PerfectRoundData data = new WebSocketMessage.PerfectRoundData(teamAPerfect, teamBPerfect);
        sendToRoom(roomId, new WebSocketMessage.Message(WebSocketMessage.MessageTypes.PERFECT_ROUND, data));
    }

    /**
     * Broadcast match start (Sudden Death)
     */
    public void broadcastMatchStart(String roomId, String championId, String championName, int championStreak,
                                    String challengerId, String challengerName, int queueRemaining) {
        WebSocketMessage.MatchStartData data = new WebSocketMessage.MatchStartData(
                championId, championName, championStreak, challengerId, challengerName, queueRemaining);
        sendToRoom(roomId, new WebSocketMessage.Message(WebSocketMessage.MessageTypes.MATCH_START, data));
    }

    /**
     * Broadcast match end (Sudden Death)
     */
    public void broadcastMatchEnd(String roomId, String winnerId, String winnerName, int winnerStreak,
                                  String loserId, String loserName) {
        WebSocketMessage.MatchEndData data = new WebSocketMessage.MatchEndData(
                winnerId, winnerName, winnerStreak, loserId, loserName);
        sendToRoom(roomId, new WebSocketMessage.Message(WebSocketMessage.MessageTypes.MATCH_END, data));
    }

    // ── Sprint 4: Quản trò control broadcasts ────────────────────────────────

    public void broadcastGamePaused(String roomId) {
        sendToRoom(roomId, new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.GAME_PAUSED,
                java.util.Map.of("roomId", roomId)));
    }

    public void broadcastGameResumed(String roomId) {
        sendToRoom(roomId, new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.GAME_RESUMED,
                java.util.Map.of("roomId", roomId)));
    }

    public void broadcastQuestionSkipped(String roomId) {
        sendToRoom(roomId, new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.QUESTION_SKIPPED,
                java.util.Map.of("roomId", roomId)));
    }

    public void broadcastHostMessage(String roomId, String hostId, String hostName, String message) {
        sendToRoom(roomId, new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.HOST_BROADCAST,
                java.util.Map.of(
                        "hostId", hostId,
                        "hostName", hostName != null ? hostName : "",
                        "message", message,
                        "timestamp", System.currentTimeMillis())));
    }

    /**
     * Handle real-time reaction (social fun).
     * Rate limited: max 3 reactions per 10 seconds per user (handled by WebSocket rate limiter).
     */
    @MessageMapping("/room/{roomId}/reaction")
    public void handleReaction(@DestinationVariable String roomId,
                                @Payload WebSocketMessage.ReactionData reaction,
                                Authentication authentication) {
        try {
            String username = authentication.getName();
            User user = userRepository.findByEmail(username).orElseThrow();
            reaction.setSenderId(user.getId());
            reaction.setSenderName(user.getName());

            sendToRoom(roomId, new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.REACTION, reaction));
        } catch (Exception e) {
            // Silently ignore reaction errors
        }
    }

    /**
     * Free-form chat broadcast inside a room. The client sends
     * {@code /app/room/{roomId}/chat} with payload {@code {text: "..."}};
     * the server stamps the sender's display name and re-broadcasts to
     * every subscriber on {@code /topic/room/{roomId}}.
     *
     * <p>Validation kept minimal: empty / whitespace-only text is dropped
     * silently (no error frame back) and overlong text is trimmed to 500
     * chars to bound payload size. Rate limiting is owned by
     * {@link com.biblequiz.infrastructure.security.WebSocketRateLimitInterceptor}
     * — chat shares the same per-user budget as other SEND frames.
     */
    @MessageMapping("/room/{roomId}/chat")
    public void handleChat(@DestinationVariable String roomId,
                           @Payload Map<String, Object> payload,
                           Authentication authentication) {
        if (payload == null) return;
        Object rawText = payload.get("text");
        if (!(rawText instanceof String s)) return;
        String text = s.trim();
        if (text.isEmpty()) return;
        if (text.length() > 500) text = text.substring(0, 500);

        try {
            String email = authentication.getName();
            User user = userRepository.findByEmail(email).orElseThrow();

            Map<String, Object> data = Map.of(
                    "sender", user.getName(),
                    "senderId", user.getId(),
                    "text", text);
            sendToRoom(roomId, new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.CHAT_MESSAGE, data));
            // MPC-7: persist so reload / late-join replays the conversation.
            roomStateService.appendChat(roomId, Map.of(
                    "sender", user.getName(),
                    "senderId", user.getId(),
                    "text", text,
                    "isSystem", false,
                    "ts", System.currentTimeMillis()));
        } catch (Exception e) {
            // Chat is best-effort — don't error-frame on missing user etc.
        }
    }

    /**
     * Broadcast sequential progress (Group Live Sequential — mỗi answer)
     */
    public void broadcastSequentialProgress(String roomId, int answered, int total) {
        WebSocketMessage.SequentialProgressData data =
                new WebSocketMessage.SequentialProgressData(answered, total);
        sendToRoom(roomId, new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.SEQUENTIAL_PROGRESS, data));
    }

    /**
     * Broadcast question revealed (Group Live Sequential — sau all-answered/timeout).
     * Includes correct answer, explanation, per-player answers, and current leaderboard.
     */
    public void broadcastQuestionRevealed(String roomId, String roundId, int correctIndex, String explanation) {
        // PCV-1: đóng vòng trước khi công bố đáp án (Chơi cùng nhau).
        roomStateService.closeCurrentRound(roomId);
        try {
            // Per-player answers cho round này
            List<RoomAnswer> answers = roomAnswerRepository.findByRoundId(roundId);
            Map<String, RoomAnswer> answerByUser = new java.util.HashMap<>();
            for (RoomAnswer a : answers) answerByUser.put(a.getUserId(), a);

            List<RoomService.PlayerInfoDTO> players = roomService.getRoomDetails(roomId).players;
            List<WebSocketMessage.QuestionRevealedData.PerPlayerAnswer> perPlayer = players.stream()
                    .map(p -> {
                        RoomAnswer a = answerByUser.get(p.userId);
                        return new WebSocketMessage.QuestionRevealedData.PerPlayerAnswer(
                                p.userId, p.username,
                                a != null ? (int) a.getAnswerIndex() : null,
                                a != null && a.getIsCorrect());
                    })
                    .collect(java.util.stream.Collectors.toList());

            List<RoomService.LeaderboardEntryDTO> leaderboard = roomService.getRoomLeaderboard(roomId);
            WebSocketMessage.QuestionRevealedData data =
                    new WebSocketMessage.QuestionRevealedData(correctIndex, explanation, perPlayer, leaderboard);
            sendToRoom(roomId, new WebSocketMessage.Message(
                    WebSocketMessage.MessageTypes.QUESTION_REVEALED, data));
        } catch (Exception e) {
            sendError(roomId, "REVEAL_ERROR", "Lỗi khi hiện đáp án: " + e.getMessage());
        }
    }

    /**
     * Send a generic message to a room topic
     */
    public void sendToRoom(String roomId, WebSocketMessage.Message message) {
        messagingTemplate.convertAndSend("/topic/room/" + roomId, message);
    }
}
