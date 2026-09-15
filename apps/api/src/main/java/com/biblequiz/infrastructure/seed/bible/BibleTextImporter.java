package com.biblequiz.infrastructure.seed.bible;

import com.biblequiz.infrastructure.bible.BibleStructure;
import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.repository.BibleVerseRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Nạp toàn văn Kinh Thánh cho mode Học Thuộc (SPEC_USER §5.1.1).
 *
 * <p>Mỗi file {@code seed/bible/btthd2011/NN-Book.json} (vd {@code 43-John.json},
 * {@code 09-1_Samuel.json} — {@code _} thay khoảng trắng) là mảng
 * {@code {chapter, verse, text}}.
 *
 * <p>Chạy lại luôn an toàn: sách đã đủ số câu thì bỏ qua; ngược lại upsert theo
 * lô bằng id deterministic ({@link BibleVerse#idFor}). Không bọc transaction —
 * lỗi giữa chừng để lại một phần sách, lần boot kế thấy thiếu và nạp bù.
 * Tắt mặc định ({@code BIBLE_IMPORT_ENABLED}); không bao giờ làm hỏng startup.
 */
@Component
@ConditionalOnProperty(name = "app.seeding.bible.enabled", havingValue = "true")
public class BibleTextImporter {

    private static final Logger log = LoggerFactory.getLogger(BibleTextImporter.class);
    private static final Pattern FILE_NAME = Pattern.compile("^(\\d{1,2})-(.+)\\.json$");
    static final int BATCH_SIZE = 500;
    static final String UPSERT_SQL = "INSERT INTO bible_verses (id, version, book, book_order, chapter, verse, text) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)";

    record VerseRow(int chapter, int verse, String text) {}

    private final BibleVerseRepository repository;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final ResourcePatternResolver resolver;

    @Value("${app.seeding.bible.pattern:classpath*:seed/bible/btthd2011/*.json}")
    private String pattern;

    public BibleTextImporter(BibleVerseRepository repository, JdbcTemplate jdbc,
                             ObjectMapper objectMapper, ResourcePatternResolver resolver) {
        this.repository = repository;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.resolver = resolver;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        try {
            int imported = 0;
            for (Resource resource : resolver.getResources(pattern)) {
                try (InputStream in = resource.getInputStream()) {
                    List<VerseRow> rows = objectMapper.readValue(in, new TypeReference<>() {});
                    imported += importFile(resource.getFilename(), rows);
                }
            }
            log.info("[bible-import] done, {} verses written", imported);
        } catch (Exception e) {
            log.error("[bible-import] aborted: {}", e.getMessage(), e);
        }
    }

    /** @return số câu đã ghi (0 nếu bỏ qua). */
    int importFile(String fileName, List<VerseRow> rows) {
        Matcher m = FILE_NAME.matcher(fileName == null ? "" : fileName);
        if (!m.matches()) throw new IllegalArgumentException("Bad bible seed file name: " + fileName);
        int order = Integer.parseInt(m.group(1));
        String book = m.group(2).replace('_', ' ');
        List<String> canon = BibleStructure.getCanonicalBooks();
        if (order < 1 || order > canon.size() || !canon.get(order - 1).equals(book)) {
            throw new IllegalArgumentException("File " + fileName + " does not match canonical book #" + order);
        }

        if (repository.countByVersionAndBook(BibleVerse.BTTHD_2011, book) >= rows.size()) {
            return 0;
        }
        List<String> mismatches = structureMismatches(book, rows);
        if (!mismatches.isEmpty()) {
            // Versification bản VN có thể lệch nhẹ BibleStructure — cảnh báo, không chặn.
            log.warn("[bible-import] {} lệch cấu trúc ở {} chỗ, vd {}", book, mismatches.size(),
                    mismatches.subList(0, Math.min(5, mismatches.size())));
        }

        List<Object[]> args = new ArrayList<>(rows.size());
        for (VerseRow r : rows) {
            args.add(new Object[]{BibleVerse.idFor(BibleVerse.BTTHD_2011, book, r.chapter(), r.verse()),
                    BibleVerse.BTTHD_2011, book, order, r.chapter(), r.verse(), r.text()});
        }
        for (int i = 0; i < args.size(); i += BATCH_SIZE) {
            jdbc.batchUpdate(UPSERT_SQL, args.subList(i, Math.min(i + BATCH_SIZE, args.size())));
        }
        log.info("[bible-import] {} → {} verses", book, rows.size());
        return rows.size();
    }

    /** Chương/câu trong file mà BibleStructure không có (hoặc chữ rỗng). */
    static List<String> structureMismatches(String book, List<VerseRow> rows) {
        List<String> out = new ArrayList<>();
        int maxChapter = BibleStructure.getMaxChapter(book);
        for (VerseRow r : rows) {
            boolean badRef = r.chapter() < 1 || r.chapter() > maxChapter
                    || r.verse() < 1 || r.verse() > BibleStructure.getVerseCount(book, r.chapter());
            if (badRef || r.text() == null || r.text().isBlank()) out.add(r.chapter() + ":" + r.verse());
        }
        return out;
    }
}
