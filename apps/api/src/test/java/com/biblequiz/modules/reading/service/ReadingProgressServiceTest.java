package com.biblequiz.modules.reading.service;

import com.biblequiz.modules.reading.entity.ReadingLog;
import com.biblequiz.modules.reading.entity.ReadingProgress;
import com.biblequiz.modules.reading.repository.ReadingLogRepository;
import com.biblequiz.modules.reading.repository.ReadingProgressRepository;
import com.biblequiz.modules.reading.service.ReadingProgressService.Progress;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ReadingProgressServiceTest {

    private static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");
    private static final Instant NOW = Instant.parse("2026-10-11T03:04:05.678Z");

    private ReadingProgressRepository progressRepo;
    private ReadingLogRepository logRepo;
    private ReadingProgressService service;

    @BeforeEach
    void setUp() {
        progressRepo = mock(ReadingProgressRepository.class);
        logRepo = mock(ReadingLogRepository.class);
        when(progressRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        service = new ReadingProgressService(progressRepo, logRepo);
    }

    private static Progress p(String plan, int next, int lap) {
        return new Progress(plan, next, lap, T0, null, T0);
    }

    @Test
    void put_firstTime_storesAndLogs() {
        when(progressRepo.findById("u1")).thenReturn(Optional.empty());

        Progress saved = service.put("u1", p("1-nam", 12, 0), NOW);

        assertEquals(12, saved.next());
        ArgumentCaptor<ReadingProgress> row = ArgumentCaptor.forClass(ReadingProgress.class);
        verify(progressRepo).save(row.capture());
        assertEquals("1-nam", row.getValue().getPlanId());
        ArgumentCaptor<ReadingLog> log = ArgumentCaptor.forClass(ReadingLog.class);
        verify(logRepo).save(log.capture());
        assertEquals(12, log.getValue().getNextPortion());
    }

    @Test
    void put_sameProgress_doesNotLogAgain() {
        ReadingProgress existing = ReadingProgress.of("u1", p("1-nam", 12, 0), NOW);
        when(progressRepo.findById("u1")).thenReturn(Optional.of(existing));

        service.put("u1", new Progress("1-nam", 12, 0, T0, NOW, NOW), NOW);

        verify(logRepo, never()).save(any());
    }

    @Test
    void put_rejectsOutOfRange() {
        assertThrows(IllegalArgumentException.class, () -> service.put("u1", p("3-nam", 1, 0), NOW));
        assertThrows(IllegalArgumentException.class, () -> service.put("u1", p("1-nam", 0, 0), NOW));
        assertThrows(IllegalArgumentException.class, () -> service.put("u1", p("1-nam", 367, 0), NOW));
        assertDoesNotThrow(() -> service.put("u1", p("1-nam", 366, 0), NOW));
        assertDoesNotThrow(() -> service.put("u1", p("2-nam", 731, 0), NOW));
        assertThrows(IllegalArgumentException.class, () -> service.put("u1", p("1-nam", 1, -1), NOW));
        assertThrows(IllegalArgumentException.class, () -> service.put("u1", p("1-nam", 1, 1001), NOW));
    }

    @Test
    void get_roundTripsInstants() {
        Instant read = Instant.parse("2026-10-10T22:00:00.123Z");
        when(progressRepo.findById("u1")).thenReturn(Optional.of(
                ReadingProgress.of("u1", new Progress("2-nam", 5, 1, T0, read, read), NOW)));

        Progress got = service.get("u1").orElseThrow();

        assertEquals(read, got.lastReadAt());
        assertEquals("2026-10-10T22:00:00.123Z", ReadingProgressService.iso(got.lastReadAt()));
        assertEquals("2026-10-01T00:00:00.000Z", ReadingProgressService.iso(got.startedAt()));
    }

    @Test
    void parse_readsBrowserIsoStrings_andRejectsJunk() {
        Map<String, Object> body = new HashMap<>(Map.of("plan", "1-nam", "next", 3, "lap", 0,
                "startedAt", "2026-10-01T00:00:00.000Z", "updatedAt", "2026-10-02T00:00:00.000Z"));
        body.put("lastReadAt", null);
        Progress parsed = ReadingProgressService.parse(body);
        assertEquals(3, parsed.next());
        assertNull(parsed.lastReadAt());

        body.put("startedAt", "hôm qua");
        assertThrows(IllegalArgumentException.class, () -> ReadingProgressService.parse(body));
        assertThrows(IllegalArgumentException.class, () -> ReadingProgressService.parse(Map.of("plan", "1-nam")));
    }
}
