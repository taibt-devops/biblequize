package com.biblequiz.modules.prayer.service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Đọc và kiểm thân request của app Cầu nguyện (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md, cả mục "Bản 2"). */
public final class PrayerInput {

    public static final int TITLE_MAX = 200;
    public static final int TEXT_MAX = 2000;
    public static final int NAME_MAX = 60;
    public static final int ITEMS_MAX = 500;
    public static final int PRAYED_MAX = 200;
    public static final int UPDATE_MAX = 500;
    public static final int UPDATES_MAX = 20;
    public static final int OWNER_MAX = 100;
    public static final int MESSAGE_MAX = 300;
    public static final String ACTIVE = "ACTIVE";
    public static final String ANSWERED = "ANSWERED";
    public static final String ARCHIVED = "ARCHIVED";
    public static final String DAILY = "DAILY";
    public static final Set<String> TOPICS = Set.of("FAMILY", "SELF", "SALVATION", "CHURCH", "HEALTH", "WORK", "NATION");

    private static final Pattern UUID_RE =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern TOKEN_RE = Pattern.compile("^[A-Za-z0-9_-]{22}$");
    /** Ký tự điều khiển (Cc) và ký tự định dạng vô hình (Cf: zero-width, đảo chiều chữ…). */
    private static final Pattern INVISIBLE = Pattern.compile("[\\p{Cc}\\p{Cf}]");
    private static final Pattern LINE_BREAKS = Pattern.compile("[\\r\\n\\t]+");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            .withZone(ZoneOffset.UTC);

    /** Một dòng tin mới của một điều ("Ba mổ xong, đang hồi phục"). */
    public record Update(String id, String text, Instant at) {}

    /**
     * Trường bản 2 (V80). Payload thiếu khóa "updates" là của app bản 1: {@code Item.v2() == null}, và máy chủ giữ
     * nguyên mọi trường bản 2 đang có của điều đó.
     */
    public record V2(String cadence, String topic, List<Update> updates, boolean shareTestimony, Instant archivedAt,
                     String sourceToken, String sourceOwner) {
        public static final V2 EMPTY = new V2(null, null, List.of(), false, null, null, null);
    }

    /** Một điều trong sổ. Bia mộ (deletedAt khác null) không giữ chữ, tin mới hay nguồn. */
    public record Item(String id, String title, String detail, String status, String testimony,
                       Instant createdAt, Instant answeredAt, Instant updatedAt, Instant deletedAt, V2 v2) {
        /** Điều của app bản 1 (không có trường bản 2). */
        public Item(String id, String title, String detail, String status, String testimony,
                    Instant createdAt, Instant answeredAt, Instant updatedAt, Instant deletedAt) {
            this(id, title, detail, status, testimony, createdAt, answeredAt, updatedAt, deletedAt, null);
        }

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
        if (!ACTIVE.equals(status) && !ANSWERED.equals(status) && !ARCHIVED.equals(status)) {
            throw new IllegalArgumentException("status không hợp lệ");
        }
        if (deletedAt != null) return new Item(id, "", null, status, null, createdAt, null, updatedAt, deletedAt, V2.EMPTY);
        String title = m.get("title") instanceof String t ? t.strip() : null;
        if (title == null || title.isEmpty() || title.length() > TITLE_MAX) {
            throw new IllegalArgumentException("Tiêu đề phải có 1–" + TITLE_MAX + " ký tự");
        }
        boolean answered = ANSWERED.equals(status);
        return new Item(id, title, optionalText(m.get("detail"), "detail"), status,
                answered ? optionalText(m.get("testimony"), "testimony") : null,
                createdAt, answered ? instant(m.get("answeredAt"), false) : null, updatedAt, null,
                m.containsKey("updates") ? v2(m, status) : null);
    }

    private static V2 v2(Map<?, ?> m, String status) {
        Object cadence = m.get("cadence");
        if (cadence != null && !DAILY.equals(cadence)) throw new IllegalArgumentException("cadence không hợp lệ");
        Object topic = m.get("topic");
        if (topic != null && !(topic instanceof String t && TOPICS.contains(t))) {
            throw new IllegalArgumentException("topic không hợp lệ");
        }
        Object share = m.get("shareTestimony");
        if (share != null && !(share instanceof Boolean)) throw new IllegalArgumentException("shareTestimony phải là true/false");
        Object token = m.get("sourceToken");
        if (token != null && !(token instanceof String s && isToken(s))) throw new IllegalArgumentException("sourceToken không hợp lệ");
        return new V2((String) cadence, (String) topic, updates(m.get("updates")), Boolean.TRUE.equals(share),
                ARCHIVED.equals(status) ? instant(m.get("archivedAt"), false) : null,
                (String) token, owner(m.get("sourceOwner")));
    }

    private static List<Update> updates(Object raw) {
        if (raw == null) return List.of();
        if (!(raw instanceof List<?> list)) throw new IllegalArgumentException("updates phải là mảng");
        if (list.size() > UPDATES_MAX) throw new IllegalArgumentException("Tối đa " + UPDATES_MAX + " tin mới");
        List<Update> out = new ArrayList<>(list.size());
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> u) || !isUuid(u.get("id"))) throw new IllegalArgumentException("Tin mới thiếu id");
            String text = u.get("text") instanceof String t ? t.strip() : null;
            if (text == null || text.isEmpty() || text.length() > UPDATE_MAX) {
                throw new IllegalArgumentException("Tin mới phải có 1–" + UPDATE_MAX + " ký tự");
            }
            out.add(new Update((String) u.get("id"), text, instant(u.get("at"), true)));
        }
        return List.copyOf(out);
    }

    /** Tên người nhờ (lời nhờ của người khác): bỏ ký tự vô hình, cắt khoảng trắng; rỗng là null. */
    private static String owner(Object raw) {
        if (raw == null) return null;
        if (!(raw instanceof String s)) throw new IllegalArgumentException("sourceOwner phải là chuỗi");
        String clean = INVISIBLE.matcher(s).replaceAll("").strip();
        if (clean.length() > OWNER_MAX) throw new IllegalArgumentException("sourceOwner tối đa " + OWNER_MAX + " ký tự");
        return clean.isEmpty() ? null : clean;
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

    /**
     * Lời nhắn của người cầu thay (chỉ người nhờ đọc): xuống dòng thành dấu cách, bỏ ký tự điều khiển và vô hình,
     * cắt khoảng trắng; rỗng là null; quá 300 ký tự là lỗi.
     */
    public static String cleanMessage(Object raw) {
        if (raw == null) return null;
        if (!(raw instanceof String s)) throw new IllegalArgumentException("message phải là chuỗi");
        String clean = INVISIBLE.matcher(LINE_BREAKS.matcher(s).replaceAll(" ")).replaceAll("").strip();
        if (clean.isEmpty()) return null;
        if (clean.length() > MESSAGE_MAX) throw new IllegalArgumentException("Lời nhắn tối đa " + MESSAGE_MAX + " ký tự");
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
