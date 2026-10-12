package com.biblequiz.api;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.ranked.service.UserTierService;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.service.DailyQuickMatchCounter;
import com.biblequiz.modules.room.service.HostControlService;
import com.biblequiz.modules.room.service.QuickMatchQuestionSourceService;
import com.biblequiz.modules.room.service.RoomQuizService;
import com.biblequiz.modules.room.service.RoomAnalyticsService;
import com.biblequiz.modules.room.service.RoomModeRules;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.room.service.RoomStateService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomQuizService roomQuizService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomWebSocketController roomWebSocketController;

    @Autowired
    private RoomStateService roomStateService;

    @Autowired
    private RoomAnalyticsService roomAnalyticsService;

    @Autowired
    private HostControlService hostControlService;

    @Autowired
    private DailyQuickMatchCounter dailyQuickMatchCounter;

    @Autowired
    private QuickMatchQuestionSourceService quickMatchQuestionSource;

    @Autowired
    private UserTierService userTierService;

    /**
     * POST /api/rooms - Tạo phòng mới
     */
    @PostMapping
    public ResponseEntity<?> createRoom(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);

            String rawName = body.get("roomName") instanceof String s ? s.trim() : "";
            if (!rawName.isEmpty()) {
                if (rawName.length() < 5)  throw new IllegalArgumentException("Tên phòng phải có ít nhất 5 ký tự");
                if (rawName.length() > 60) throw new IllegalArgumentException("Tên phòng tối đa 60 ký tự");
                if (rawName.matches("^(.)\\1+$")) throw new IllegalArgumentException("Tên phòng không hợp lệ");
            }
            String roomName = rawName.isEmpty() ? "Phòng của " + user.getName() : rawName;
            Integer maxPlayers = body.get("maxPlayers") instanceof Number n ? n.intValue() : 4;
            Integer questionCount = body.get("questionCount") instanceof Number n ? n.intValue() : 10;
            Integer timePerQuestion = body.get("timePerQuestion") instanceof Number n ? n.intValue() : 30;
            String modeStr = body.get("mode") instanceof String s ? s : "SPEED_RACE";
            Boolean isPublic = body.get("isPublic") instanceof Boolean b ? b : false;
            String difficultyStr = body.get("difficulty") instanceof String s ? s : "MIXED";
            String bookScope = body.get("bookScope") instanceof String s ? s : "ALL";
            String questionSourceStr = body.get("questionSource") instanceof String s ? s : "DATABASE";
            String questionSetId = body.get("questionSetId") instanceof String s ? s : null;
            // Sprint 4 (host-organizer): default false → user-created multiplayer
            // rooms put the creator in Quản trò mode (no answers, only orchestration).
            // FE may pass true explicitly for legacy/practice flows.
            Boolean hostPlaysGame = body.get("hostPlaysGame") instanceof Boolean b ? b : Boolean.FALSE;

            Room.RoomMode mode;
            try {
                mode = Room.RoomMode.valueOf(modeStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                mode = Room.RoomMode.SPEED_RACE;
            }

            Room.RoomDifficulty difficulty;
            try {
                difficulty = Room.RoomDifficulty.valueOf(difficultyStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                difficulty = Room.RoomDifficulty.MIXED;
            }

            Room.QuestionSource questionSource;
            try {
                questionSource = Room.QuestionSource.valueOf(questionSourceStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                questionSource = Room.QuestionSource.DATABASE;
            }

            // PCV-5: máy chủ tự kẹp cài đặt (form vốn đúng; chặn gói tin sửa tay). Bộ câu tự soạn
            // giữ số câu của bộ.
            if (questionSource == Room.QuestionSource.DATABASE) {
                questionCount = RoomModeRules.clampQuestionCount(questionCount);
            }
            timePerQuestion = RoomModeRules.clampTimePerQuestion(timePerQuestion);

            String language = body.get("language") instanceof String s && !s.isBlank() ? s : "vi";
            Room room = roomService.createRoom(roomName, user, maxPlayers, questionCount, timePerQuestion, mode, isPublic, difficulty, bookScope, questionSource, questionSetId, hostPlaysGame, language);
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(room.getId());

            return ResponseEntity.ok(Map.of("success", true, "room", details, "viewerUserId", user.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * QP-2 — POST /api/rooms/quick-match
     *
     * Always-create Đấu Nhanh room with the creator's chosen config
     * (mode / bookScope / questionCount / timePerQuestion / source).
     * Soft-host: creator plays like a regular player (hostPlaysGame=true)
     * but Quản trò controls reject (QP-5). PCV-8: chỉ dùng kho câu hỏi đã biên tập,
     * không còn giới hạn theo ngày.
     *
     * Error codes (422): AI_SOURCE_DISABLED
     */
    @PostMapping("/quick-match")
    public ResponseEntity<?> createQuickMatch(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);

            // Parse config
            String modeStr = body.get("mode") instanceof String s ? s : "SPEED_RACE";
            String bookScope = body.get("bookScope") instanceof String s && !s.isBlank() ? s : "ALL";
            int questionCount = body.get("questionCount") instanceof Number n ? n.intValue() : 10;
            int timePerQuestion = body.get("timePerQuestion") instanceof Number n ? n.intValue() : 30;
            int maxPlayers = body.get("maxPlayers") instanceof Number n ? n.intValue() : 10;
            String sourceStr = body.get("source") instanceof String s ? s : "DATABASE";

            if (questionCount < 5 || questionCount > 20) questionCount = 10;
            if (timePerQuestion < 10 || timePerQuestion > 60) timePerQuestion = 30;
            if (maxPlayers < 2 || maxPlayers > 100) maxPlayers = 10;

            Room.RoomMode mode;
            try { mode = Room.RoomMode.valueOf(modeStr.toUpperCase()); }
            catch (IllegalArgumentException e) { mode = Room.RoomMode.SPEED_RACE; }

            Room.QuestionSource source;
            try { source = Room.QuestionSource.valueOf(sourceStr.toUpperCase()); }
            catch (IllegalArgumentException e) { source = Room.QuestionSource.DATABASE; }

            // PCV-8 (Phòng chơi v2): tắt nguồn câu AI cho trận trực tiếp — câu AI chưa được duyệt
            // (đi ngược bộ câu RVV11 đã biên tập) và luồng vào trận chưa từng dùng chúng (mỗi lần
            // chọn AI là tốn tiền gọi AI vô ích). Giới hạn 3 trận/ngày cũng chỉ dành cho AI nên bỏ.
            if (source == Room.QuestionSource.AI_GENERATED) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "error", "AI_SOURCE_DISABLED",
                        "message", "Câu hỏi do AI tạo đang tạm tắt cho Đấu nhanh — trận dùng kho câu hỏi đã biên tập"));
            }

            String language = body.get("language") instanceof String s && !s.isBlank() ? s : "vi";
            List<String> preselectedIds = quickMatchQuestionSource.pickDatabaseIds(bookScope, questionCount, language);

            Room room = roomService.createQuickMatchRoom(user, mode, bookScope, questionCount, timePerQuestion,
                    maxPlayers, Room.QuestionSource.DATABASE, preselectedIds, null);

            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(room.getId());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "room", details,
                    "viewerUserId", user.getId(),
                    "quickMatch", true,
                    // Giữ trường cho client cũ; không còn giới hạn theo ngày.
                    "remainingToday", com.biblequiz.modules.room.service.DailyQuickMatchCounter.DAILY_CAP));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/rooms/join - Tham gia phòng theo mã
     */
    @PostMapping("/join")
    public ResponseEntity<?> joinRoom(@RequestBody Map<String, String> body, Principal principal) {
        try {
            User user = getUser(principal);
            String roomCode = body.get("roomCode");
            if (roomCode == null || roomCode.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Thiếu mã phòng"));
            }

            Room room = roomService.joinRoom(roomCode.trim().toUpperCase(), user);
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(room.getId());

            // Broadcast PLAYER_JOINED so existing subscribers (e.g. the host) see the new player immediately
            WebSocketMessage.PlayerJoinedData playerData = new WebSocketMessage.PlayerJoinedData(
                    user.getId(), user.getName(), user.getAvatarUrl(),
                    details.players.stream()
                            .filter(p -> p.userId.equals(user.getId()))
                            .findFirst()
                            .orElse(null));
            roomWebSocketController.sendToRoom(room.getId(),
                    new WebSocketMessage.Message(WebSocketMessage.MessageTypes.PLAYER_JOINED, playerData));

            return ResponseEntity.ok(Map.of("success", true, "room", details, "viewerUserId", user.getId()));
        } catch (Exception e) {
            // SPEC v1.1 §8.7: structured 422 so FE can prompt user to leave
            // their current room before joining another.
            if ("ALREADY_IN_ANOTHER_ROOM".equals(e.getMessage())) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "code", "ALREADY_IN_ANOTHER_ROOM",
                        "message", "Bạn đang ở trong một phòng khác. Hãy rời phòng đó trước."));
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/rooms/{id} - Lấy thông tin phòng.
     * Response shape: { success, room, viewerUserId? }. `viewerUserId` is the
     * caller's userId (null if unauthenticated) and is intentionally returned
     * outside the room DTO so the same DTO can be safely broadcast over WS
     * (per-viewer fields don't belong in multicast snapshots).
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getRoomDetails(@PathVariable String id, Principal principal) {
        try {
            String viewerUserId = null;
            if (principal != null) {
                try { viewerUserId = getUser(principal).getId(); } catch (Exception ignored) {}
            }
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(id);
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("success", true);
            body.put("room", details);
            body.put("viewerUserId", viewerUserId);
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/rooms/{id}/start - Bắt đầu quiz (chỉ host)
     */
    @PostMapping("/{id}/start")
    public ResponseEntity<?> startRoom(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(id);

            roomService.startRoom(id, user.getId());

            // Chạy quiz bất đồng bộ với mode
            Room.RoomMode mode = details.mode != null ? details.mode : Room.RoomMode.SPEED_RACE;
            try {
                roomQuizService.runQuiz(id, details.questionCount, details.timePerQuestion, mode);
            } catch (org.springframework.core.task.TaskRejectedException busy) {
                // PCV-4: hết luồng cho trận — đưa phòng về sảnh chờ để bấm lại được.
                roomService.revertStart(id);
                return ResponseEntity.status(503).body(Map.of(
                        "success", false,
                        "code", "SERVER_BUSY",
                        "message", "Máy chủ đang bận, thử lại sau ít phút"));
            }

            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/rooms/{id}/leave - Rời phòng
     */
    @PostMapping("/{id}/leave")
    public ResponseEntity<?> leaveRoom(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            roomService.leaveRoom(id, user.getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/rooms/{id}/switch-team - Đổi đội (Team vs Team, lobby only)
     */
    @PostMapping("/{id}/switch-team")
    public ResponseEntity<?> switchTeam(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            roomService.switchTeam(id, user.getId());
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(id);
            return ResponseEntity.ok(Map.of("success", true, "room", details, "viewerUserId", user.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * PCV-17: POST /api/rooms/{id}/rematch — "Chơi lại với nhóm này": mở (hoặc lấy) phòng mới cùng cài đặt.
     */
    @PostMapping("/{id}/rematch")
    public ResponseEntity<?> rematch(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            RoomService.RematchResult result = roomService.rematch(id, user);
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(result.room.getId());
            return ResponseEntity.ok(Map.of("success", true, "room", details, "viewerUserId", user.getId(),
                    "created", result.created));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    /**
     * PCV-14: POST /api/rooms/{id}/shuffle-teams — xáo lại hai đội cho cân (Đội đấu đội, ở sảnh chờ).
     */
    @PostMapping("/{id}/shuffle-teams")
    public ResponseEntity<?> shuffleTeams(@PathVariable String id, Principal principal) {
        try {
            User user = getUser(principal);
            roomService.shuffleTeams(id, user.getId());
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(id);
            return ResponseEntity.ok(Map.of("success", true, "room", details, "viewerUserId", user.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * POST /api/rooms/{id}/kick - Kick player (host only, lobby only)
     */
    @PostMapping("/{id}/kick")
    public ResponseEntity<?> kickPlayer(@PathVariable String id,
                                        @RequestBody Map<String, String> body,
                                        Principal principal) {
        try {
            User user = getUser(principal);
            String targetUserId = body.get("userId");
            if (targetUserId == null || targetUserId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Thiếu userId"));
            }
            roomService.kickPlayer(id, user.getId(), targetUserId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (RuntimeException e) {
            if ("FORBIDDEN".equals(e.getMessage())) {
                return ResponseEntity.status(403).body(Map.of("success", false, "message", "Chỉ host mới được kick"));
            }
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/rooms/{id}/current-question - Trả câu hỏi hiện tại được cache
     * trong Redis để client (re-joiner mid-game) có thể rehydrate state mà
     * không cần đợi QUESTION_START tiếp theo. Trả 204 nếu chưa có hoặc đã clear.
     */
    @GetMapping("/{id}/current-question")
    public ResponseEntity<?> getCurrentQuestion(@PathVariable String id) {
        return roomStateService.getCurrentQuestion(id)
                .<ResponseEntity<?>>map(q -> ResponseEntity.ok(Map.of("success", true, "question", q)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * GET /api/rooms/{id}/chat — MPC-7: replay the room's chat history (from
     * Redis) so a reload / late-join on the lobby or results screen recovers
     * the conversation. Returns oldest → newest; empty list if none/expired.
     */
    @GetMapping("/{id}/chat")
    public ResponseEntity<?> getChatHistory(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "messages", roomStateService.getChatHistory(id)));
    }

    /**
     * GET /api/rooms/public - Danh sách phòng công khai đang lobby.
     * Viewer-aware: PublicRoomDTO.joinable computes true only when the
     * caller can actually take the click action (capacity for LOBBY,
     * existing member for IN_PROGRESS rejoin).
     */
    @GetMapping("/public")
    public ResponseEntity<?> getPublicRooms(Principal principal) {
        try {
            String viewerUserId = null;
            if (principal != null) {
                try { viewerUserId = getUser(principal).getId(); } catch (Exception ignored) {}
            }
            return ResponseEntity.ok(Map.of("success", true, "rooms", roomService.getPublicRooms(viewerUserId)));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "rooms", java.util.List.of(), "message", e.getMessage()));
        }
    }

    /**
     * GET /api/rooms/{id}/leaderboard - Bảng xếp hạng phòng
     */
    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<?> getLeaderboard(@PathVariable String id) {
        return ResponseEntity.ok(Map.of("success", true, "leaderboard", roomService.getRoomLeaderboard(id)));
    }

    /**
     * GET /api/rooms/{id}/analytics — per-question breakdown of a room
     * (post-game). Joins room_rounds + room_answers + questions to give
     * the FE analytics page question text, correct index, answer
     * distribution, and avg reaction time per round.
     */
    @GetMapping("/{id}/analytics")
    public ResponseEntity<?> getRoomAnalytics(@PathVariable String id) {
        try {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "rounds", roomAnalyticsService.getRoomAnalytics(id)));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "rounds", java.util.List.of(),
                    "message", e.getMessage()));
        }
    }

    // ── Sprint 4: Quản trò controls ──────────────────────────────────────────

    /**
     * QP-5: reject Quản trò controls on Đấu Nhanh rooms. Throws
     * RuntimeException("QUICK_MATCH_NO_HOST_CONTROLS") which the per-endpoint
     * catch surfaces as HTTP 422 with the canonical error code.
     */
    private void assertNotQuickMatch(String roomId) {
        Room room = roomService.getRoomEntity(roomId);
        if (room != null && room.isQuickMatch()) {
            throw new RuntimeException("QUICK_MATCH_NO_HOST_CONTROLS");
        }
    }

    private ResponseEntity<?> handleHostError(Exception e) {
        if ("QUICK_MATCH_NO_HOST_CONTROLS".equals(e.getMessage())) {
            return ResponseEntity.unprocessableEntity().body(Map.of(
                    "success", false,
                    "error", "QUICK_MATCH_NO_HOST_CONTROLS",
                    "message", "Quản trò không khả dụng trong phòng Đấu Nhanh"));
        }
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
    }

    @PostMapping("/{id}/host/pause")
    public ResponseEntity<?> pauseGame(@PathVariable String id, Principal principal) {
        try {
            assertNotQuickMatch(id);
            hostControlService.pauseGame(id, getUser(principal).getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) { return handleHostError(e); }
    }

    @PostMapping("/{id}/host/resume")
    public ResponseEntity<?> resumeGame(@PathVariable String id, Principal principal) {
        try {
            assertNotQuickMatch(id);
            hostControlService.resumeGame(id, getUser(principal).getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) { return handleHostError(e); }
    }

    @PostMapping("/{id}/host/skip-question")
    public ResponseEntity<?> skipQuestion(@PathVariable String id, Principal principal) {
        try {
            assertNotQuickMatch(id);
            hostControlService.skipQuestion(id, getUser(principal).getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) { return handleHostError(e); }
    }

    @PostMapping("/{id}/host/broadcast")
    public ResponseEntity<?> broadcastHostMessage(@PathVariable String id,
                                                  @RequestBody Map<String, String> body,
                                                  Principal principal) {
        try {
            assertNotQuickMatch(id);
            String message = body != null ? body.get("message") : null;
            hostControlService.broadcastHostMessage(id, getUser(principal).getId(), message);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) { return handleHostError(e); }
    }

    @PostMapping("/{id}/host/end-early")
    public ResponseEntity<?> endGameEarly(@PathVariable String id, Principal principal) {
        try {
            assertNotQuickMatch(id);
            hostControlService.endGameEarly(id, getUser(principal).getId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) { return handleHostError(e); }
    }

    private User getUser(Principal principal) {
        if (principal == null) throw new RuntimeException("Chưa đăng nhập");
        // If principal is an OAuth2 session auth, getName() returns the provider sub ID, not email.
        // Extract email from OAuth2 attributes when applicable.
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof OAuth2User oauth2User) {
            String email = oauth2User.getAttribute("email");
            if (email != null) {
                return userRepository.findByEmail(email)
                        .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
            }
        }
        return userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));
    }
}
