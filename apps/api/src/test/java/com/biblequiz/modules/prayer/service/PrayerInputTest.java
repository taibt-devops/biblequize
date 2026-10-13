package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class PrayerInputTest {

    private static final String ID = "11111111-1111-4111-8111-111111111111";
    private static final String T = "2026-10-13T01:00:00.000Z";

    private static Map<String, Object> raw(Map<String, Object> over) {
        Map<String, Object> m = new HashMap<>(Map.of("id", ID, "title", "  Ba mẹ được bình an  ", "status", "ACTIVE",
                "createdAt", T, "updatedAt", T));
        m.putAll(over);
        return m;
    }

    private static Item one(Map<String, Object> over) {
        return PrayerInput.items(Map.of("items", List.of(raw(over)))).get(0);
    }

    @Test
    void items_trimsTitle_dropsBlankDetail() {
        Map<String, Object> over = new HashMap<>();
        over.put("detail", "   ");
        Item it = one(over);
        assertEquals("Ba mẹ được bình an", it.title());
        assertNull(it.detail());
        assertEquals(Instant.parse(T), it.updatedAt());
        assertFalse(it.deleted());
    }

    @Test
    void items_rejectsBadTitleIdStatusAndTime() {
        assertThrows(IllegalArgumentException.class, () -> one(Map.of("title", "   ")));
        assertThrows(IllegalArgumentException.class, () -> one(Map.of("title", "a".repeat(201))));
        assertDoesNotThrow(() -> one(Map.of("title", "a".repeat(200))));
        assertThrows(IllegalArgumentException.class, () -> one(Map.of("id", "khong-phai-uuid")));
        assertThrows(IllegalArgumentException.class, () -> one(Map.of("status", "DONE")));
        assertThrows(IllegalArgumentException.class, () -> one(Map.of("updatedAt", "hôm qua")));
        assertThrows(IllegalArgumentException.class, () -> one(Map.of("detail", "a".repeat(2001))));
        assertThrows(IllegalArgumentException.class, () -> PrayerInput.items(Map.of()));
    }

    @Test
    void items_testimonyOnlyKeptWhenAnswered() {
        Item answered = one(Map.of("status", "ANSWERED", "testimony", " Ba đã khỏe ", "answeredAt", T));
        assertEquals("Ba đã khỏe", answered.testimony());
        assertEquals(Instant.parse(T), answered.answeredAt());
        Item active = one(Map.of("testimony", "bỏ đi", "answeredAt", T));
        assertNull(active.testimony());
        assertNull(active.answeredAt());
    }

    @Test
    void items_tombstoneCarriesNoText() {
        Item tomb = one(Map.of("deletedAt", T, "title", "   ", "detail", "chuyện riêng"));
        assertTrue(tomb.deleted());
        assertEquals("", tomb.title());
        assertNull(tomb.detail());
        assertNull(tomb.testimony());
    }

    @Test
    void items_atMost500() {
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i < 501; i++) many.add(raw(Map.of()));
        assertThrows(IllegalArgumentException.class, () -> PrayerInput.items(Map.of("items", many)));
    }

    @Test
    void prayed_parsesAndLimits() {
        var list = PrayerInput.prayed(Map.of("entries", List.of(Map.of("id", ID, "itemId", ID, "prayedAt", T))));
        assertEquals(Instant.parse(T), list.get(0).prayedAt());
        assertThrows(IllegalArgumentException.class,
                () -> PrayerInput.prayed(Map.of("entries", List.of(Map.of("id", "x", "itemId", ID, "prayedAt", T)))));
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i < 201; i++) many.add(Map.of("id", ID, "itemId", ID, "prayedAt", T));
        assertThrows(IllegalArgumentException.class, () -> PrayerInput.prayed(Map.of("entries", many)));
    }

    @Test
    void cleanVisitorName_stripsInvisibleAndLimits() {
        assertNull(PrayerInput.cleanVisitorName(null));
        assertNull(PrayerInput.cleanVisitorName("   "));
        assertNull(PrayerInput.cleanVisitorName("\u200B\u0007\u202E"));
        assertEquals("Hạnh", PrayerInput.cleanVisitorName("  Hạ\u200Bnh\n"));
        assertEquals("a".repeat(60), PrayerInput.cleanVisitorName("a".repeat(60)));
        assertThrows(IllegalArgumentException.class, () -> PrayerInput.cleanVisitorName("a".repeat(61)));
        assertThrows(IllegalArgumentException.class, () -> PrayerInput.cleanVisitorName(42));
    }

    @Test
    void tokenAndUuidAndIso() {
        assertTrue(PrayerInput.isToken("AbCdEfGhIjKlMnOpQr_-12"));
        assertFalse(PrayerInput.isToken("AbCdEfGhIjKlMnOpQr_-1"));
        assertFalse(PrayerInput.isToken("AbCdEfGhIjKlMnOpQr/+12"));
        assertFalse(PrayerInput.isToken(null));
        assertTrue(PrayerInput.isUuid(ID));
        assertFalse(PrayerInput.isUuid(42));
        assertEquals("2026-10-13T01:00:00.000Z", PrayerInput.iso(Instant.parse("2026-10-13T01:00:00Z")));
        assertNull(PrayerInput.iso(null));
    }
}
