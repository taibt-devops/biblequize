package com.biblequiz.modules.prayer.entity;

import com.biblequiz.modules.prayer.service.PrayerInput;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;

/** Một điều trong sổ cầu nguyện. Id do máy người dùng sinh (UUID). */
@Entity
@Table(name = "prayer_items")
public class PrayerItem {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(nullable = false, length = 10)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String testimony;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "answered_at")
    private LocalDateTime answeredAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    protected PrayerItem() {}

    public static PrayerItem of(String userId, Item in, Instant now) {
        PrayerItem p = new PrayerItem();
        p.id = in.id();
        p.userId = userId;
        p.apply(in, now);
        return p;
    }

    /** Ghi đè bằng bản của máy người dùng. Bia mộ thì không giữ chữ. */
    public void apply(Item in, Instant now) {
        title = in.deleted() ? "" : in.title();
        detail = in.deleted() ? null : in.detail();
        testimony = in.deleted() ? null : in.testimony();
        status = in.status();
        createdAt = Utc.of(in.createdAt());
        answeredAt = Utc.of(in.answeredAt());
        updatedAt = Utc.of(in.updatedAt());
        deletedAt = Utc.of(in.deletedAt());
        savedAt = Utc.of(now);
    }

    public Item toItem() {
        return new Item(id, title, detail, status, testimony, Utc.instant(createdAt), Utc.instant(answeredAt),
                Utc.instant(updatedAt), Utc.instant(deletedAt));
    }

    public boolean isDeleted() { return deletedAt != null; }
    public boolean isAnswered() { return PrayerInput.ANSWERED.equals(status); }
    public Instant createdAtInstant() { return Utc.instant(createdAt); }
    public Instant updatedAtInstant() { return Utc.instant(updatedAt); }
    public Instant deletedAtInstant() { return Utc.instant(deletedAt); }
    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getTitle() { return title; }
    public String getDetail() { return detail; }
    public String getStatus() { return status; }
}
