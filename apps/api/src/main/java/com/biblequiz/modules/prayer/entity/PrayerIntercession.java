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

    /** Lời nhắn cho người nhờ (bản 2, V80); chỉ người nhờ đọc. */
    @Column(length = 300)
    private String message;

    protected PrayerIntercession() {}

    public PrayerIntercession(String shareToken, String visitorId, String visitorName, Instant prayedAt) {
        this(shareToken, visitorId, visitorName, null, prayedAt);
    }

    public PrayerIntercession(String shareToken, String visitorId, String visitorName, String message, Instant prayedAt) {
        this.shareToken = shareToken;
        this.visitorId = visitorId;
        this.visitorName = visitorName;
        this.message = message;
        this.prayedAt = Utc.of(prayedAt);
    }

    /** Người nhận gửi tên hay lời nhắn sau khi đã bấm A-men: chỉ ghi trường nào có. */
    public void update(String name, String newMessage) {
        if (name != null) visitorName = name;
        if (newMessage != null) message = newMessage;
    }

    public String getShareToken() { return shareToken; }
    public String getVisitorId() { return visitorId; }
    public String getVisitorName() { return visitorName; }
    public String getMessage() { return message; }
    public Instant prayedAtInstant() { return Utc.instant(prayedAt); }
}
