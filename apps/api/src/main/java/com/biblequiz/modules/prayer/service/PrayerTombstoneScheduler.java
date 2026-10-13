package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.entity.Utc;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** 03:30 UTC mỗi ngày xóa hẳn các điều đã xóa quá 90 ngày. Ghi log cả khi 0 để biết việc còn chạy. */
@Component
public class PrayerTombstoneScheduler {

    private static final Logger log = LoggerFactory.getLogger(PrayerTombstoneScheduler.class);

    private final PrayerItemRepository itemRepo;

    public PrayerTombstoneScheduler(PrayerItemRepository itemRepo) {
        this.itemRepo = itemRepo;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
    public void purgeDaily() {
        purge(Instant.now());
    }

    int purge(Instant now) {
        int n = itemRepo.deleteTombstonesBefore(Utc.of(now.minus(PrayerService.TOMBSTONE_DAYS, ChronoUnit.DAYS)));
        log.info("[PRAYER] Xóa hẳn {} điều đã xóa quá {} ngày", n, PrayerService.TOMBSTONE_DAYS);
        return n;
    }
}
