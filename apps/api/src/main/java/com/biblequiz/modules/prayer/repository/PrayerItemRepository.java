package com.biblequiz.modules.prayer.repository;

import com.biblequiz.modules.prayer.entity.PrayerItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

public interface PrayerItemRepository extends JpaRepository<PrayerItem, String> {
    List<PrayerItem> findByUserId(String userId);

    boolean existsByUserIdAndDeletedAtIsNull(String userId);

    /** Xóa hẳn bia mộ cũ; prayer_prayed, prayer_shares, prayer_intercessions xóa theo khóa ngoại ON DELETE CASCADE. */
    @Modifying
    @Transactional
    @Query("delete from PrayerItem i where i.deletedAt is not null and i.deletedAt < :cutoff")
    int deleteTombstonesBefore(@Param("cutoff") LocalDateTime cutoff);
}
