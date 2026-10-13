package com.biblequiz.modules.prayer.service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Đọc và kiểm thân request của app Cầu nguyện (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md). */
public final class PrayerInput {

    public static final int TITLE_MAX = 200;
    public static final int TEXT_MAX = 2000;
    public static final int NAME_MAX = 60;
    public static final int ITEMS_MAX = 500;
    public static final int PRAYED_MAX = 200;
    public static final String ACTIVE = "ACTIVE";
    public static final String ANSWERED = "ANSWERED";

    private static final Pattern UUID_RE =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern TOKEN_RE = Pattern.compile("^[A-Za-z0-9_-]{22}$");
    /** Ký tự điều khiển (Cc) và ký tự định dạng vô hình (Cf: zero-width, đảo chiều chữ…). */
    private static final Pattern INVISIBLE = Pattern.compile("[\\p{Cc}\\p{Cf}]");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            .withZone(ZoneOffset.UTC);

    /** Một điều trong sổ. Bia mộ (deletedAt khác null) không giữ chữ. */
    public record Item(String id, String title, String detail, String status, String testimony,
                       Instant createdAt, Instant answeredAt, Instant updatedAt, Instant deletedAt) {
        public boolean deleted() { return deletedAt != null; }
    }

    /** Một lần chủ sổ bấm "Đã cầu nguyện". */
    public record Prayed(String id, String itemId, Instant prayedAt) {}

    private PrayerInput() {}

    public static boolean isUuid(Object s) { return s instanceof String v && UUID_RE.matcher(v).matches(); }

    public static boolean isToken(String s) { return s != null && TOKEN_RE.matcher(s).matches(); }

    /** Dạng giống Date.toISOString() của trình duyệt: luôn có mili giây, luôn 'Z'. */
    public static String iso(Instant i) { return i == null ? null : ISO.format(i); }

    public static List<Item> items(Map<String, Object> body) {
        if (body == null || !(body.get("items") instanceof List<?> list)) throw new IllegalArgumentException("Thiếu items");
        if (list.size() > ITEMS_MAX) throw new IllegalArgumentException("Tối đa " + ITEMS_MAX + " điều mỗi lần");
        List<Item> out = new ArrayList<>(list.size());
        for (Object raw : list) out.add(item(raw));
        return out;
    }

    static Item item(Object raw) {
        if (!(raw instanceof Map<?, ?> m)) throw new IllegalArgumentException("Điều phải là object");
        if (!isUuid(m.get("id"))) throw new IllegalArgumentException("id phải là UUID");
        String id = (String) m.get("id");
        Instant createdAt = instant(m.get("createdAt"), true);
        Instant updatedAt = instant(m.get("updatedAt"), true);
        Instant deletedAt = instant(m.get("deletedAt"), false);
        String status = m.get("status") instanceof String s ? s : null;
        if (!ACTIVE.equals(status) && !ANSWERED.equals(status)) throw new IllegalArgumentException("status không hợp lệ");
        if (deletedAt != null) return new Item(id, "", null, status, null, createdAt, null, updatedAt, deletedAt);
        String title = m.get("title") instanceof String t ? t.strip() : null;
        if (title == null || title.isEmpty() || title.length() > TITLE_MAX) {
            throw new IllegalArgumentException("Tiêu đề phải có 1–" + TITLE_MAX + " ký tự");
        }
        boolean answered = ANSWERED.equals(status);
        return new Item(id, title, optionalText(m.get("detail"), "detail"), status,
                answered ? optionalText(m.get("testimony"), "testimony") : null,
                createdAt, answered ? instant(m.get("answeredAt"), false) : null, updatedAt, null);
    }

    public static List<Prayed> prayed(Map<String, Object> body) {
        if (body == null || !(body.get("entries") instanceof List<?> list)) throw new IllegalArgumentException("Thiếu entries");
        if (list.size() > PRAYED_MAX) throw new IllegalArgumentException("Tối đa " + PRAYED_MAX + " lần mỗi lần gửi");
        List<Prayed> out = new ArrayList<>(list.size());
        for (Object raw : list) {
            if (!(raw instanceof Map<?, ?> m) || !isUuid(m.get("id")) || !isUuid(m.get("itemId"))) {
                throw new IllegalArgumentException("Lần cầu nguyện thiếu id/itemId");
            }
            out.add(new Prayed((String) m.get("id"), (String) m.get("itemId"), instant(m.get("prayedAt"), true)));
        }
        return out;
    }

    /** Tên người nhận tự ghi: bỏ ký tự điều khiển và vô hình, cắt khoảng trắng; rỗng là null; quá 60 ký tự là lỗi. */
    public static String cleanVisitorName(Object raw) {
        if (raw == null) return null;
        if (!(raw instanceof String s)) throw new IllegalArgumentException("name phải là chuỗi");
        String clean = INVISIBLE.matcher(s).replaceAll("").strip();
        if (clean.isEmpty()) return null;
        if (clean.length() > NAME_MAX) throw new IllegalArgumentException("Tên tối đa " + NAME_MAX + " ký tự");
        return clean;
    }

    private static String optionalText(Object v, String field) {
        if (v == null) return null;
        if (!(v instanceof String s)) throw new IllegalArgumentException(field + " phải là chuỗi");
        String t = s.strip();
        if (t.length() > TEXT_MAX) throw new IllegalArgumentException(field + " tối đa " + TEXT_MAX + " ký tự");
        return t.isEmpty() ? null : t;
    }

    private static Instant instant(Object v, boolean required) {
        if (v == null) {
            if (required) throw new IllegalArgumentException("Thiếu mốc giờ");
            return null;
        }
        if (!(v instanceof String s)) throw new IllegalArgumentException("Mốc giờ phải là chuỗi ISO");
        try {
            return Instant.parse(s);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Mốc giờ không đọc được");
        }
    }
}
