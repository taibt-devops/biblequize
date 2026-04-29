package com.biblequiz.modules.user.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.biblequiz.modules.auth.entity.AuthIdentity;
import com.biblequiz.modules.quiz.entity.QuizSession;
import com.biblequiz.modules.quiz.entity.Answer;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.feedback.entity.Feedback;
import com.biblequiz.modules.quiz.entity.Bookmark;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 50)
    private String provider = "local";

    // FIX #8: Use enum for type safety instead of raw String
    public enum Role {
        USER, ADMIN
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.USER;

    // SPEC-v2: Streak system
    @Column(name = "current_streak", nullable = false)
    private Integer currentStreak = 0;

    @Column(name = "longest_streak", nullable = false)
    private Integer longestStreak = 0;

    @Column(name = "last_played_at")
    private LocalDateTime lastPlayedAt;

    @Column(name = "streak_freeze_used_this_week", nullable = false)
    private Boolean streakFreezeUsedThisWeek = false;

    // Milestone Burst: XP surge multiplier active until this time
    @Column(name = "xp_surge_until")
    private LocalDateTime xpSurgeUntil;

    // Prestige System
    @Column(name = "prestige_level", nullable = false)
    private Integer prestigeLevel = 0;

    @Column(name = "prestige_at", columnDefinition = "JSON")
    private String prestigeAt; // JSON array of timestamps

    @Column(name = "days_at_tier6", nullable = false)
    private Integer daysAtTier6 = 0;

    @Column(name = "tier6_reached_at")
    private LocalDateTime tier6ReachedAt;

    // Early Ranked unlock — Tier-1 users with ≥80% accuracy over 10+
    // Practice answers bypass the XP gate. See DECISIONS.md 2026-04-19.
    @Column(name = "early_ranked_unlock", nullable = false)
    private Boolean earlyRankedUnlock = false;

    @Column(name = "practice_correct_count", nullable = false)
    private Integer practiceCorrectCount = 0;

    @Column(name = "practice_total_count", nullable = false)
    private Integer practiceTotalCount = 0;

    // Timestamp of the first time earlyRankedUnlock flipped to true.
    // Enables the FE to fire a celebration modal exactly once per user.
    @Column(name = "early_ranked_unlocked_at")
    private LocalDateTime earlyRankedUnlockedAt;

    // Bible Basics catechism quiz: passing 8/10 permanently unlocks Ranked.
    // Replaces the XP / practice-accuracy gate (DECISIONS.md 2026-04-29).
    // Legacy earlyRankedUnlock fields above remain co-existing until V32.
    @Column(name = "basic_quiz_passed", nullable = false)
    private Boolean basicQuizPassed = false;

    @Column(name = "basic_quiz_passed_at")
    private LocalDateTime basicQuizPassedAt;

    @Column(name = "basic_quiz_attempts", nullable = false)
    private Integer basicQuizAttempts = 0;

    @Column(name = "basic_quiz_last_attempt_at")
    private LocalDateTime basicQuizLastAttemptAt;

    // Comeback Bridge
    @Column(name = "last_active_date")
    private java.time.LocalDate lastActiveDate;

    @Column(name = "comeback_claimed_at")
    private LocalDateTime comebackClaimedAt;

    @Column(name = "is_banned", nullable = false)
    private Boolean isBanned = false;

    @Column(name = "ban_reason")
    private String banReason;

    @Column(name = "banned_at")
    private LocalDateTime bannedAt;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<AuthIdentity> authIdentities = new ArrayList<>();

    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<QuizSession> quizSessions = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Answer> answers = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<UserDailyProgress> dailyProgress = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Feedback> feedback = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Bookmark> bookmarks = new ArrayList<>();

    // Constructors
    public User() {
    }

    public User(String id, String name, String email, String provider) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.provider = provider;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    /** Returns the role name as a plain String (e.g. "USER", "ADMIN"). */
    public String getRole() {
        return role != null ? role.name() : Role.USER.name();
    }

    /**
     * Sets role from a String. Accepts "USER" or "ADMIN" (case-insensitive).
     * Falls back to USER for unknown values.
     */
    public void setRole(String role) {
        try {
            this.role = Role.valueOf(role != null ? role.toUpperCase() : "USER");
        } catch (IllegalArgumentException e) {
            this.role = Role.USER;
        }
    }

    /** Type-safe setter for internal use. */
    public void setRole(Role role) {
        this.role = role != null ? role : Role.USER;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<AuthIdentity> getAuthIdentities() {
        return authIdentities;
    }

    public void setAuthIdentities(List<AuthIdentity> authIdentities) {
        this.authIdentities = authIdentities;
    }

    public List<QuizSession> getQuizSessions() {
        return quizSessions;
    }

    public void setQuizSessions(List<QuizSession> quizSessions) {
        this.quizSessions = quizSessions;
    }

    public List<Answer> getAnswers() {
        return answers;
    }

    public void setAnswers(List<Answer> answers) {
        this.answers = answers;
    }

    public List<UserDailyProgress> getDailyProgress() {
        return dailyProgress;
    }

    public void setDailyProgress(List<UserDailyProgress> dailyProgress) {
        this.dailyProgress = dailyProgress;
    }

    public List<Feedback> getFeedback() {
        return feedback;
    }

    public void setFeedback(List<Feedback> feedback) {
        this.feedback = feedback;
    }

    public List<Bookmark> getBookmarks() {
        return bookmarks;
    }

    public void setBookmarks(List<Bookmark> bookmarks) {
        this.bookmarks = bookmarks;
    }

    // SPEC-v2: Streak getters/setters
    public Integer getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(Integer currentStreak) { this.currentStreak = currentStreak; }

    public Integer getLongestStreak() { return longestStreak; }
    public void setLongestStreak(Integer longestStreak) { this.longestStreak = longestStreak; }

    public LocalDateTime getLastPlayedAt() { return lastPlayedAt; }
    public void setLastPlayedAt(LocalDateTime lastPlayedAt) { this.lastPlayedAt = lastPlayedAt; }

    public Boolean getStreakFreezeUsedThisWeek() { return streakFreezeUsedThisWeek; }
    public void setStreakFreezeUsedThisWeek(Boolean used) { this.streakFreezeUsedThisWeek = used; }

    public LocalDateTime getXpSurgeUntil() { return xpSurgeUntil; }
    public void setXpSurgeUntil(LocalDateTime xpSurgeUntil) { this.xpSurgeUntil = xpSurgeUntil; }

    public Integer getPrestigeLevel() { return prestigeLevel; }
    public void setPrestigeLevel(Integer prestigeLevel) { this.prestigeLevel = prestigeLevel; }

    public String getPrestigeAt() { return prestigeAt; }
    public void setPrestigeAt(String prestigeAt) { this.prestigeAt = prestigeAt; }

    public Integer getDaysAtTier6() { return daysAtTier6; }
    public void setDaysAtTier6(Integer daysAtTier6) { this.daysAtTier6 = daysAtTier6; }

    public LocalDateTime getTier6ReachedAt() { return tier6ReachedAt; }
    public void setTier6ReachedAt(LocalDateTime tier6ReachedAt) { this.tier6ReachedAt = tier6ReachedAt; }

    public Boolean getEarlyRankedUnlock() { return earlyRankedUnlock; }
    public void setEarlyRankedUnlock(Boolean earlyRankedUnlock) { this.earlyRankedUnlock = earlyRankedUnlock; }

    public Integer getPracticeCorrectCount() { return practiceCorrectCount; }
    public void setPracticeCorrectCount(Integer practiceCorrectCount) { this.practiceCorrectCount = practiceCorrectCount; }

    public Integer getPracticeTotalCount() { return practiceTotalCount; }
    public void setPracticeTotalCount(Integer practiceTotalCount) { this.practiceTotalCount = practiceTotalCount; }

    public LocalDateTime getEarlyRankedUnlockedAt() { return earlyRankedUnlockedAt; }
    public void setEarlyRankedUnlockedAt(LocalDateTime earlyRankedUnlockedAt) { this.earlyRankedUnlockedAt = earlyRankedUnlockedAt; }

    public java.time.LocalDate getLastActiveDate() { return lastActiveDate; }
    public void setLastActiveDate(java.time.LocalDate lastActiveDate) { this.lastActiveDate = lastActiveDate; }

    public LocalDateTime getComebackClaimedAt() { return comebackClaimedAt; }
    public void setComebackClaimedAt(LocalDateTime comebackClaimedAt) { this.comebackClaimedAt = comebackClaimedAt; }

    public Boolean getBasicQuizPassed() { return basicQuizPassed; }
    public void setBasicQuizPassed(Boolean basicQuizPassed) { this.basicQuizPassed = basicQuizPassed; }

    public LocalDateTime getBasicQuizPassedAt() { return basicQuizPassedAt; }
    public void setBasicQuizPassedAt(LocalDateTime basicQuizPassedAt) { this.basicQuizPassedAt = basicQuizPassedAt; }

    public Integer getBasicQuizAttempts() { return basicQuizAttempts; }
    public void setBasicQuizAttempts(Integer basicQuizAttempts) { this.basicQuizAttempts = basicQuizAttempts; }

    public LocalDateTime getBasicQuizLastAttemptAt() { return basicQuizLastAttemptAt; }
    public void setBasicQuizLastAttemptAt(LocalDateTime basicQuizLastAttemptAt) { this.basicQuizLastAttemptAt = basicQuizLastAttemptAt; }

    public Boolean getIsBanned() { return isBanned; }
    public void setIsBanned(Boolean banned) { this.isBanned = banned; }
    public String getBanReason() { return banReason; }
    public void setBanReason(String banReason) { this.banReason = banReason; }
    public LocalDateTime getBannedAt() { return bannedAt; }
    public void setBannedAt(LocalDateTime bannedAt) { this.bannedAt = bannedAt; }
}
