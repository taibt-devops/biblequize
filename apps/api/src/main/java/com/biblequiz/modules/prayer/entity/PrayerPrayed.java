package com.biblequiz.modules.prayer.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;

/** Một lần chủ sổ bấm "Đã cầu nguyện". Id do máy sinh, trùng thì bỏ qua. */
@Entity
@Table(name = "prayer_prayed")
public class PrayerPrayed {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "item_id", nullable = false, length = 36)
    private String itemId;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "prayed_at", nullable = false)
    private LocalDateTime prayedAt;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    protected PrayerPrayed() {}

    public PrayerPrayed(String id, String itemId, String userId, Instant prayedAt, Instant savedAt) {
        this.id = id;
        this.itemId = itemId;
        this.userId = userId;
        this.prayedAt = Utc.of(prayedAt);
        this.savedAt = Utc.of(savedAt);
    }

    public String getId() { return id; }
    public String getItemId() { return itemId; }
    public Instant prayedAtInstant() { return Utc.instant(prayedAt); }
}
