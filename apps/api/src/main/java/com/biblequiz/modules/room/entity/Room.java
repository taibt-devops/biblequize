package com.biblequiz.modules.room.entity;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.shared.converter.JsonListConverter;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "rooms")
public class Room {
    
    @Id
    @Column(length = 36)
    private String id;
    
    @Column(name = "room_code", unique = true, nullable = false, length = 8)
    private String roomCode;
    
    @Column(name = "room_name", nullable = false, length = 100)
    private String roomName;
    
    @Column(name = "max_players", nullable = false)
    private Integer maxPlayers = 4;
    
    @Column(name = "current_players", nullable = false)
    private Integer currentPlayers = 0;
    
    @Column(name = "question_count", nullable = false)
    private Integer questionCount = 10;
    
    @Column(name = "time_per_question", nullable = false)
    private Integer timePerQuestion = 30; // seconds
    
    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private RoomStatus status = RoomStatus.LOBBY;

    @Column(name = "mode", nullable = false)
    @Enumerated(EnumType.STRING)
    private RoomMode mode = RoomMode.SPEED_RACE;

    @Column(name = "difficulty")
    @Enumerated(EnumType.STRING)
    private RoomDifficulty difficulty = RoomDifficulty.MIXED;

    @Column(name = "book_scope", length = 100)
    private String bookScope = "ALL";

    /** Question language (vi/en) — DATABASE-source selection filters on this
     *  so a room never mixes languages (V65). */
    @Column(name = "language", nullable = false, length = 5)
    private String language = "vi";

    @Column(name = "question_source", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private QuestionSource questionSource = QuestionSource.DATABASE;

    @Column(name = "question_set_id", length = 36)
    private String questionSetId;

    @Column(name = "group_quiz_set_id", length = 36)
    private String groupQuizSetId;

    @Convert(converter = JsonListConverter.class)
    @Column(name = "custom_question_ids", columnDefinition = "JSON")
    private List<String> customQuestionIds;

    @Column(name = "is_public", nullable = false)
    private Boolean isPublic = false;

    // Sprint 4: TRUE = legacy mode (host plays); FALSE = Quan tro mode (host only organizes)
    // Default true keeps existing rooms unchanged; RoomService.createRoom sets false for new rooms.
    @Column(name = "host_plays_game", nullable = false)
    private boolean hostPlaysGame = true;

    // "Chơi cùng nhau" co-play flag (V55). TRUE = phòng do leader tạo qua
    // POST /api/groups/{id}/quiz-sets/{setId}/play, surface trong group
    // "Đang diễn ra" để mọi member thấy. FALSE = phòng SPEED_RACE thông
    // thường hoặc historical /play rooms (legacy "Tự ôn solo").
    @Column(name = "is_co_play", nullable = false)
    private boolean isCoPlay = false;

    // QP-1 (V57): Đấu Nhanh (Quick Match) flag. TRUE = server soft-coordinates,
    // host plays like a regular player, Quản trò controls disabled (pause /
    // skip / broadcast / end-early reject 422 QUICK_MATCH_NO_HOST_CONTROLS),
    // any player can call /start when ≥2 ready. FALSE = traditional room.
    @Column(name = "quick_match", nullable = false)
    private boolean quickMatch = false;

    /** PCV-22 (V78): Đội đấu đội — chế độ Hội ý (đáp án đội = đa số phiếu). */
    @Column(name = "team_consensus", nullable = false)
    private boolean teamConsensus = false;

    /** PCV-24 (V78): Ôn phần đọc — JSON [{"book","fromChapter","toChapter"}]; null = theo bookScope. */
    @Column(name = "passage_scope", columnDefinition = "TEXT")
    private String passageScope;

    // QP-1 (V57): ephemeral storage for AI-generated questions per Bùi pivot
    // 2026-05-15 — AI questions are one-shot, NOT persisted to `questions`
    // table. Game loads from this JSON when starting; R5 room cleanup purges
    // it when room ENDED. NULL for DB-source rooms.
    @Column(name = "ai_questions_payload", columnDefinition = "JSON")
    private String aiQuestionsPayload;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    public enum RoomStatus {
        LOBBY,           // Đang chờ players join
        IN_PROGRESS,     // Quiz đang chạy
        ENDED,           // Quiz đã kết thúc
        CANCELLED        // Room bị hủy
    }

    public enum RoomMode {
        SPEED_RACE,
        BATTLE_ROYALE,
        TEAM_VS_TEAM,
        SUDDEN_DEATH,
        GROUP_LIVE_SEQUENTIAL
    }

    public enum RoomDifficulty {
        EASY, MEDIUM, HARD, MIXED
    }

    public enum QuestionSource {
        DATABASE,        // Dùng ngân hàng câu hỏi hệ thống
        CUSTOM,          // Host tự tạo (Quản trò flow — saved Question rows hoặc QuestionSet)
        AI_GENERATED     // QP-2 Đấu Nhanh: AI sinh one-shot, lưu Room.aiQuestionsPayload, KHÔNG save table
    }
    
    // Constructors
    public Room() {}
    
    public Room(String id, String roomCode, String roomName, User host) {
        this.id = id;
        this.roomCode = roomCode;
        this.roomName = roomName;
        this.host = host;
    }
    
    // Check if room is full. currentPlayers is kept in sync by RoomService
    // after every RoomPlayer insert/delete (see RoomService.syncPlayerCount).
    public boolean isFull() {
        return currentPlayers >= maxPlayers;
    }

    // Check if room can start
    public boolean canStart() {
        return status == RoomStatus.LOBBY && currentPlayers > 1;
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }
    
    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }
    
