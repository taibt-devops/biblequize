package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.group.repository.GroupQuizSetRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class RoomService {

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomPlayerRepository roomPlayerRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GroupQuizSetRepository groupQuizSetRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    /** @Lazy breaks the dep cycle (RoomWebSocketController already injects
     *  RoomService). Used only for cleanup-path broadcasts; the normal
     *  per-event broadcasts already live in the controller. */
    @Autowired
    @Lazy
    private RoomWebSocketController webSocketController;

    /** SPEC §5.4.0 R2 — single source of truth for "lobby idle ⇒ kill"
     *  threshold. Both the per-user lazy cleanup and the global scheduler
     *  sweep read this; previously the two disagreed (1h vs 2h), which the
     *  audit flagged as G8. Default 30 min mirrors the FE admin config
     *  default and SPEC §5.4.0. */
    @org.springframework.beans.factory.annotation.Value("${biblequiz.room.idle-timeout-minutes:30}")
    private long idleTimeoutMinutes;

    long getIdleTimeoutMinutes() { return idleTimeoutMinutes; }

    /**
     * Create a new room
     */
    public Room createRoom(String roomName, User host, Integer maxPlayers, Integer questionCount,
                           Integer timePerQuestion, Room.RoomMode mode, Boolean isPublic,
                           Room.RoomDifficulty difficulty, String bookScope,
                           Room.QuestionSource questionSource, String questionSetId) {
        // Backward-compat overload: defaults hostPlaysGame=true (legacy mode where host plays).
        // ChurchGroup flows ("Tự ôn" + "Chơi cùng nhau") rely on this default; new user-created
        // multiplayer rooms come through the explicit overload below with hostPlaysGame=false.
        return createRoom(roomName, host, maxPlayers, questionCount, timePerQuestion, mode, isPublic,
                difficulty, bookScope, questionSource, questionSetId, Boolean.TRUE);
    }

    /**
     * Sprint 4 (host-organizer): explicit-mode overload. {@code hostPlaysGame=false} →
     * Quản trò mode, host is NOT added as a RoomPlayer (no answers, no scoring).
     * {@code hostPlaysGame=true/null} → legacy behavior, host IS a player.
     */
    public Room createRoom(String roomName, User host, Integer maxPlayers, Integer questionCount,
                           Integer timePerQuestion, Room.RoomMode mode, Boolean isPublic,
                           Room.RoomDifficulty difficulty, String bookScope,
                           Room.QuestionSource questionSource, String questionSetId,
                           Boolean hostPlaysGame) {
        return createRoom(roomName, host, maxPlayers, questionCount, timePerQuestion, mode, isPublic,
                difficulty, bookScope, questionSource, questionSetId, hostPlaysGame, null);
    }

    public Room createRoom(String roomName, User host, Integer maxPlayers, Integer questionCount,
                           Integer timePerQuestion, Room.RoomMode mode, Boolean isPublic,
                           Room.RoomDifficulty difficulty, String bookScope,
                           Room.QuestionSource questionSource, String questionSetId,
                           Boolean hostPlaysGame, String language) {
        String roomId = UUID.randomUUID().toString();
        String roomCode = generateRoomCode();

        while (roomRepository.findByRoomCode(roomCode).isPresent()) {
            roomCode = generateRoomCode();
        }

        Room room = new Room();
        room.setId(roomId);
        room.setRoomCode(roomCode);
        room.setRoomName(roomName);
        room.setHost(host);
        // PCV-5: trần số người theo mode (Đấu vương 12, còn lại 100), không nhỏ hơn số tối thiểu.
        room.setMaxPlayers(RoomModeRules.clampMaxPlayers(mode, maxPlayers));
        room.setQuestionCount(questionCount != null ? questionCount : 10);
        room.setTimePerQuestion(timePerQuestion != null ? timePerQuestion : 30);
        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMode(mode != null ? mode : Room.RoomMode.SPEED_RACE);
        room.setIsPublic(isPublic != null ? isPublic : false);
        room.setDifficulty(difficulty != null ? difficulty : Room.RoomDifficulty.MIXED);
        room.setBookScope(bookScope != null && !bookScope.isBlank() ? bookScope : "ALL");
        room.setLanguage(language != null && !language.isBlank() ? language : "vi");
        room.setQuestionSource(questionSource != null ? questionSource : Room.QuestionSource.DATABASE);
        if (questionSetId != null && !questionSetId.isBlank()) {
            room.setQuestionSetId(questionSetId);
        }
        room.setHostPlaysGame(hostPlaysGame != null ? hostPlaysGame : Boolean.FALSE);

        roomRepository.save(room);

        // Sprint 4: only add the host as a RoomPlayer in legacy mode. In Quản trò
        // mode the host stays only on Room.host FK (no answers, no scoring, no ranking).
        if (room.isHostPlaysGame()) {
            addPlayerToRoom(roomId, host);
        }

        return room;
    }

    /** QP-5 helper: returns Room entity or null if missing. Used by host
     *  control endpoints to short-circuit reject on quick-match rooms. */
    public Room getRoomEntity(String roomId) {
        return roomRepository.findById(roomId).orElse(null);
    }

    /**
     * QP-2 — Create a Quick Match (Đấu Nhanh) room. Always creates a new
     * room (NOT find-or-create, per Bùi pivot 2026-05-15) with the
     * creator's chosen config. Host plays like everyone (no Quản trò),
     * any player can /start when ≥2 ready (QP-5).
     *
     * <p>Source-specific behaviour:
     * <ul>
     *   <li>{@code DATABASE}: pre-picked question IDs are stored in
     *       {@code Room.customQuestionIds} JSON (anti-spoiler).
     *   <li>{@code AI_GENERATED}: AI-generated payload stored in
     *       {@code Room.aiQuestionsPayload} JSON (one-shot, never saved
     *       to {@code questions} table).
     * </ul>
     */
    public Room createQuickMatchRoom(User host, Room.RoomMode mode, String bookScope,
                                      Integer questionCount, Integer timePerQuestion, Integer maxPlayers,
                                      Room.QuestionSource source,
                                      List<String> preselectedIds, String aiPayloadJson) {
        String roomId = UUID.randomUUID().toString();
        String roomCode = generateRoomCode();
        while (roomRepository.findByRoomCode(roomCode).isPresent()) {
            roomCode = generateRoomCode();
        }

        Room room = new Room();
        room.setId(roomId);
        room.setRoomCode(roomCode);
        room.setRoomName("Phòng Đấu Nhanh của " + host.getName());
        room.setHost(host);
        // QMP-1: host-selectable cap (default 10), clamped to the same 2–100 range
        // as normal rooms. The join cap is enforced via room.isFull() on this field.
        // PCV-5: trần theo mode (Đấu vương 12); mặc định 10 người.
        room.setMaxPlayers(RoomModeRules.clampMaxPlayers(mode, maxPlayers != null ? maxPlayers : 10));
        room.setQuestionCount(questionCount != null ? questionCount : 10);
        room.setTimePerQuestion(timePerQuestion != null ? timePerQuestion : 30);
        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMode(mode != null ? mode : Room.RoomMode.SPEED_RACE);
        room.setIsPublic(true);
        room.setDifficulty(Room.RoomDifficulty.MIXED);
        room.setBookScope(bookScope != null && !bookScope.isBlank() ? bookScope : "ALL");
        room.setQuestionSource(source != null ? source : Room.QuestionSource.DATABASE);
        room.setHostPlaysGame(true);
        room.setQuickMatch(true);
        if (preselectedIds != null && !preselectedIds.isEmpty()) {
            room.setCustomQuestionIds(preselectedIds);
        }
        if (aiPayloadJson != null && !aiPayloadJson.isBlank()) {
            room.setAiQuestionsPayload(aiPayloadJson);
        }

        roomRepository.save(room);
        addPlayerToRoom(roomId, host);
        return room;
    }

    /**
     * Join a room by room code
     */
    public Room joinRoom(String roomCode, User user) throws Exception {
        Room room = roomRepository.findByRoomCode(roomCode)
            .orElseThrow(() -> new Exception("Phòng không tồn tại"));

        // 🚨 SECURITY (Audit Gap 1): co-play rooms tied to a group quiz set are
        // private to that group's members. Without this gate, anyone with the
        // 6-char room code could walk into a group's private quiz session.
        // Existing players (rejoin via existing RoomPlayer row) are exempt so a
        // member who got removed from the group mid-game can still finish the
        // round they're already in (kicking mid-game is out of scope here).
        if (room.getGroupQuizSetId() != null) {
            var existingPlayer = roomPlayerRepository.findByRoomIdAndUserId(room.getId(), user.getId());
            boolean isHost = room.getHost() != null && room.getHost().getId().equals(user.getId());
            if (existingPlayer.isEmpty() && !isHost) {
                var quizSet = groupQuizSetRepository.findById(room.getGroupQuizSetId())
                        .orElseThrow(() -> new Exception("Bo cau hoi khong ton tai"));
                String groupId = quizSet.getGroup() != null ? quizSet.getGroup().getId() : null;
                if (groupId == null
                        || groupMemberRepository.findByGroupIdAndUserId(groupId, user.getId()).isEmpty()) {
                    throw new Exception("Ban khong phai thanh vien cua nhom nay");
                }
            }
        }

        // Look up an existing membership first so we can support rejoin while
        // the room is IN_PROGRESS (Phase 6 case #3 — user left mid-game and
        // wants to come back to the same match).
        var existing = roomPlayerRepository.findByRoomIdAndUserId(room.getId(), user.getId());

        if (room.getStatus() == Room.RoomStatus.ENDED || room.getStatus() == Room.RoomStatus.CANCELLED) {
            throw new Exception("Phòng đã kết thúc");
        }

        if (room.getStatus() == Room.RoomStatus.IN_PROGRESS) {
            // Quản trò mode: the organizer host intentionally has NO RoomPlayer
            // row, so the rejoin-by-LEFT-row path below can never match them.
            // Let the host back into their own live room (no row created).
            boolean isOrganizerHost = !room.isHostPlaysGame()
                    && room.getHost() != null && room.getHost().getId().equals(user.getId());
            if (isOrganizerHost) {
                return room;
            }
            // Only previously-registered players can re-enter an in-progress
            // game. Brand-new joiners are blocked because there is no
            // late-join flow into an active quiz.
            if (existing.isEmpty()) {
                throw new Exception("Phòng đã bắt đầu");
            }
            RoomPlayer player = existing.get();
            if (player.getPlayerStatus() == RoomPlayer.PlayerStatus.LEFT) {
                player.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
                roomPlayerRepository.save(player);
                syncPlayerCount(room);
            }
            return room;
        }

        // From here: status == LOBBY.
        // Sprint 4: in Quản trò mode the host is intentionally NOT a RoomPlayer.
        // If they hit /join (e.g. via a stale link), short-circuit instead of
        // blowing up the "Phòng đã đầy người" check or accidentally adding them
        // as a player and breaking the no-host-in-scoring invariant.
        if (!room.isHostPlaysGame() && room.getHost() != null
                && room.getHost().getId().equals(user.getId())) {
            return room;
        }

        if (room.isFull()) {
            throw new Exception("Phòng đã đầy người");
        }

        // Idempotent join: if user is already a member of this room, just
        // return it so the FE navigates them back into the lobby instead of
        // surfacing a confusing "already a member" error banner.
        if (existing.isPresent()) {
            return room;
        }

        // SPEC v1.1 §8.7: a user can be in only one active room at a time.
        // First, opportunistically clean up *this user's* stale lobby rooms
        // (host abandoned, never started, > idleTimeoutMinutes old) so an old
        // test room doesn't permanently lock them out.
        cleanupStaleLobbyForUser(user.getId());

        // Filter out the room they're trying to join (no-op for normal flow,
        // defensive in case the prior check missed a race).
        List<String> otherActive = roomPlayerRepository.findActiveRoomIdsByUserId(user.getId())
                .stream()
                .filter(id -> !id.equals(room.getId()))
                .toList();
        if (!otherActive.isEmpty()) {
            throw new Exception("ALREADY_IN_ANOTHER_ROOM");
        }

        addPlayerToRoom(room.getId(), user);

        return room;
    }

    // Note: pre-2026-05 a constant STALE_LOBBY_HOURS=1 lived here. It now
    // shares the configured idleTimeoutMinutes value (audit G8). The
    // accessor above is the single source.

    /**
     * B-1: Lazy per-user cleanup. For each LOBBY room the user is still
     * registered in: if the room is older than the configured idle timeout,
     * either end it (when the user is host) or just remove the user
     * (when host is someone else — let the host decide what to do with
     * remaining players).
     *
     * <p>Called on every joinRoom so the cleanup cost is amortised against
     * actual usage; combined with B-2 ({@link RoomCleanupScheduler}) this
     * keeps the "max 1 active room" rule from latching on dead state.
     */
    void cleanupStaleLobbyForUser(String userId) {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(idleTimeoutMinutes);
        List<String> activeRoomIds = roomPlayerRepository.findActiveRoomIdsByUserId(userId);
        for (String roomId : activeRoomIds) {
            Room r = roomRepository.findById(roomId).orElse(null);
            if (r == null || r.getStatus() != Room.RoomStatus.LOBBY) continue;
            if (r.getCreatedAt() != null && r.getCreatedAt().isAfter(cutoff)) continue;
            // Stale.
            if (r.getHost() != null && userId.equals(r.getHost().getId())) {
                r.setStatus(Room.RoomStatus.ENDED);
                r.setEndedAt(LocalDateTime.now());
                roomRepository.save(r);
                webSocketController.broadcastRoomEnded(r.getId(),
                        WebSocketMessage.RoomEndedReason.IDLE_TIMEOUT);
            } else {
                roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                        .ifPresent(roomPlayerRepository::delete);
            }
        }
    }

    /**
     * B-2 helper: end every LOBBY room older than {@code cutoff}. Used by the
     * {@link RoomCleanupScheduler}; returns the number of rooms ended for
     * logging.
     */
    public int endLobbyRoomsOlderThan(LocalDateTime cutoff) {
        List<Room> stale = roomRepository.findStaleLobbyRooms(cutoff);
        LocalDateTime now = LocalDateTime.now();
        for (Room r : stale) {
            r.setStatus(Room.RoomStatus.ENDED);
            r.setEndedAt(now);
        }
        if (!stale.isEmpty()) {
            roomRepository.saveAll(stale);
            // Broadcast AFTER save so a transactional rollback on the save
            // doesn't leave clients with a phantom "ended" toast.
            for (Room r : stale) {
                webSocketController.broadcastRoomEnded(r.getId(),
                        WebSocketMessage.RoomEndedReason.IDLE_TIMEOUT);
            }
        }
        return stale.size();
    }

    /**
     * Add player to room (auto-assign team for Team vs Team).
     *
     * <p>Source of truth = RoomPlayer rows. We previously also maintained a
     * parallel {@code @ElementCollection} on {@link Room#players} plus a
     * cached {@link Room#currentPlayers} counter, both mutated via
     * {@code Room.addPlayer()}. That denormalised state drifted out of sync
     * with the RoomPlayer table (lobby UI showed 2 players while the counter
     * stayed at 1, blocking start). The collection has been removed
     * (V45 migration) and {@code currentPlayers} is now always recomputed
     * from {@link RoomPlayerRepository#countByRoomId(String)} after each
     * insert/delete.
     */
    private void addPlayerToRoom(String roomId, User user) {
        Room room = roomRepository.findById(roomId).orElseThrow();

        // Idempotent: if user is already a member, don't insert a duplicate.
        if (roomPlayerRepository.findByRoomIdAndUserId(roomId, user.getId()).isPresent()) {
            return;
        }
        if (room.isFull()) {
            throw new RuntimeException("Phòng đã đầy người");
        }

        String playerId = UUID.randomUUID().toString();
        RoomPlayer roomPlayer = new RoomPlayer(playerId, room, user, user.getName());

        // Auto-balance teams for Team vs Team
        if (room.getMode() == Room.RoomMode.TEAM_VS_TEAM) {
            List<RoomPlayer> existing = roomPlayerRepository.findByRoomId(roomId);
            long countA = existing.stream().filter(p -> p.getTeam() == RoomPlayer.Team.A).count();
            long countB = existing.stream().filter(p -> p.getTeam() == RoomPlayer.Team.B).count();
            roomPlayer.setTeam(countA <= countB ? RoomPlayer.Team.A : RoomPlayer.Team.B);
        }

        roomPlayerRepository.save(roomPlayer);
        syncPlayerCount(room);
        webSocketController.broadcastRoomState(roomId);
        // Sprint 2 S2-9: chat system message announcing the join. Skip
        // when the player is the room host themselves (the create flow
        // already adds the host, no need to chat about it).
        if (room.getHost() == null || !user.getId().equals(room.getHost().getId())) {
            webSocketController.broadcastSystemChat(roomId, user.getName() + " đã tham gia 👋");
        }
    }

    /**
     * Recompute {@link Room#currentPlayers} from the RoomPlayer table (the
     * authoritative source) and persist. Call after every insert/delete of a
     * RoomPlayer row so the cached counter stays in sync.
     */
    private void syncPlayerCount(Room room) {
        // currentPlayers reflects slots in use. Mid-game LEFT rows are
        // preserved for rejoin but should NOT block new joiners or inflate
        // the lobby roster count.
        int actual = (int) roomPlayerRepository.countOccupiedByRoomId(room.getId());
        room.setCurrentPlayers(actual);
        roomRepository.save(room);
    }

    /**
     * Switch player's team (Team vs Team, lobby only)
     */
    public void switchTeam(String roomId, String userId) throws Exception {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new Exception("Phòng không tồn tại"));
        if (room.getMode() != Room.RoomMode.TEAM_VS_TEAM) throw new Exception("Chỉ dùng cho Team vs Team");
        if (room.getStatus() != Room.RoomStatus.LOBBY) throw new Exception("Không thể đổi đội khi game đang chạy");

        RoomPlayer player = roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new Exception("Người chơi không tìm thấy"));
        player.setTeam(player.getTeam() == RoomPlayer.Team.A ? RoomPlayer.Team.B : RoomPlayer.Team.A);
        roomPlayerRepository.save(player);
        webSocketController.broadcastRoomState(roomId);
    }

    /**
     * Remove player from room
     */
    public void leaveRoom(String roomId, String userId) {
        Room room = roomRepository.findById(roomId).orElseThrow();

        // SPEC §5.4 / Phase 6 case #3: while a quiz is in progress we keep
        // the RoomPlayer row (status=LEFT) so the user can rejoin via
        // joinRoom. Hard-delete only happens in LOBBY (or after the game has
        // ended), so an interrupted-mid-game leave does not lock the user
        // out of their own match.
        boolean keepForRejoin = room.getStatus() == Room.RoomStatus.IN_PROGRESS;

        roomPlayerRepository.findByRoomIdAndUserId(roomId, userId).ifPresent(player -> {
            if (keepForRejoin) {
                player.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
                player.setIsReady(false);
                roomPlayerRepository.save(player);
            } else {
                roomPlayerRepository.delete(player);
            }
        });
        syncPlayerCount(room);

        if (room.getCurrentPlayers() == 0 && !keepForRejoin) {
            // SPEC §5.4.0 R1: announce before delete so any straggler still
            // subscribed (race condition with the FE leave navigate) gets a
            // proper redirect instead of silent topic loss.
            webSocketController.broadcastRoomEnded(room.getId(),
                    WebSocketMessage.RoomEndedReason.EMPTY_LOBBY);
            roomRepository.delete(room);
        } else {
            // Sprint 2 S2-3: snapshot push so other lobby members can update
            // the player list without a fetchRoom round-trip.
            webSocketController.broadcastRoomState(roomId);
            // Sprint 2 S2-9: announce the leave in chat (best-effort
            // username lookup; falls back to a generic line).
            String name = roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
                    .map(p -> p.getUsername())
                    .orElseGet(() -> userRepository.findById(userId).map(u -> u.getName()).orElse("Người chơi"));
            webSocketController.broadcastSystemChat(roomId, name + " đã rời phòng");
        }
    }

    /**
     * Kick player from room (host only, lobby only)
     */
    public void kickPlayer(String roomId, String hostUserId, String targetUserId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Phòng không tồn tại"));

        if (!room.getHost().getId().equals(hostUserId)) {
            throw new RuntimeException("FORBIDDEN");
        }

        if (room.getStatus() != Room.RoomStatus.LOBBY) {
            throw new RuntimeException("Chỉ kick được khi phòng đang ở lobby");
        }

        if (hostUserId.equals(targetUserId)) {
            throw new RuntimeException("Host không thể kick chính mình");
        }

        // Capture username before delete so the system chat line still
        // identifies who got removed.
        String targetName = roomPlayerRepository.findByRoomIdAndUserId(roomId, targetUserId)
                .map(p -> p.getUsername())
                .orElseGet(() -> userRepository.findById(targetUserId).map(u -> u.getName()).orElse("Người chơi"));
        roomPlayerRepository.findByRoomIdAndUserId(roomId, targetUserId)
                .ifPresent(roomPlayerRepository::delete);
        syncPlayerCount(room);
        webSocketController.broadcastRoomState(roomId);
        webSocketController.broadcastSystemChat(roomId, targetName + " đã bị mời ra khỏi phòng");
    }

    /**
     * Toggle player ready status
     */
    public void togglePlayerReady(String roomId, String userId) throws Exception {
        roomRepository.findById(roomId).orElseThrow(() -> new Exception("Phòng không tồn tại"));
        RoomPlayer roomPlayer = roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
            .orElseThrow(() -> new Exception("Người chơi không tìm thấy"));

        roomPlayer.setIsReady(!roomPlayer.getIsReady());
        roomPlayerRepository.save(roomPlayer);
        webSocketController.broadcastRoomState(roomId);
    }

    /**
     * Start quiz for room
     */
    public void startRoom(String roomId, String userId) throws Exception {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new Exception("Phòng không tồn tại"));

        // QP-5: Đấu Nhanh — any player in the room can start when conditions
        // below are met (no Quản trò privilege). Otherwise only the host.
        if (room.isQuickMatch()) {
            boolean inRoom = roomPlayerRepository.findByRoomIdAndUserId(roomId, userId).isPresent();
            if (!inRoom) {
                throw new Exception("Bạn không có trong phòng này");
            }
        } else if (!room.getHost().getId().equals(userId)) {
            throw new Exception("Chỉ chủ phòng mới có thể bắt đầu");
        }

        // Source of truth = RoomPlayer rows. Room.currentPlayers/Room.players is a
        // denormalised counter that has been observed to drift out of sync with the
        // RoomPlayer table (see lobby UI showing 2 players while currentPlayers=1).
        // Sprint 4: in Quản trò mode the host is NOT a RoomPlayer, so this count
        // already excludes them — same threshold (≥2) means "≥2 non-host players"
        // automatically. Legacy mode counts host + others (so ≥2 total).
        List<RoomPlayer> lobbyPlayers = roomPlayerRepository.findByRoomId(roomId);
        if (room.getStatus() != Room.RoomStatus.LOBBY) {
            throw new Exception("Phòng đã bắt đầu");
        }
        // PCV-5: số người tối thiểu + cân đội theo mode (RoomModeRules).
        String notReady = RoomModeRules.startError(room.getMode(), lobbyPlayers, room.isHostPlaysGame());
        if (notReady != null) {
            throw new Exception(notReady);
        }

        // GROUP_LIVE_SEQUENTIAL: leader dẫn dắt session, không cần ceremony "ready" như các mode khác.
        // Các mode khác (SPEED_RACE, BATTLE_ROYALE, ...) yêu cầu non-host players ready
        // trước khi bắt đầu. Host được coi là implicitly ready khi bấm "Bắt đầu" — không
        // cần phải tự bấm "Sẵn sàng" cho chính mình (UI ở các mode hiện tại không hiển thị
        // toggle ready cho host).
        if (room.getMode() != Room.RoomMode.GROUP_LIVE_SEQUENTIAL) {
            List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);
            boolean allOthersReady = players.stream()
                    .filter(p -> !p.getUser().getId().equals(userId))
                    .allMatch(RoomPlayer::getIsReady);
            if (!allOthersReady) {
                throw new Exception("Tất cả người chơi phải sẵn sàng");
            }
        }

        // PCV-4: cập nhật có điều kiện — hai lần bấm cùng lúc chỉ một lần thành công.
        LocalDateTime now = LocalDateTime.now();
        if (roomRepository.markInProgressIfLobby(roomId, now) == 0) {
            throw new Exception("Phòng đã bắt đầu");
        }
        room.setStatus(Room.RoomStatus.IN_PROGRESS);
        room.setStartedAt(now);
    }

    /**
     * PCV-4 — đưa phòng về sảnh chờ khi vòng chơi không khởi động được (máy chủ hết luồng),
     * để người chơi bấm bắt đầu lại được thay vì kẹt ở IN_PROGRESS không có vòng chơi.
     */
    public void revertStart(String roomId) {
        roomRepository.findById(roomId).ifPresent(room -> {
            room.setStatus(Room.RoomStatus.LOBBY);
            room.setStartedAt(null);
            roomRepository.save(room);
        });
    }

    /**
     * End quiz for room
     */
    public void endRoom(String roomId) {
        Room room = roomRepository.findById(roomId).orElseThrow();
        // Idempotent: a second end (e.g. abandonment scheduler racing the
        // normal runQuiz finish) is a no-op. Avoids bumping updated_at and
        // re-triggering downstream side-effects.
        if (room.getStatus() == Room.RoomStatus.ENDED) {
            return;
        }
        room.setStatus(Room.RoomStatus.ENDED);
        room.setEndedAt(LocalDateTime.now());
        roomRepository.save(room);
    }

    /**
     * SPEC §5.4.0 R4 — when the host's STOMP grace expires, hand the
     * room over to the longest-tenured ACTIVE non-host. Returns the new
     * host or empty if no eligible successor remains (caller should
     * end the room with reason HOST_GONE).
     */
    public Optional<User> promoteNextHost(String roomId) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) return Optional.empty();
        String oldHostId = room.getHost() != null ? room.getHost().getId() : "";
        List<RoomPlayer> candidates = roomPlayerRepository
                .findActiveNonHostsByJoinedAtAsc(roomId, oldHostId);
        if (candidates.isEmpty()) return Optional.empty();
        User newHost = candidates.get(0).getUser();
        room.setHost(newHost);
        roomRepository.save(room);
        return Optional.of(newHost);
    }

    /**
     * Mark a player's row as LEFT (used by the disconnect-grace handler
     * when the user did not reconnect in time). Mirrors the leaveRoom
     * "keep row for rejoin" behaviour: row stays for IN_PROGRESS, hard
     * delete for LOBBY.
     */
    public void markPlayerLeft(String roomId, String userId) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) return;
        boolean keepForRejoin = room.getStatus() == Room.RoomStatus.IN_PROGRESS;
        roomPlayerRepository.findByRoomIdAndUserId(roomId, userId).ifPresent(player -> {
            if (keepForRejoin) {
                player.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
                player.setIsReady(false);
                roomPlayerRepository.save(player);
            } else {
                roomPlayerRepository.delete(player);
            }
        });
        syncPlayerCount(room);
    }

    /** Count of slot-occupying players (excludes LEFT) for a room. */
    public long countOccupiedPlayers(String roomId) {
        return roomPlayerRepository.countOccupiedByRoomId(roomId);
    }

    /**
     * Get room details with players. Pure shared room state — viewer identity
     * (the "me" pointer) is intentionally NOT in the DTO so the same snapshot
     * can be safely multicast over WebSocket. Per-viewer context belongs in
     * the REST response wrapper or the FE auth store.
     */
    public RoomDetailsDTO getRoomDetails(String roomId) throws Exception {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new Exception("Phòng không tồn tại"));
        List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);

        // Derive owning group + quiz set context when room was created from a
        // group quiz set, so FE can reliably "back to group" + display "Đang
        // chơi: [Tên]" even after page refresh / deep link / fresh tab joining
        // via room code. Single fetch (no N+1) — getRoomDetails is per-room.
        String groupId = null;
        String quizSetName = null;
        Integer quizSetTotalQuestions = null;
        if (room.getGroupQuizSetId() != null) {
            var qsOpt = groupQuizSetRepository.findById(room.getGroupQuizSetId());
            if (qsOpt.isPresent()) {
                var qs = qsOpt.get();
                groupId = qs.getGroup() != null ? qs.getGroup().getId() : null;
                quizSetName = qs.getName();
                Object qids = qs.getQuestionIds();
                if (qids instanceof java.util.List<?> list) {
                    quizSetTotalQuestions = list.size();
                }
            }
        }

        return new RoomDetailsDTO(room, players, groupId, quizSetName, quizSetTotalQuestions);
    }

    /** Score DESC — Speed Race / Team vs Team / Sequential leaderboards. */
    public static final Comparator<RoomPlayer> ORDER_BY_SCORE_DESC =
            Comparator.comparingInt(RoomPlayer::getScore).reversed();

    /** finalRank ASC, unranked (null) last — Battle Royale / Sudden Death. */
    public static final Comparator<RoomPlayer> ORDER_BY_FINAL_RANK_ASC =
            Comparator.comparingInt(p -> (p.getFinalRank() != null ? p.getFinalRank() : Integer.MAX_VALUE));

    /**
     * Get leaderboard for room (sorted by score)
     */
    public List<LeaderboardEntryDTO> getRoomLeaderboard(String roomId) {
        return buildLeaderboard(roomId, ORDER_BY_SCORE_DESC);
    }

    /**
     * Get leaderboard sorted by finalRank (for Battle Royale game end)
     */
    public List<LeaderboardEntryDTO> getRoomLeaderboardWithRanks(String roomId) {
        return buildLeaderboard(roomId, ORDER_BY_FINAL_RANK_ASC);
    }

    /** Single leaderboard builder — ordering supplied by the mode strategy. */
    public List<LeaderboardEntryDTO> buildLeaderboard(String roomId, Comparator<RoomPlayer> order) {
        return roomPlayerRepository.findByRoomId(roomId).stream()
            .sorted(order)
            .map(player -> new LeaderboardEntryDTO(
                player.getUser().getId(),
                player.getUsername(),
                player.getAvatarUrl(),
                player.getScore(),
                player.getCorrectAnswers(),
                player.getTotalAnswered(),
                player.getAccuracy(),
                player.getFinalRank(),
                player.getPlayerStatus()
            ))
            .collect(Collectors.toList());
    }

    private static final List<String> TEST_ROOM_PREFIXES = List.of("WS Test", "E2E Test", "[TEST]", "[test]");

    private boolean isTestRoom(Room room) {
        return TEST_ROOM_PREFIXES.stream().anyMatch(prefix -> room.getRoomName().startsWith(prefix));
    }

    /**
     * Get public lobby rooms (all modes), filtered of test rooms.
     *
     * @param viewerUserId — the requesting user; lets each DTO carry a
     *                       viewer-aware {@code joinable} bit (audit G7).
     *                       Pass null for anonymous callers (everything is
     *                       not joinable for them anyway).
     */
    public List<PublicRoomDTO> getPublicRooms(String viewerUserId) {
        return roomRepository.findPublicLobbyRooms().stream()
            .filter(r -> !isTestRoom(r))
            .map(r -> {
                List<RoomPlayer> players = roomPlayerRepository.findByRoomId(r.getId());
                boolean joinable = computeJoinable(r, viewerUserId, players);
                return new PublicRoomDTO(r, players, joinable);
            })
            .collect(Collectors.toList());
    }

    /** Backwards-compatible overload — no viewer context, joinable=false
     *  for IN_PROGRESS rooms (no rejoin info), capacity-only for LOBBY. */
    public List<PublicRoomDTO> getPublicRooms() {
        return getPublicRooms(null);
    }

    private boolean computeJoinable(Room room, String viewerUserId, List<RoomPlayer> players) {
        if (room.getStatus() == Room.RoomStatus.LOBBY) {
            return room.getCurrentPlayers() < room.getMaxPlayers();
        }
        if (room.getStatus() == Room.RoomStatus.IN_PROGRESS) {
            // SPEC §5.4 / Phase 6 case #3 — only previously-registered
            // players may rejoin a live game; brand-new joiners are
            // rejected by joinRoom anyway, so don't dangle a useless
            // "Tiếp tục" button in front of them.
            if (viewerUserId == null) return false;
            // The Quản trò host has no RoomPlayer row — still their room.
            if (room.getHost() != null && viewerUserId.equals(room.getHost().getId())) {
                return true;
            }
            return players.stream().anyMatch(p ->
                    p.getUser() != null && viewerUserId.equals(p.getUser().getId()));
        }
        return false;
    }

    // SecureRandom shared across calls — Random was predictable enough that
    // a determined attacker could brute-force lobby codes. SecureRandom is
    // thread-safe per Sun JDK contract, so a static instance is fine.
    private static final SecureRandom CODE_RANDOM = new SecureRandom();
    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private String generateRoomCode() {
        StringBuilder code = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            code.append(CODE_CHARS.charAt(CODE_RANDOM.nextInt(CODE_CHARS.length())));
        }
        return code.toString();
    }

    // ===== DTOs =====

    public static class RoomDetailsDTO {
        public final String id;
        public final String roomCode;
        public final String roomName;
        public final Room.RoomStatus status;
        public final Room.RoomMode mode;
        public final Boolean isPublic;
        public final Integer maxPlayers;
        public final Integer currentPlayers;
        public final Integer questionCount;
        public final Integer timePerQuestion;
        public final String hostId;
        public final String hostName;
        public final String questionSource;
        public final String questionSetId;
        public final String bookScope;
        public final String difficulty;
        public final String createdAt;
        /** Owning group when room was spawned from a group quiz set; null otherwise. */
        public final String groupId;
        /** Group quiz set this room is playing (for FE banner "Đang chơi: [Tên]"). */
        public final String groupQuizSetId;
        public final String groupQuizSetName;
        public final Integer quizSetTotalQuestions;
        /** Sprint 4: true = host plays (legacy); false = Quản trò mode (host orchestrates only). */
        public final boolean hostPlaysGame;
        public final List<PlayerInfoDTO> players;

        public RoomDetailsDTO(Room room, List<RoomPlayer> roomPlayers) {
            this(room, roomPlayers, null, null, null);
        }

        public RoomDetailsDTO(Room room, List<RoomPlayer> roomPlayers, String groupId) {
            this(room, roomPlayers, groupId, null, null);
        }

        public RoomDetailsDTO(Room room, List<RoomPlayer> roomPlayers, String groupId,
                              String groupQuizSetName, Integer quizSetTotalQuestions) {
            this.id = room.getId();
            this.roomCode = room.getRoomCode();
            this.roomName = room.getRoomName();
            this.status = room.getStatus();
            this.mode = room.getMode();
            this.isPublic = room.getIsPublic();
            this.maxPlayers = room.getMaxPlayers();
            this.currentPlayers = roomPlayers.size();
            this.questionCount = room.getQuestionCount();
            this.timePerQuestion = room.getTimePerQuestion();
            this.hostId = room.getHost().getId();
            this.hostName = room.getHost().getName();
            this.questionSource = room.getQuestionSource() != null
                    ? room.getQuestionSource().name() : "DATABASE";
            this.questionSetId = room.getQuestionSetId();
            this.bookScope = room.getBookScope();
            this.difficulty = room.getDifficulty() != null ? room.getDifficulty().name() : "MIXED";
            this.createdAt = room.getCreatedAt() != null ? room.getCreatedAt().toString() : null;
            this.groupId = groupId;
            this.groupQuizSetId = room.getGroupQuizSetId();
            this.groupQuizSetName = groupQuizSetName;
            this.quizSetTotalQuestions = quizSetTotalQuestions;
            this.hostPlaysGame = room.isHostPlaysGame();

            this.players = roomPlayers.stream()
                .map(player -> new PlayerInfoDTO(
                    player.getId(),
                    player.getUser().getId(),
                    player.getUsername(),
                    player.getAvatarUrl(),
                    player.getIsReady(),
                    player.getScore(),
                    player.getTeam(),
                    player.getPlayerStatus()
                ))
                .collect(Collectors.toList());
        }
    }

    public static class PlayerInfoDTO {
        public final String id;
        public final String userId;
        public final String username;
        public final String avatarUrl;
        public final Boolean isReady;
        public final Integer score;
        public final RoomPlayer.Team team;
        public final RoomPlayer.PlayerStatus playerStatus;

        public PlayerInfoDTO(String id, String userId, String username, String avatarUrl,
                             Boolean isReady, Integer score,
                             RoomPlayer.Team team, RoomPlayer.PlayerStatus playerStatus) {
            this.id = id;
            this.userId = userId;
            this.username = username;
            this.avatarUrl = avatarUrl;
            this.isReady = isReady;
            this.score = score;
            this.team = team;
            this.playerStatus = playerStatus;
        }
    }

    public static class LeaderboardEntryDTO {
        public final String playerId;
        public final String username;
        public final String avatarUrl;
        public final Integer score;
        public final Integer correctAnswers;
        public final Integer totalAnswered;
        public final Double accuracy;
        public final Integer finalRank;
        public final String playerStatus;

        public LeaderboardEntryDTO(String playerId, String username, String avatarUrl,
                                   Integer score, Integer correctAnswers, Integer totalAnswered, Double accuracy,
                                   Integer finalRank, RoomPlayer.PlayerStatus playerStatus) {
            this.playerId = playerId;
            this.username = username;
            this.avatarUrl = avatarUrl;
            this.score = score;
            this.correctAnswers = correctAnswers;
            this.totalAnswered = totalAnswered;
            this.accuracy = accuracy;
            this.finalRank = finalRank;
            this.playerStatus = playerStatus != null ? playerStatus.name() : null;
        }
    }

    public static class PublicRoomDTO {
        public final String id;
        public final String roomCode;
        public final String roomName;
        public final Room.RoomMode mode;
        public final Room.RoomStatus status;
        public final Boolean isPublic;
        public final Integer currentPlayers;
        public final Integer maxPlayers;
        public final Integer questionCount;
        public final Integer timePerQuestion;
        public final Room.RoomDifficulty difficulty;
        public final String bookScope;
        public final String hostName;
        public final String createdAt;
        public final List<String> playerInitials;
        /** SPEC §5.4 / audit G7 — viewer-aware: true if the requester can
         *  click "Tham gia" (LOBBY with capacity) or "Tiếp tục" (already a
         *  member of an IN_PROGRESS room). FE gates the button on this. */
        public final boolean joinable;

        public PublicRoomDTO(Room room, List<RoomPlayer> players, boolean joinable) {
            this.id = room.getId();
            this.roomCode = room.getRoomCode();
            this.roomName = room.getRoomName();
            this.mode = room.getMode();
            this.status = room.getStatus();
            this.isPublic = room.getIsPublic();
            this.currentPlayers = room.getCurrentPlayers();
            this.maxPlayers = room.getMaxPlayers();
            this.questionCount = room.getQuestionCount();
            this.timePerQuestion = room.getTimePerQuestion();
            this.difficulty = room.getDifficulty();
            this.bookScope = room.getBookScope();
            this.hostName = room.getHost() != null ? room.getHost().getName() : null;
            this.createdAt = room.getCreatedAt() != null ? room.getCreatedAt().toString() : null;
            this.playerInitials = players.stream()
                .map(p -> p.getUsername() != null && !p.getUsername().isEmpty()
                    ? p.getUsername().substring(0, 1).toUpperCase()
                    : "?")
                .collect(Collectors.toList());
            this.joinable = joinable;
        }
    }
}
