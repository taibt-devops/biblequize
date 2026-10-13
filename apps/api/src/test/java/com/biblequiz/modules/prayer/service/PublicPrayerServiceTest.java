package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.entity.PrayerIntercession;
import com.biblequiz.modules.prayer.entity.PrayerItem;
import com.biblequiz.modules.prayer.entity.PrayerShare;
import com.biblequiz.modules.prayer.entity.Utc;
import com.biblequiz.modules.prayer.repository.PrayerIntercessionRepository;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import com.biblequiz.modules.prayer.repository.PrayerShareRepository;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
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
        when(interRepo.existsByShareTokenAndVisitorIdAndPrayedAtAfter(eq(TOK), eq(V1), any())).thenReturn(false);
        when(interRepo.countVisitorsForItem(A)).thenReturn(5L);

        assertEquals(5L, service.pray(TOK, V1, "Hạnh", NOW));

        verify(interRepo).save(any(PrayerIntercession.class));
        verify(interRepo).existsByShareTokenAndVisitorIdAndPrayedAtAfter(TOK, V1,
                Utc.of(NOW.minus(Duration.ofHours(12))));
    }

    @Test
    void pray_sameVisitorWithin12h_isNotSavedAgain() {
        item("ACTIVE");
        when(interRepo.existsByShareTokenAndVisitorIdAndPrayedAtAfter(eq(TOK), eq(V1), any())).thenReturn(true);
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
}
