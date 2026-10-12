package com.biblequiz.modules.room.service;

import com.biblequiz.infrastructure.bible.BibleStructure;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * PCV-24 — phạm vi theo đoạn của phòng "Ôn phần đọc hôm nay" (design §3.4): danh sách
 * {@code {book, fromChapter, toChapter}}, lưu dạng JSON ở {@code rooms.passage_scope}.
 * Chỉ nhận sách có trong 66 sách (tên chuẩn tiếng Anh, như {@code Question.book}); chương bị kẹp
 * vào sách, khoảng ngược thì đảo lại, đoạn trùng thì bỏ, tối đa {@link #MAX_SEGMENTS} đoạn.
 */
public final class PassageScope {

    public static final int MAX_SEGMENTS = 10;

    private static final ObjectMapper JSON = new ObjectMapper();

    private PassageScope() {}

    @JsonPropertyOrder({"book", "fromChapter", "toChapter"})
    public record Segment(String book, int fromChapter, int toChapter) {}

    /** Thân request {@code passageScope}: danh sách {book, fromChapter, toChapter}; thứ khác → rỗng. */
    public static List<Segment> fromRequest(Object raw) {
        if (!(raw instanceof List<?> list)) return List.of();
        List<Segment> out = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> m)) continue;
            Integer from = toInt(m.get("fromChapter"));
            Integer to = toInt(m.get("toChapter"));
            if (m.get("book") instanceof String book && from != null && to != null) {
                out.add(new Segment(book, from, to));
            }
        }
        return sanitize(out);
    }

    /** Kiểm sách, kẹp chương, bỏ trùng, giữ tối đa {@link #MAX_SEGMENTS} đoạn. */
    public static List<Segment> sanitize(List<Segment> raw) {
        Set<Segment> out = new LinkedHashSet<>();
        for (Segment s : raw) {
            if (out.size() >= MAX_SEGMENTS) break;
            String book = canonicalBook(s.book());
            if (book == null) continue;
            int max = BibleStructure.getMaxChapter(book);
            int from = Math.min(s.fromChapter(), s.toChapter());
            int to = Math.max(s.fromChapter(), s.toChapter());
            if (to < 1 || from > max) continue;
            out.add(new Segment(book, Math.max(1, from), Math.min(max, to)));
        }
        return List.copyOf(out);
    }

    /** JSON để lưu; rỗng → null (phòng không có phạm vi theo đoạn). */
    public static String toJson(List<Segment> segments) {
        if (segments == null || segments.isEmpty()) return null;
        try {
            return JSON.writeValueAsString(segments);
        } catch (Exception e) {
            return null;
        }
    }

    /** Đọc cột {@code rooms.passage_scope}; null/hỏng → rỗng (phòng chọn câu như thường). */
    public static List<Segment> fromJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return sanitize(JSON.readValue(json, new TypeReference<List<Segment>>() {}));
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String canonicalBook(String name) {
        if (name == null || name.isBlank()) return null;
        String wanted = name.trim();
        if (BibleStructure.isKnown(wanted)) return wanted;
        String lower = wanted.toLowerCase(Locale.ROOT);
        return BibleStructure.getCanonicalBooks().stream()
                .filter(b -> b.toLowerCase(Locale.ROOT).equals(lower))
                .findFirst().orElse(null);
    }

    private static Integer toInt(Object v) {
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
