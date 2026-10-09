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

    /** Bản Truyền Thống 1926 (Cadman, eBible {@code vie1934}) — Public Domain. Học Thuộc dùng tạm 15/09–09/10/2026. */
    public static final String BTT_1926 = "BTT1926";

    /** Bản Truyền Thống Hiệu Đính 2010 (RVV11) — bản canonical của app (C4), cùng bản với bộ câu hỏi mới. */
    public static final String RVV11 = "RVV11";

    /**
     * Bản dịch Học Thuộc đang dùng (DECISIONS 2026-10-09). Đổi bản = đổi hằng này + nạp seed tương ứng
     * ({@code app.seeding.bible.pattern}) + chuyển {@code user_memory_verses.version} bằng migration.
     */
    public static final String ACTIVE_VERSION = RVV11;

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

    /** Câu cuối của một khối gộp (RVV11 in "17-18" thành một khối, lưu ở câu 17); null = một câu. */
    @Column(name = "verse_end")
    private Integer verseEnd;

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
    public Integer getVerseEnd() { return verseEnd; }
    public void setVerseEnd(Integer verseEnd) { this.verseEnd = verseEnd; }
    /** Câu cuối mà dòng này phủ: {@code verseEnd} của khối gộp, hoặc chính {@code verse}. */
    public int getLastVerse() { return verseEnd != null ? verseEnd : verse; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
