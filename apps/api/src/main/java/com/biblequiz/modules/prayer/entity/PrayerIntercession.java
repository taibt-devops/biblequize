package com.biblequiz.modules.prayer.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;

/** Một lần người nhận link bấm "Tôi đã cầu nguyện". Không lưu IP hay tài khoản. */
@Entity
@Table(name = "prayer_intercessions")
public class PrayerIntercession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "share_token", nullable = false, length = 22)
    private String shareToken;

    @Column(name = "visitor_id", nullable = false, length = 36)
    private String visitorId;

    @Column(name = "visitor_name", length = 60)
    private String visitorName;

    @Column(name = "prayed_at", nullable = false)
    private LocalDateTime prayedAt;

    protected PrayerIntercession() {}

    public PrayerIntercession(String shareToken, String visitorId, String visitorName, Instant prayedAt) {
        this.shareToken = shareToken;
        this.visitorId = visitorId;
        this.visitorName = visitorName;
        this.prayedAt = Utc.of(prayedAt);
    }

    public String getShareToken() { return shareToken; }
    public String getVisitorId() { return visitorId; }
    public String getVisitorName() { return visitorName; }
    public Instant prayedAtInstant() { return Utc.instant(prayedAt); }
}
