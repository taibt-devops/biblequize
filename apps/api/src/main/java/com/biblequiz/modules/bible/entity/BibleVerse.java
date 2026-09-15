package com.biblequiz.modules.bible.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một câu Kinh Thánh trong toàn văn (SPEC_USER §5.1.1). Read-only sau import —
 * nguồn chữ cho mode Học Thuộc. {@code book} là English key giống
 * {@code questions.book}.
 */
@Entity
@Table(name = "bible_verses")
public class BibleVerse {

    /** Bản dịch canonical (C4) — đích, chưa có dữ liệu (BL-1). */
    public static final String BTTHD_2011 = "BTTHD2011";

    /** Bản Truyền Thống 1926 (Cadman, eBible {@code vie1934}) — Public Domain. */
    public static final String BTT_1926 = "BTT1926";

    /**
     * Bản dịch Học Thuộc đang dùng thật. Tạm là BTT 1926 cho tới khi có file BTTHĐ 2011
     * (DECISIONS 2026-09-15, BL-1): đổi hằng này + nạp seed tương ứng.
     */
    public static final String ACTIVE_VERSION = BTT_1926;

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 16)
    private String version;

    @Column(nullable = false, length = 40)
    private String book;

    @Column(name = "book_order", nullable = false)
    private int bookOrder;

    @Column(nullable = false)
    private int chapter;

    @Column(nullable = false)
    private int verse;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public BibleVerse() {}

    public BibleVerse(String version, String book, int bookOrder, int chapter, int verse, String text) {
        this.id = idFor(version, book, chapter, verse);
        this.version = version;
        this.book = book;
        this.bookOrder = bookOrder;
        this.chapter = chapter;
        this.verse = verse;
        this.text = text;
    }

    /** Id deterministic → import lại cùng câu luôn trúng cùng dòng. */
    public static String idFor(String version, String book, int chapter, int verse) {
        String key = "bible|" + version + "|" + book + "|" + chapter + "|" + verse;
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString();
    }

    public String getId() { return id; }
    public String getVersion() { return version; }
    public String getBook() { return book; }
    public int getBookOrder() { return bookOrder; }
    public int getChapter() { return chapter; }
    public int getVerse() { return verse; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
