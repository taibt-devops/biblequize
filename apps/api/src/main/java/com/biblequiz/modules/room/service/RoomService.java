package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    /**
     * Create a new room
     */
    public Room createRoom(String roomName, User host, Integer maxPlayers, Integer questionCount,
                           Integer timePerQuestion, Room.RoomMode mode, Boolean isPublic,
                           Room.RoomDifficulty difficulty, String bookScope,
                           Room.QuestionSource questionSource) {
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
        room.setMaxPlayers(maxPlayers != null ? maxPlayers : 4);
        room.setQuestionCount(questionCount != null ? questionCount : 10);
        room.setTimePerQuestion(timePerQuestion != null ? timePerQuestion : 30);
        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMode(mode != null ? mode : Room.RoomMode.SPEED_RACE);
        room.setIsPublic(isPublic != null ? isPublic : false);
        room.setDifficulty(difficulty != null ? difficulty : Room.RoomDifficulty.MIXED);
        room.setBookScope(bookScope != null && !bookScope.isBlank() ? bookScope : "ALL");
        room.setQuestionSource(questionSource != null ? questionSource : Room.QuestionSource.DATABASE);

        roomRepository.save(room);

        // Host tự động vào phòng
        addPlayerToRoom(roomId, host);

        return room;
    }

    /**
     * Join a room by room code
     */
    public Room joinRoom(String roomCode, User user) throws Exception {
        Room room = roomRepository.findByRoomCode(roomCode)
            .orElseThrow(() -> new Exception("Phòng không tồn tại"));

        if (room.getStatus() != Room.RoomStatus.LOBBY) {
            throw new Exception("Phòng đã bắt đầu hoặc kết thúc");
        }

        if (room.isFull()) {
            throw new Exception("Phòng đã đầy người");
        }

        if (roomPlayerRepository.findByRoomIdAndUserId(room.getId(), user.getId()).isPresent()) {
            throw new Exception("Bạn đã có mặt trong phòng này");
        }

        addPlayerToRoom(room.getId(), user);

        return room;
    }

    /**
     * Add player to room (auto-assign team for Team vs Team)
     */
    private void addPlayerToRoom(String roomId, User user) {
        Room room = roomRepository.findById(roomId).orElseThrow();

        room.addPlayer(user.getId());
        roomRepository.save(room);

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
    }

    /**
     * Remove player from room
     */
    public void leaveRoom(String roomId, String userId) {
        Room room = roomRepository.findById(roomId).orElseThrow();

        room.removePlayer(userId);
        roomRepository.save(room);

        roomPlayerRepository.findByRoomIdAndUserId(roomId, userId)
            .ifPresent(roomPlayerRepository::delete);

        if (room.getCurrentPlayers() == 0) {
            roomRepository.delete(room);
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

        room.removePlayer(targetUserId);
        roomRepository.save(room);

        roomPlayerRepository.findByRoomIdAndUserId(roomId, targetUserId)
                .ifPresent(roomPlayerRepository::delete);
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
    }

    /**
     * Start quiz for room
     */
    public void startRoom(String roomId, String userId) throws Exception {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new Exception("Phòng không tồn tại"));

        if (!room.getHost().getId().equals(userId)) {
            throw new Exception("Chỉ chủ phòng mới có thể bắt đầu");
        }

        if (!room.canStart()) {
            throw new Exception("Cần ít nhất 2 người chơi để bắt đầu");
        }

        List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);
        boolean allReady = players.stream().allMatch(RoomPlayer::getIsReady);

        if (!allReady) {
            throw new Exception("Tất cả người chơi phải sẵn sàng");
        }

        room.setStatus(Room.RoomStatus.IN_PROGRESS);
        room.setStartedAt(LocalDateTime.now());
        roomRepository.save(room);
    }

    /**
     * End quiz for room
     */
    public void endRoom(String roomId) {
        Room room = roomRepository.findById(roomId).orElseThrow();
        room.setStatus(Room.RoomStatus.ENDED);
        room.setEndedAt(LocalDateTime.now());
        roomRepository.save(room);
    }

    /**
     * Get room details with players
     */
    public RoomDetailsDTO getRoomDetails(String roomId) throws Exception {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new Exception("Phòng không tồn tại"));
        List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);

        return new RoomDetailsDTO(room, players);
    }

    /**
     * Get leaderboard for room (sorted by score)
     */
    public List<LeaderboardEntryDTO> getRoomLeaderboard(String roomId) {
        List<RoomPlayer> players = roomPlayerRepository.findByRoomIdOrderByScoreDesc(roomId);

        return players.stream()
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

    /**
     * Get leaderboard sorted by finalRank (for Battle Royale game end)
     */
    public List<LeaderboardEntryDTO> getRoomLeaderboardWithRanks(String roomId) {
        List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);

        return players.stream()
            .sorted(Comparator.comparingInt(p -> (p.getFinalRank() != null ? p.getFinalRank() : Integer.MAX_VALUE)))
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
     * Get public lobby rooms (all modes), filtered of test rooms
     */
    public List<PublicRoomDTO> getPublicRooms() {
        return roomRepository.findPublicLobbyRooms().stream()
            .filter(r -> !isTestRoom(r))
            .map(r -> {
                List<RoomPlayer> players = roomPlayerRepository.findByRoomId(r.getId());
                return new PublicRoomDTO(r, players);
            })
            .collect(Collectors.toList());
    }

    private String generateRoomCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder code = new StringBuilder();
        Random random = new Random();

        for (int i = 0; i < 6; i++) {
            code.append(chars.charAt(random.nextInt(chars.length())));
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
        public final List<PlayerInfoDTO> players;

        public RoomDetailsDTO(Room room, List<RoomPlayer> roomPlayers) {
            this.id = room.getId();
            this.roomCode = room.getRoomCode();
            this.roomName = room.getRoomName();
            this.status = room.getStatus();
            this.mode = room.getMode();
            this.isPublic = room.getIsPublic();
            this.maxPlayers = room.getMaxPlayers();
            this.currentPlayers = room.getCurrentPlayers();
            this.questionCount = room.getQuestionCount();
            this.timePerQuestion = room.getTimePerQuestion();
            this.hostId = room.getHost().getId();
            this.hostName = room.getHost().getName();
            this.questionSource = room.getQuestionSource() != null
                    ? room.getQuestionSource().name() : "DATABASE";

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

        public PublicRoomDTO(Room room, List<RoomPlayer> players) {
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
        }
    }
}
