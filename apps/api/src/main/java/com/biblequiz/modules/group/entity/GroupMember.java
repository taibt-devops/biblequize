package com.biblequiz.modules.group.entity;

import com.biblequiz.modules.user.entity.User;
import jakarta.persistence.*;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "group_members")
public class GroupMember {

    public enum GroupRole {
        LEADER, MOD, MEMBER
    }

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private ChurchGroup group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GroupRole role = GroupRole.MEMBER;

    @CreationTimestamp
    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    /**
     * Timestamp of the member's most recent activity (e.g. quiz answer
     * submission). Initialized to {@code joinedAt} by V32 migration so the
     * inactive-filter never reports a freshly-joined member as inactive.
     * Phase 0.5 (real update trigger from AnswerService) is deferred —
     * this column reads as joinedAt until that wires through.
     */
    @Column(name = "last_active_at")
    private LocalDateTime lastActiveAt;

    public GroupMember() {
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public ChurchGroup getGroup() { return group; }
    public void setGroup(ChurchGroup group) { this.group = group; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public GroupRole getRole() { return role; }
    public void setRole(GroupRole role) { this.role = role; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }

    public LocalDateTime getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(LocalDateTime lastActiveAt) { this.lastActiveAt = lastActiveAt; }
}
