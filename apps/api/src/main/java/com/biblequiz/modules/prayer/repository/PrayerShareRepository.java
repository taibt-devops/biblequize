package com.biblequiz.modules.prayer.repository;

import com.biblequiz.modules.prayer.entity.PrayerShare;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PrayerShareRepository extends JpaRepository<PrayerShare, String> {
    Optional<PrayerShare> findFirstByItemIdAndRevokedAtIsNull(String itemId);
    List<PrayerShare> findByItemIdAndRevokedAtIsNull(String itemId);
    List<PrayerShare> findByUserIdAndRevokedAtIsNull(String userId);
    long countByUserIdAndRevokedAtIsNull(String userId);
}
