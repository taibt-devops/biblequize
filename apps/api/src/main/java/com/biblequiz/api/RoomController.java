package com.biblequiz.api;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.service.RoomQuizService;
import com.biblequiz.modules.room.service.RoomService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
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

    /**
     * POST /api/rooms - Tạo phòng mới
     */
    @PostMapping
    public ResponseEntity<?> createRoom(@RequestBody Map<String, Object> body, Principal principal) {
        try {
            User user = getUser(principal);

            String roomName = (String) body.getOrDefault("roomName", "Phòng của " + user.getName());
            Integer maxPlayers = body.get("maxPlayers") instanceof Number n ? n.intValue() : 4;
            Integer questionCount = body.get("questionCount") instanceof Number n ? n.intValue() : 10;
            Integer timePerQuestion = body.get("timePerQuestion") instanceof Number n ? n.intValue() : 30;
            String modeStr = body.get("mode") instanceof String s ? s : "SPEED_RACE";
            Boolean isPublic = body.get("isPublic") instanceof Boolean b ? b : false;
            String difficultyStr = body.get("difficulty") instanceof String s ? s : "MIXED";
            String bookScope = body.get("bookScope") instanceof String s ? s : "ALL";
            String questionSourceStr = body.get("questionSource") instanceof String s ? s : "DATABASE";

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

            Room room = roomService.createRoom(roomName, user, maxPlayers, questionCount, timePerQuestion, mode, isPublic, difficulty, bookScope, questionSource);
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(room.getId());

            return ResponseEntity.ok(Map.of("success", true, "room", details));
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

            return ResponseEntity.ok(Map.of("success", true, "room", details));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/rooms/{id} - Lấy thông tin phòng
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getRoomDetails(@PathVariable String id) {
        try {
            RoomService.RoomDetailsDTO details = roomService.getRoomDetails(id);
            return ResponseEntity.ok(Map.of("success", true, "room", details));
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
            roomQuizService.runQuiz(id, details.questionCount, details.timePerQuestion, mode);

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
            return ResponseEntity.ok(Map.of("success", true, "room", details));
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
     * GET /api/rooms/public - Danh sách phòng công khai đang lobby
     */
    @GetMapping("/public")
    public ResponseEntity<?> getPublicRooms() {
        try {
            return ResponseEntity.ok(Map.of("success", true, "rooms", roomService.getPublicRooms()));
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
