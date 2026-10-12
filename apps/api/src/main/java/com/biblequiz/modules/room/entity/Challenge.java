package com.biblequiz.modules.room.entity;

import com.biblequiz.modules.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "challenges")
public class Challenge {

    /** PCV-23: CANCELLED = người thách hủy khi đang chờ (cột status là VARCHAR nên không cần migration). */
    public enum Status { PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED }

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challenger_id", nullable = false)
    private User challenger;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challenged_id", nullable = false)
    private User challenged;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "room_id", length = 36)
    private String roomId;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Challenge() {}

    public Challenge(String id, User challenger, User challenged, LocalDateTime expiresAt) {
        this.id = id;
        this.challenger = challenger;
        this.challenged = challenged;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    // Getters & Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public User getChallenger() { return challenger; }
    public void setChallenger(User challenger) { this.challenger = challenger; }
    public User getChallenged() { return challenged; }
    public void setChallenged(User challenged) { this.challenged = challenged; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    /** PCV-23: số giây còn lại theo đồng hồ máy chủ — expiresAt không kèm múi giờ nên máy khách đếm theo số này. */
    public long secondsLeft() {
        return Math.max(0L, java.time.Duration.between(LocalDateTime.now(), expiresAt).getSeconds());
    }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
