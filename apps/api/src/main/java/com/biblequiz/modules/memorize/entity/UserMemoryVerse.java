package com.biblequiz.modules.memorize.entity;

import com.biblequiz.modules.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Một câu hoặc đoạn liền nhau (≤ 5 câu) trong danh sách Học Thuộc của user,
 * kèm mức thuộc 0–5 và lịch ôn (SPEC_USER §5.1.1). Quy tắc chuyển mức nằm ở
 * {@code MemorySchedule}, không ở đây.
 */
@Entity
@Table(name = "user_memory_verses")
public class UserMemoryVerse {

    public static final int MAX_LEVEL = 5;

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 16)
    private String version;

    @Column(nullable = false, length = 40)
    private String book;

    @Column(nullable = false)
    private int chapter;

    @Column(name = "verse_start", nullable = false)
    private int verseStart;

    @Column(name = "verse_end", nullable = false)
    private int verseEnd;

    @Column(name = "mastery_level", nullable = false)
    private int masteryLevel = 0;

    @Column(name = "next_review_at", nullable = false)
    private LocalDateTime nextReviewAt;

    @Column(name = "last_reviewed_at")
    private LocalDateTime lastReviewedAt;

    @Column(name = "review_count", nullable = false)
    private int reviewCount = 0;

    @Column(name = "lapse_count", nullable = false)
    private int lapseCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public UserMemoryVerse() {}

    /** Câu mới thêm: level 0, đến hạn ngay. */
    public UserMemoryVerse(String id, User user, String version, String book, int chapter,
                           int verseStart, int verseEnd, LocalDateTime now) {
        this.id = id;
        this.user = user;
        this.version = version;
        this.book = book;
        this.chapter = chapter;
        this.verseStart = verseStart;
        this.verseEnd = verseEnd;
        this.nextReviewAt = now;
    }

    public boolean isDue(LocalDateTime now) {
        return !nextReviewAt.isAfter(now);
    }

    public String getId() { return id; }
    public User getUser() { return user; }
    public String getVersion() { return version; }
    public String getBook() { return book; }
    public int getChapter() { return chapter; }
    public int getVerseStart() { return verseStart; }
    public int getVerseEnd() { return verseEnd; }
    public int getMasteryLevel() { return masteryLevel; }
    public void setMasteryLevel(int masteryLevel) { this.masteryLevel = masteryLevel; }
    public LocalDateTime getNextReviewAt() { return nextReviewAt; }
    public void setNextReviewAt(LocalDateTime nextReviewAt) { this.nextReviewAt = nextReviewAt; }
    public LocalDateTime getLastReviewedAt() { return lastReviewedAt; }
    public void setLastReviewedAt(LocalDateTime lastReviewedAt) { this.lastReviewedAt = lastReviewedAt; }
    public int getReviewCount() { return reviewCount; }
    public void setReviewCount(int reviewCount) { this.reviewCount = reviewCount; }
    public int getLapseCount() { return lapseCount; }
    public void setLapseCount(int lapseCount) { this.lapseCount = lapseCount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
