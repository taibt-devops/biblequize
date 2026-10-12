package com.biblequiz.modules.room.entity;

import com.biblequiz.modules.user.entity.User;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;

@Entity
@Table(name = "room_room_players")
public class RoomPlayer {
    
    @Id
    @Column(length = 36)
    private String id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(name = "username", nullable = false, length = 50)
    private String username;
    
    @Column(name = "avatar_url")
    private String avatarUrl;
    
    @Column(name = "is_ready", nullable = false)
    private Boolean isReady = false;

    @Column(name = "team", length = 1)
    @Enumerated(EnumType.STRING)
    private Team team;

    @Column(name = "player_status", nullable = false)
    @Enumerated(EnumType.STRING)
    private PlayerStatus playerStatus = PlayerStatus.ACTIVE;

    @Column(name = "final_rank")
    private Integer finalRank;

    @Column(name = "winning_streak", nullable = false)
    private Integer winningStreak = 0;
    
    @Column(name = "score", nullable = false)
    private Integer score = 0;
    
    @Column(name = "total_answered", nullable = false)
    private Integer totalAnswered = 0;
    
    @Column(name = "correct_answers", nullable = false)
    private Integer correctAnswers = 0;
    
    @Column(name = "average_reaction_time", nullable = false)
    private Double averageReactionTime = 0.0;

    // ── Phòng chơi v2 đợt 2 (V77) ──
    /** Đua tốc độ: số câu đúng liên tiếp tính tới câu vừa xong. */
    @Column(name = "answer_streak", nullable = false)
    private Integer answerStreak = 0;

    /** Sinh tồn: số mạng còn lại. */
    @Column(name = "lives", nullable = false)
    private Integer lives = 0;

    /** Sinh tồn: số câu đúng liên tiếp khi đang là bóng. */
    @Column(name = "ghost_streak", nullable = false)
    private Integer ghostStreak = 0;

    /** Sinh tồn: đã hồi sinh một lần. */
    @Column(name = "revived", nullable = false)
    private Boolean revived = false;

    /** Sinh tồn: câu (0-based) lúc bị loại. */
    @Column(name = "eliminated_round")
    private Integer eliminatedRound;

    /** Đấu vương: số trận thắng. */
    @Column(name = "matches_won", nullable = false)
    private Integer matchesWon = 0;

    /** Đấu vương: chuỗi thắng dài nhất. */
    @Column(name = "best_streak", nullable = false)
    private Integer bestStreak = 0;

    /** Đấu vương: số trận đã đấu. */
    @Column(name = "matches_played", nullable = false)
    private Integer matchesPlayed = 0;

    /** Đấu vương: số lần đoán đúng người thắng khi đang xem. */
    @Column(name = "prediction_points", nullable = false)
    private Integer predictionPoints = 0;

    /** PCV-20 (V78): cấp người máy (EASY | MEDIUM | HARD); null với người thật. */
    @Column(name = "bot_level", length = 10)
    private String botLevel;
    
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "room_player_answers", joinColumns = @JoinColumn(name = "room_player_id"))
    @MapKeyColumn(name = "question_index")
    @Column(name = "answer_data")
    private Map<Integer, String> answers = new HashMap<>();
    
    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;
    
    public enum Team { A, B }

    public enum PlayerStatus {
        ACTIVE,
        ELIMINATED,
        SPECTATOR,
        /** Player left after the game started; row is kept so they can rejoin
         *  via {@code joinRoom} while the room is still IN_PROGRESS. */
        LEFT
    }

    // Constructors
    public RoomPlayer() {}
    
    public RoomPlayer(String id, Room room, User user, String username) {
        this.id = id;
        this.room = room;
        this.user = user;
        this.username = username;
        this.avatarUrl = user.getAvatarUrl();
    }
    
    // Add answer and update stats
    public void addAnswer(int questionIndex, String answerData) {
        answers.put(questionIndex, answerData);
        totalAnswered++;
        
        // Parse answer data to check correctness and update stats
        // This is a simplified version - in real implementation, you'd parse JSON
        if (answerData.contains("\"isCorrect\":true")) {
            correctAnswers++;
            score += 10; // Base score per correct answer
        }
    }
    
    // Calculate accuracy percentage
    public double getAccuracy() {
        return totalAnswered > 0 ? (double) correctAnswers / totalAnswered * 100 : 0.0;
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }
    
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    
    public Boolean getIsReady() { return isReady; }
    public void setIsReady(Boolean isReady) { this.isReady = isReady; }
    
    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }
    
    public Integer getTotalAnswered() { return totalAnswered; }
    public void setTotalAnswered(Integer totalAnswered) { this.totalAnswered = totalAnswered; }
    
    public Integer getCorrectAnswers() { return correctAnswers; }
    public void setCorrectAnswers(Integer correctAnswers) { this.correctAnswers = correctAnswers; }
    
    public Double getAverageReactionTime() { return averageReactionTime; }
    public void setAverageReactionTime(Double averageReactionTime) { this.averageReactionTime = averageReactionTime; }
    
    public Map<Integer, String> getAnswers() { return answers; }
    public void setAnswers(Map<Integer, String> answers) { this.answers = answers; }
    
    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }

    public Team getTeam() { return team; }
    public void setTeam(Team team) { this.team = team; }

    public PlayerStatus getPlayerStatus() { return playerStatus; }
    public void setPlayerStatus(PlayerStatus playerStatus) { this.playerStatus = playerStatus; }

    public Integer getFinalRank() { return finalRank; }
    public void setFinalRank(Integer finalRank) { this.finalRank = finalRank; }

    public Integer getWinningStreak() { return winningStreak; }
    public Integer getAnswerStreak() { return answerStreak != null ? answerStreak : 0; }
    public void setAnswerStreak(Integer answerStreak) { this.answerStreak = answerStreak; }
    public Integer getLives() { return lives != null ? lives : 0; }
    public void setLives(Integer lives) { this.lives = lives; }
    public Integer getGhostStreak() { return ghostStreak != null ? ghostStreak : 0; }
    public void setGhostStreak(Integer ghostStreak) { this.ghostStreak = ghostStreak; }
    public Boolean getRevived() { return Boolean.TRUE.equals(revived); }
    public void setRevived(Boolean revived) { this.revived = revived; }
    public Integer getEliminatedRound() { return eliminatedRound; }
    public void setEliminatedRound(Integer eliminatedRound) { this.eliminatedRound = eliminatedRound; }
    public Integer getMatchesWon() { return matchesWon != null ? matchesWon : 0; }
    public void setMatchesWon(Integer matchesWon) { this.matchesWon = matchesWon; }
    public Integer getBestStreak() { return bestStreak != null ? bestStreak : 0; }
    public void setBestStreak(Integer bestStreak) { this.bestStreak = bestStreak; }
    public Integer getMatchesPlayed() { return matchesPlayed != null ? matchesPlayed : 0; }
    public void setMatchesPlayed(Integer matchesPlayed) { this.matchesPlayed = matchesPlayed; }
    public Integer getPredictionPoints() { return predictionPoints != null ? predictionPoints : 0; }
    public String getBotLevel() { return botLevel; }
    public void setBotLevel(String botLevel) { this.botLevel = botLevel; }
    /** PCV-20: dòng này là người máy. */
    public boolean isBot() { return user != null && user.isBot(); }
    public void setPredictionPoints(Integer predictionPoints) { this.predictionPoints = predictionPoints; }
    public void setWinningStreak(Integer winningStreak) { this.winningStreak = winningStreak; }
}
