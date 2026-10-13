package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.entity.Utc;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PrayerTombstoneSchedulerTest {

    @Test
    void purge_deletesTombstonesOlderThan90Days() {
        PrayerItemRepository repo = mock(PrayerItemRepository.class);
        Instant now = Instant.parse("2026-10-13T03:30:00Z");
        when(repo.deleteTombstonesBefore(any())).thenReturn(4);

        assertEquals(4, new PrayerTombstoneScheduler(repo).purge(now));
        verify(repo).deleteTombstonesBefore(Utc.of(now.minus(90, ChronoUnit.DAYS)));
    }
}
