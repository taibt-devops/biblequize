package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.entity.PrayerItem;
import com.biblequiz.modules.prayer.entity.PrayerPrayed;
import com.biblequiz.modules.prayer.entity.PrayerShare;
import com.biblequiz.modules.prayer.entity.Utc;
import com.biblequiz.modules.prayer.repository.*;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import com.biblequiz.modules.prayer.service.PrayerInput.Prayed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class PrayerServiceTest {

    static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");
    static final Instant NOW = Instant.parse("2026-10-13T03:00:00Z");
    static final String A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    static final String B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    PrayerItemRepository itemRepo;
    PrayerPrayedRepository prayedRepo;
    PrayerShareRepository shareRepo;
    PrayerIntercessionRepository interRepo;
    PrayerService service;

    @BeforeEach
    void setUp() {
        itemRepo = mock(PrayerItemRepository.class);
        prayedRepo = mock(PrayerPrayedRepository.class);
        shareRepo = mock(PrayerShareRepository.class);
        interRepo = mock(PrayerIntercessionRepository.class);
        when(itemRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(prayedRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(shareRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        service = new PrayerService(itemRepo, prayedRepo, shareRepo, interRepo, "https://doc.forbible.org/");
    }

    static Item item(String id, String title, Instant updated) {
        return new Item(id, title, null, "ACTIVE", null, T0, null, updated, null);
    }

    static Item tomb(String id, Instant at) {
        return new Item(id, "", null, "ACTIVE", null, T0, null, at, at);
    }

    @Test
    void putItems_newItem_savedForCaller() {
        when(itemRepo.findByUserId("u1")).thenReturn(List.of());
        when(itemRepo.existsById(A)).thenReturn(false);

        List<Item> out = service.putItems("u1", List.of(item(A, "Ba mẹ", T0)), NOW);

        assertEquals(1, out.size());
        ArgumentCaptor<PrayerItem> saved = ArgumentCaptor.forClass(PrayerItem.class);
        verify(itemRepo).save(saved.capture());
        assertEquals("u1", saved.getValue().getUserId());
        assertEquals("Ba mẹ", saved.getValue().getTitle());
    }

    @Test
    void putItems_newerWins_olderAndEqualKeepServer() {
        Instant t1 = T0.plusSeconds(60);
        PrayerItem server = PrayerItem.of("u1", item(A, "Bản máy chủ", t1), NOW);
        when(itemRepo.findByUserId("u1")).thenReturn(List.of(server));

        service.putItems("u1", List.of(item(A, "Bản cũ hơn", T0), item(A, "Bản bằng giờ", t1)), NOW);
        assertEquals("Bản máy chủ", server.getTitle());
        verify(itemRepo, never()).save(any());

        service.putItems("u1", List.of(item(A, "Bản mới hơn", t1.plusSeconds(1))), NOW);
        assertEquals("Bản mới hơn", server.getTitle());
    }

    @Test
    void putItems_tombstone_blanksTextAndRevokesOpenShares() {
        PrayerItem server = PrayerItem.of("u1", item(A, "Chuyện riêng", T0), NOW);
        PrayerShare open = new PrayerShare("AbCdEfGhIjKlMnOpQr_-12", A, "u1", T0);
        when(itemRepo.findByUserId("u1")).thenReturn(List.of(server));
        when(shareRepo.findByItemIdAndRevokedAtIsNull(A)).thenReturn(List.of(open));

        List<Item> out = service.putItems("u1", List.of(tomb(A, NOW)), NOW);

        assertTrue(server.isDeleted());
        assertEquals("", server.getTitle());
        assertFalse(open.isOpen());
        assertEquals(1, out.size(), "bia mộ mới vẫn trả về để máy khác biết mà xóa");
        assertTrue(out.get(0).deleted());
    }

    @Test
    void putItems_editNewerThanTombstone_restoresItem() {
        PrayerItem server = PrayerItem.of("u1", tomb(A, T0.plusSeconds(10)), NOW);
        when(itemRepo.findByUserId("u1")).thenReturn(List.of(server));

        service.putItems("u1", List.of(item(A, "Sửa trên máy khác", T0.plusSeconds(20))), NOW);

        assertFalse(server.isDeleted());
        assertEquals("Sửa trên máy khác", server.getTitle());
    }

    @Test
    void putItems_idOwnedBySomeoneElse_isSkipped() {
        when(itemRepo.findByUserId("u1")).thenReturn(List.of());
        when(itemRepo.existsById(B)).thenReturn(true);

        List<Item> out = service.putItems("u1", List.of(item(B, "Chiếm id", NOW)), NOW);

        assertTrue(out.isEmpty());
        verify(itemRepo, never()).save(any());
    }

    @Test
    void me_hidesTombstonesOlderThan90Days_andBuildsShareUrl() {
        PrayerItem live = PrayerItem.of("u1", item(A, "Còn", T0), NOW);
        Instant old = NOW.minus(91, ChronoUnit.DAYS);
        PrayerItem oldTomb = PrayerItem.of("u1", new Item(B, "", null, "ACTIVE", null, old, null, old, old), NOW);
        PrayerShare share = new PrayerShare("AbCdEfGhIjKlMnOpQr_-12", A, "u1", T0);
        when(itemRepo.findByUserId("u1")).thenReturn(List.of(live, oldTomb));
        when(prayedRepo.findByUserIdAndPrayedAtAfter(eq("u1"), any())).thenReturn(List.of());
        when(shareRepo.findByUserIdAndRevokedAtIsNull("u1")).thenReturn(List.of(share));
        when(interRepo.countVisitorsForItem(A)).thenReturn(3L);
        when(interRepo.lastPrayedForItem(A)).thenReturn(Utc.of(NOW));

        PrayerService.Me me = service.me("u1", NOW);

        assertEquals(List.of(A), me.items().stream().map(Item::id).toList());
        assertEquals("https://doc.forbible.org/cn/AbCdEfGhIjKlMnOpQr_-12", me.shares().get(0).url());
        assertEquals(3L, me.shares().get(0).count());
        assertEquals(NOW, me.shares().get(0).lastPrayedAt());
        verify(prayedRepo).findByUserIdAndPrayedAtAfter("u1", Utc.of(NOW.minus(400, ChronoUnit.DAYS)));
    }

    @Test
    void addPrayed_skipsDuplicatesForeignAndDeletedItems() {
        PrayerItem live = PrayerItem.of("u1", item(A, "Còn", T0), NOW);
        PrayerItem dead = PrayerItem.of("u1", tomb(B, T0), NOW);
        when(itemRepo.findByUserId("u1")).thenReturn(List.of(live, dead));
        String p1 = "11111111-1111-4111-8111-111111111111";
        String p2 = "22222222-2222-4222-8222-222222222222";
        String p3 = "33333333-3333-4333-8333-333333333333";
        String p4 = "44444444-4444-4444-8444-444444444444";
        when(prayedRepo.existsById(p2)).thenReturn(true);

        int saved = service.addPrayed("u1", List.of(
                new Prayed(p1, A, NOW), new Prayed(p2, A, NOW),
                new Prayed(p3, B, NOW), new Prayed(p4, "99999999-9999-4999-8999-999999999999", NOW)), NOW);

        assertEquals(1, saved);
        ArgumentCaptor<PrayerPrayed> row = ArgumentCaptor.forClass(PrayerPrayed.class);
        verify(prayedRepo).save(row.capture());
        assertEquals(p1, row.getValue().getId());
    }
}
