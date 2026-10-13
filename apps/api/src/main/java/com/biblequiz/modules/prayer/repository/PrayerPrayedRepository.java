package com.biblequiz.modules.prayer.repository;

import com.biblequiz.modules.prayer.entity.PrayerPrayed;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface PrayerPrayedRepository extends JpaRepository<PrayerPrayed, String> {
    List<PrayerPrayed> findByUserIdAndPrayedAtAfter(String userId, LocalDateTime after);

    /** Có lần "Đã cầu nguyện" nào từ mốc này (UTC): trang chủ chỉ cần biết có hay không. */
    boolean existsByUserIdAndPrayedAtGreaterThanEqual(String userId, LocalDateTime from);
}