    public Integer getMaxPlayers() { return maxPlayers; }
    public void setMaxPlayers(Integer maxPlayers) { this.maxPlayers = maxPlayers; }
    
    public Integer getCurrentPlayers() { return currentPlayers; }
    public void setCurrentPlayers(Integer currentPlayers) { this.currentPlayers = currentPlayers; }
    
    public Integer getQuestionCount() { return questionCount; }
    public void setQuestionCount(Integer questionCount) { this.questionCount = questionCount; }
    
    public Integer getTimePerQuestion() { return timePerQuestion; }
    public void setTimePerQuestion(Integer timePerQuestion) { this.timePerQuestion = timePerQuestion; }
    
    public RoomStatus getStatus() { return status; }
    public void setStatus(RoomStatus status) { this.status = status; }
    
    public User getHost() { return host; }
    public void setHost(User host) { this.host = host; }
    
public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public RoomMode getMode() { return mode; }
    public void setMode(RoomMode mode) { this.mode = mode; }

    public RoomDifficulty getDifficulty() { return difficulty; }
    public void setDifficulty(RoomDifficulty difficulty) { this.difficulty = difficulty; }

    public String getBookScope() { return bookScope; }
    public void setBookScope(String bookScope) { this.bookScope = bookScope; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public QuestionSource getQuestionSource() { return questionSource; }
    public void setQuestionSource(QuestionSource questionSource) { this.questionSource = questionSource; }

    public String getQuestionSetId() { return questionSetId; }
    public void setQuestionSetId(String questionSetId) { this.questionSetId = questionSetId; }

    public String getGroupQuizSetId() { return groupQuizSetId; }
    public void setGroupQuizSetId(String groupQuizSetId) { this.groupQuizSetId = groupQuizSetId; }

    public List<String> getCustomQuestionIds() { return customQuestionIds; }
    public void setCustomQuestionIds(List<String> customQuestionIds) { this.customQuestionIds = customQuestionIds; }

    public Boolean getIsPublic() { return isPublic; }
    public void setIsPublic(Boolean isPublic) { this.isPublic = isPublic; }

    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }

    public LocalDateTime getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }

    public boolean isHostPlaysGame() { return hostPlaysGame; }
    public void setHostPlaysGame(boolean hostPlaysGame) { this.hostPlaysGame = hostPlaysGame; }

    public boolean isCoPlay() { return isCoPlay; }
    public void setCoPlay(boolean coPlay) { this.isCoPlay = coPlay; }

    public boolean isQuickMatch() { return quickMatch; }
    public void setQuickMatch(boolean quickMatch) { this.quickMatch = quickMatch; }
    public boolean isTeamConsensus() { return teamConsensus; }
    public void setTeamConsensus(boolean teamConsensus) { this.teamConsensus = teamConsensus; }
    public String getPassageScope() { return passageScope; }
    public void setPassageScope(String passageScope) { this.passageScope = passageScope; }

    public String getAiQuestionsPayload() { return aiQuestionsPayload; }
    public void setAiQuestionsPayload(String aiQuestionsPayload) { this.aiQuestionsPayload = aiQuestionsPayload; }
}
