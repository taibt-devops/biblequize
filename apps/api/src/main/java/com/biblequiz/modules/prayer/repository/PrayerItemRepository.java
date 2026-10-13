package com.biblequiz.modules.prayer.repository;

import com.biblequiz.modules.prayer.entity.PrayerItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PrayerItemRepository extends JpaRepository<PrayerItem, String> {
    List<PrayerItem> findByUserId(String userId);
}
