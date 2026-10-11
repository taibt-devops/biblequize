package com.biblequiz.modules.reading.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Một lần tiến độ đổi (lịch, phần kế, lần đọc) — để đo chỉ số của app Đọc hằng ngày. */
@Entity
@Table(name = "reading_log")
public class ReadingLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "plan_id", nullable = false, length = 8)
    private String planId;

    @Column(name = "next_portion", nullable = false)
    private int nextPortion;

    @Column(nullable = false)
    private int lap;

    @Column(name = "logged_at", nullable = false)
    private LocalDateTime loggedAt;

    protected ReadingLog() {}

    public ReadingLog(String userId, String planId, int nextPortion, int lap, Instant now) {
        this.userId = userId;
        this.planId = planId;
        this.nextPortion = nextPortion;
        this.lap = lap;
        this.loggedAt = LocalDateTime.ofInstant(now, ZoneOffset.UTC);
    }

    public int getNextPortion() { return nextPortion; }
}
