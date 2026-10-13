package com.biblequiz.modules.prayer.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;

/** Link nhờ cầu thay của một điều. Thu lại thì giữ dòng, đặt revoked_at. */
@Entity
@Table(name = "prayer_shares")
public class PrayerShare {

    @Id
    @Column(length = 22)
    private String token;

    @Column(name = "item_id", nullable = false, length = 36)
    private String itemId;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    protected PrayerShare() {}

    public PrayerShare(String token, String itemId, String userId, Instant createdAt) {
        this.token = token;
        this.itemId = itemId;
        this.userId = userId;
        this.createdAt = Utc.of(createdAt);
    }

    public boolean isOpen() { return revokedAt == null; }

    public void revoke(Instant now) { if (revokedAt == null) revokedAt = Utc.of(now); }

    public String getToken() { return token; }
    public String getItemId() { return itemId; }
    public String getUserId() { return userId; }
    public Instant createdAtInstant() { return Utc.instant(createdAt); }
}
