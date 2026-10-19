package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.entity.PrayerIntercession;
import com.biblequiz.modules.prayer.entity.PrayerItem;
import com.biblequiz.modules.prayer.entity.PrayerShare;
import com.biblequiz.modules.prayer.entity.Utc;
import com.biblequiz.modules.prayer.repository.PrayerIntercessionRepository;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import com.biblequiz.modules.prayer.repository.PrayerShareRepository;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import com.biblequiz.modules.prayer.service.PrayerInput.Update;
import com.biblequiz.modules.prayer.service.PrayerInput.V2;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class PublicPrayerServiceTest {

    static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");
    static final Instant NOW = Instant.parse("2026-10-13T03:00:00Z");
    static final String A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    static final String TOK = "AbCdEfGhIjKlMnOpQr_-12";
    static final String V1 = "11111111-1111-4111-8111-111111111111";

    PrayerShareRepository shareRepo;
    PrayerItemRepository itemRepo;
    PrayerIntercessionRepository interRepo;
    UserRepository userRepo;
    PublicPrayerService service;
    PrayerShare share;

    @BeforeEach
    void setUp() {
        shareRepo = mock(PrayerShareRepository.class);
        itemRepo = mock(PrayerItemRepository.class);
        interRepo = mock(PrayerIntercessionRepository.class);
        userRepo = mock(UserRepository.class);
        service = new PublicPrayerService(shareRepo, itemRepo, interRepo, userRepo);
        share = new PrayerShare(TOK, A, "u1", T0);
        when(shareRepo.findById(TOK)).thenReturn(Optional.of(share));
        User owner = new User();
        owner.setId("u1");
        owner.setName("Minh An");
        when(userRepo.findById("u1")).thenReturn(Optional.of(owner));
    }

    private void item(String status) {
        Item in = new Item(A, "Ba mẹ được bình an", "Ba đang nằm viện", status,
                "ANSWERED".equals(status) ? "Ba khỏe rồi" : null, T0, null, T0, null);
        when(itemRepo.findById(A)).thenReturn(Optional.of(PrayerItem.of("u1", in, NOW)));
    }

    @Test
    void view_openLink_showsOneItemOwnerNameAndCount() {
        item("ACTIVE");
        when(interRepo.countVisitorsForItem(A)).thenReturn(4L);

        PublicPrayerService.View v = service.view(TOK);

        assertEquals("Minh An", v.ownerName());
        assertEquals("Ba mẹ được bình an", v.title());
        assertEquals("Ba đang nằm viện", v.detail());
        assertEquals("ACTIVE", v.status());
        assertEquals(4L, v.count());
    }

    @Test
    void view_revokedUnknownOrDeleted_allNotFound() {
        item("ACTIVE");
        share.revoke(NOW);
        assertThrows(NoSuchElementException.class, () -> service.view(TOK));
        assertThrows(NoSuchElementException.class, () -> service.view("ZyXwVuTsRqPoNmLkJiHg_-98"));

        PrayerShare open = new PrayerShare("QqQqQqQqQqQqQqQqQqQq_-", A, "u1", T0);
        when(shareRepo.findById(open.getToken())).thenReturn(Optional.of(open));
        Item tomb = new Item(A, "", null, "ACTIVE", null, T0, null, NOW, NOW);
        when(itemRepo.findById(A)).thenReturn(Optional.of(PrayerItem.of("u1", tomb, NOW)));
        assertThrows(NoSuchElementException.class, () -> service.view(open.getToken()));
    }

    @Test
    void pray_newVisitor_savesRow_returnsDistinctCount() {
        item("ACTIVE");
        when(interRepo.findFirstByShareTokenAndVisitorIdAndPrayedAtAfterOrderByPrayedAtDesc(eq(TOK), eq(V1), any()))
                .thenReturn(Optional.empty());
        when(interRepo.countVisitorsForItem(A)).thenReturn(5L);

        assertEquals(5L, service.pray(TOK, V1, "Hạnh", NOW));

        verify(interRepo).save(any(PrayerIntercession.class));
        verify(interRepo).findFirstByShareTokenAndVisitorIdAndPrayedAtAfterOrderByPrayedAtDesc(TOK, V1,
                Utc.of(NOW.minus(Duration.ofHours(12))));
    }

    @Test
    void pray_sameVisitorWithin12h_isNotSavedAgain() {
        item("ACTIVE");
        when(interRepo.findFirstByShareTokenAndVisitorIdAndPrayedAtAfterOrderByPrayedAtDesc(eq(TOK), eq(V1), any()))
                .thenReturn(Optional.of(new PrayerIntercession(TOK, V1, "Hạnh", NOW.minusSeconds(60))));
        when(interRepo.countVisitorsForItem(A)).thenReturn(1L);

        assertEquals(1L, service.pray(TOK, V1, null, NOW));
        verify(interRepo, never()).save(any());
    }

    @Test
    void pray_answered_isConflict_badVisitor_isBadRequest() {
        item("ANSWERED");
        assertThrows(IllegalStateException.class, () -> service.pray(TOK, V1, null, NOW));
        assertThrows(IllegalArgumentException.class, () -> service.pray(TOK, "may-cua-toi", null, NOW));
        verify(interRepo, never()).save(any());
    }

    // ---- Bản 2 (V80) ----

    private static String uuid(int i) {
        return String.format("%08d-0000-4000-8000-%012d", i, i);
    }

    private void itemV2(String status, String testimony, boolean shareTestimony, List<Update> updates) {
        Item in = new Item(A, "Ba mẹ được bình an", "Ba đang nằm viện", status, testimony, T0,
                "ANSWERED".equals(status) ? T0.plusSeconds(99) : null, T0, null,
                new V2(null, "FAMILY", updates, shareTestimony, "ARCHIVED".equals(status) ? T0 : null, null, null));
        when(itemRepo.findById(A)).thenReturn(Optional.of(PrayerItem.of("u1", in, NOW)));
    }

    @Test
    void view_v2_updatesNewestFirstMax5() {
        List<Update> ups = new ArrayList<>();
        for (int i = 0; i < 7; i++) ups.add(new Update(uuid(i), "tin " + i, T0.plusSeconds(i)));
        itemV2("ACTIVE", null, false, ups);

        PublicPrayerService.View v = service.view(TOK);

        assertEquals("FAMILY", v.topic());
        assertEquals(5, v.updates().size());
        assertEquals("tin 6", v.updates().get(0).text());
        assertEquals("tin 2", v.updates().get(4).text());
        assertNull(v.testimony());
        assertNull(v.answeredAt());
    }

    @Test
    void view_testimonyOnlyWhenSharedAndAnswered() {
        itemV2("ANSWERED", "Ba khỏe rồi", false, List.of());
        PublicPrayerService.View hidden = service.view(TOK);
        assertEquals("ANSWERED", hidden.status());
        assertNull(hidden.testimony());
        assertEquals(T0.plusSeconds(99), hidden.answeredAt());

        itemV2("ANSWERED", "Ba khỏe rồi", true, List.of());
        assertEquals("Ba khỏe rồi", service.view(TOK).testimony());
    }

    @Test
    void view_archived_statusArchived() {
        itemV2("ARCHIVED", null, false, List.of());
        assertEquals("ARCHIVED", service.view(TOK).status());
    }

    @Test
    void pray_archived_409() {
        itemV2("ARCHIVED", null, false, List.of());
        assertThrows(IllegalStateException.class, () -> service.pray(TOK, V1, "Hạnh", "Em cầu nguyện", NOW));
        verify(interRepo, never()).save(any());
    }

    @Test
    void pray_recentRow_updatesNameAndMessage() {
        item("ACTIVE");
        PrayerIntercession recent = new PrayerIntercession(TOK, V1, null, NOW.minusSeconds(60));
        when(interRepo.findFirstByShareTokenAndVisitorIdAndPrayedAtAfterOrderByPrayedAtDesc(eq(TOK), eq(V1), any()))
                .thenReturn(Optional.of(recent));
        when(interRepo.countVisitorsForItem(A)).thenReturn(1L);

        assertEquals(1L, service.pray(TOK, V1, "Hạnh", "Em cầu nguyện cho bác mau khỏe", NOW));
        assertEquals("Hạnh", recent.getVisitorName());
        assertEquals("Em cầu nguyện cho bác mau khỏe", recent.getMessage());
        verify(interRepo).save(recent);

        service.pray(TOK, V1, null, null, NOW);
        assertEquals("Hạnh", recent.getVisitorName());
        assertEquals("Em cầu nguyện cho bác mau khỏe", recent.getMessage());
        verify(interRepo, times(1)).save(any());
    }

    @Test
    void pray_newRow_savesMessage() {
        item("ACTIVE");
        when(interRepo.findFirstByShareTokenAndVisitorIdAndPrayedAtAfterOrderByPrayedAtDesc(eq(TOK), eq(V1), any()))
                .thenReturn(Optional.empty());
        when(interRepo.countVisitorsForItem(A)).thenReturn(2L);

        assertEquals(2L, service.pray(TOK, V1, "Hạnh", "Em cầu nguyện", NOW));

        ArgumentCaptor<PrayerIntercession> row = ArgumentCaptor.forClass(PrayerIntercession.class);
        verify(interRepo).save(row.capture());
        assertEquals("Hạnh", row.getValue().getVisitorName());
        assertEquals("Em cầu nguyện", row.getValue().getMessage());
    }
}
