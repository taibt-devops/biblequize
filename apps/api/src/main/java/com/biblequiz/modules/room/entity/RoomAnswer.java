package com.biblequiz.modules.room.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "room_answers")
public class RoomAnswer {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id", nullable = false)
    private RoomRound round;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "answer_index", nullable = false)
    private Integer answerIndex;

    @Column(name = "is_correct", nullable = false)
    private Boolean isCorrect;

    /** Sinh tồn (V77): câu trả lời của người đã bị loại — không điểm, không tính kết thúc vòng sớm. */
    @Column(name = "ghost", nullable = false)
    private Boolean ghost = false;

    @Column(name = "response_ms", nullable = false)
    private Integer responseMs;

    @Column(name = "points_earned", nullable = false)
    private Integer pointsEarned = 0;

    @CreationTimestamp
    @Column(name = "answered_at", nullable = false, updatable = false)
    private LocalDateTime answeredAt;

    public RoomAnswer() {}

    public RoomAnswer(String id, RoomRound round, String userId,
                      Integer answerIndex, Boolean isCorrect, Integer responseMs, Integer pointsEarned) {
        this.id = id;
        this.round = round;
        this.userId = userId;
        this.answerIndex = answerIndex;
        this.isCorrect = isCorrect;
        this.responseMs = responseMs;
        this.pointsEarned = pointsEarned;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public RoomRound getRound() { return round; }
    public void setRound(RoomRound round) { this.round = round; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public Integer getAnswerIndex() { return answerIndex; }
    public void setAnswerIndex(Integer answerIndex) { this.answerIndex = answerIndex; }

    public Boolean getIsCorrect() { return isCorrect; }
    public boolean isGhost() { return Boolean.TRUE.equals(ghost); }
    public void setGhost(Boolean ghost) { this.ghost = ghost; }
    public void setIsCorrect(Boolean isCorrect) { this.isCorrect = isCorrect; }

    public Integer getResponseMs() { return responseMs; }
    public void setResponseMs(Integer responseMs) { this.responseMs = responseMs; }

    public Integer getPointsEarned() { return pointsEarned; }
    public void setPointsEarned(Integer pointsEarned) { this.pointsEarned = pointsEarned; }

    public LocalDateTime getAnsweredAt() { return answeredAt; }
    public void setAnsweredAt(LocalDateTime answeredAt) { this.answeredAt = answeredAt; }
}
