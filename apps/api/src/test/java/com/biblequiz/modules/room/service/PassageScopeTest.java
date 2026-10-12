package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.service.PassageScope.Segment;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** PCV-24 — phạm vi theo đoạn của phòng "Ôn phần đọc hôm nay" (design §3.4). */
class PassageScopeTest {

    private static Map<String, Object> seg(String book, Object from, Object to) {
        return Map.of("book", book, "fromChapter", from, "toChapter", to);
    }

    @Test
    void keepsKnownBooks_clampsChapters_dropsTheRest() {
        List<Segment> s = PassageScope.fromRequest(List.of(
                seg("Genesis", 27, 28),
                seg("psalms", 7, 7),          // chữ thường → tên chuẩn
                seg("Obadiah", 1, 9),         // sách 1 chương → 1–1
                seg("Atlantis", 1, 2),        // sách lạ → bỏ
                seg("Genesis", 60, 61),       // ngoài sách (50 chương) → bỏ
                seg("1 Samuel", "3", "4")));  // số dạng chữ vẫn nhận

        assertEquals(List.of(
                new Segment("Genesis", 27, 28),
                new Segment("Psalms", 7, 7),
                new Segment("Obadiah", 1, 1),
                new Segment("1 Samuel", 3, 4)), s);
    }

    @Test
    void reversedRange_isSwapped_andDuplicatesDropped() {
        List<Segment> s = PassageScope.fromRequest(List.of(seg("Genesis", 28, 27), seg("Genesis", 27, 28)));
        assertEquals(List.of(new Segment("Genesis", 27, 28)), s);
    }

    @Test
    void tooManySegments_keepsTheFirstTen() {
        List<Map<String, Object>> many = new ArrayList<>();
        for (int c = 1; c <= 14; c++) many.add(seg("Psalms", c, c));
        List<Segment> s = PassageScope.fromRequest(many);
        assertEquals(PassageScope.MAX_SEGMENTS, s.size());
        assertEquals(new Segment("Psalms", 1, 1), s.get(0));
    }

    @Test
    void notAList_orGarbage_readsAsEmpty() {
        assertTrue(PassageScope.fromRequest(null).isEmpty());
        assertTrue(PassageScope.fromRequest("Genesis:27-28").isEmpty());
        assertTrue(PassageScope.fromRequest(List.of("x", Map.of("book", "Genesis"))).isEmpty());
    }

    @Test
    void jsonRoundTrip_andBadJsonReadsAsEmpty() {
        List<Segment> s = List.of(new Segment("Genesis", 27, 28), new Segment("Psalms", 7, 7));
        String json = PassageScope.toJson(s);
        assertEquals("[{\"book\":\"Genesis\",\"fromChapter\":27,\"toChapter\":28},{\"book\":\"Psalms\",\"fromChapter\":7,\"toChapter\":7}]", json);
        assertEquals(s, PassageScope.fromJson(json));

        assertNull(PassageScope.toJson(List.of()));
        assertTrue(PassageScope.fromJson(null).isEmpty());
        assertTrue(PassageScope.fromJson("not json").isEmpty());
    }
}
