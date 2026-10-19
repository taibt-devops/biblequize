package com.biblequiz.modules.prayer.entity;

import com.biblequiz.modules.prayer.service.PrayerInput;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import com.biblequiz.modules.prayer.service.PrayerInput.Update;
import com.biblequiz.modules.prayer.service.PrayerInput.V2;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

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

    // ---- Bản 2 (V80) ----

    /** DAILY = cầu nguyện mỗi ngày; null = xoay vòng. */
    @Column(length = 10)
    private String cadence;

    @Column(length = 16)
    private String topic;

    @Column(name = "updates_json", columnDefinition = "TEXT")
    private String updatesJson;

    /** Người có link đọc được lời chứng khi điều đã nhậm lời. */
    @Column(name = "share_testimony", nullable = false)
    private boolean shareTestimony;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    /** Lời nhờ của người khác giữ trong sổ này: token link của họ. */
    @Column(name = "source_token", length = 22)
    private String sourceToken;

    @Column(name = "source_owner", length = 100)
    private String sourceOwner;

    protected PrayerItem() {}

    public static PrayerItem of(String userId, Item in, Instant now) {
        PrayerItem p = new PrayerItem();
        p.id = in.id();
        p.userId = userId;
        p.apply(in, now);
        return p;
    }

    /**
     * Ghi đè bằng bản của máy người dùng. Bia mộ thì không giữ chữ, tin mới hay nguồn.
     * Điều của app bản 1 (v2 null) không đụng tới trường bản 2 đang có.
     */
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
        if (in.deleted()) applyV2(V2.EMPTY);
        else if (in.v2() != null) applyV2(in.v2());
        if (!PrayerInput.ARCHIVED.equals(status)) archivedAt = null;
    }

    private void applyV2(V2 v) {
        cadence = v.cadence();
        topic = v.topic();
        updatesJson = PrayerUpdatesJson.write(v.updates());
        shareTestimony = v.shareTestimony();
        archivedAt = Utc.of(v.archivedAt());
        sourceToken = v.sourceToken();
        sourceOwner = v.sourceOwner();
    }

    public Item toItem() {
        return new Item(id, title, detail, status, testimony, Utc.instant(createdAt), Utc.instant(answeredAt),
                Utc.instant(updatedAt), Utc.instant(deletedAt),
                new V2(cadence, topic, updates(), shareTestimony, Utc.instant(archivedAt), sourceToken, sourceOwner));
    }

    public boolean isDeleted() { return deletedAt != null; }
    public boolean isAnswered() { return PrayerInput.ANSWERED.equals(status); }
    public boolean isArchived() { return PrayerInput.ARCHIVED.equals(status); }
    public boolean isActive() { return PrayerInput.ACTIVE.equals(status); }
    public boolean isShareTestimony() { return shareTestimony; }
    public String getTopic() { return topic; }
    public String getSourceToken() { return sourceToken; }
    public List<Update> updates() { return PrayerUpdatesJson.read(updatesJson); }
    public Instant answeredAtInstant() { return Utc.instant(answeredAt); }
    public Instant createdAtInstant() { return Utc.instant(createdAt); }
    public Instant updatedAtInstant() { return Utc.instant(updatedAt); }
    public Instant deletedAtInstant() { return Utc.instant(deletedAt); }
    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getTitle() { return title; }
    public String getDetail() { return detail; }
    public String getStatus() { return status; }
}
