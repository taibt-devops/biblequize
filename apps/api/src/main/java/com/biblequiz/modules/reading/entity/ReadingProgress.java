package com.biblequiz.modules.reading.entity;

import com.biblequiz.modules.reading.service.ReadingProgressService.Progress;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Tiến độ của một người trong app Đọc hằng ngày; mốc giờ lưu dạng UTC. */
@Entity
@Table(name = "reading_progress")
public class ReadingProgress {

    @Id
    @Column(name = "user_id", length = 36)
    private String userId;

    @Column(name = "plan_id", nullable = false, length = 8)
    private String planId;

    @Column(name = "next_portion", nullable = false)
    private int nextPortion;

    @Column(nullable = false)
    private int lap;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    protected ReadingProgress() {}

    public static ReadingProgress of(String userId, Progress p, Instant now) {
        ReadingProgress r = new ReadingProgress();
        r.userId = userId;
        r.apply(p, now);
        return r;
    }

    public void apply(Progress p, Instant now) {
        planId = p.plan();
        nextPortion = p.next();
        lap = p.lap();
        startedAt = utc(p.startedAt());
        lastReadAt = utc(p.lastReadAt());
        updatedAt = utc(p.updatedAt());
        savedAt = utc(now);
    }

    public Progress toProgress() {
        return new Progress(planId, nextPortion, lap, instant(startedAt), instant(lastReadAt), instant(updatedAt));
    }

    private static LocalDateTime utc(Instant i) {
        return i == null ? null : LocalDateTime.ofInstant(i, ZoneOffset.UTC);
    }

    private static Instant instant(LocalDateTime t) {
        return t == null ? null : t.toInstant(ZoneOffset.UTC);
    }

    public String getUserId() { return userId; }
    public String getPlanId() { return planId; }
    public int getNextPortion() { return nextPortion; }
    public int getLap() { return lap; }
}
