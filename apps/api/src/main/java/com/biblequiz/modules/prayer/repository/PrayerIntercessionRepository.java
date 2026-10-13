package com.biblequiz.modules.prayer.repository;

import com.biblequiz.modules.prayer.entity.PrayerIntercession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

/** Đếm theo điều (qua mọi link của điều đó, kể cả link đã thu lại), không theo từng link. */
public interface PrayerIntercessionRepository extends JpaRepository<PrayerIntercession, Long> {

    @Query("select count(distinct i.visitorId) from PrayerIntercession i where i.shareToken in "
            + "(select s.token from PrayerShare s where s.itemId = :itemId)")
    long countVisitorsForItem(@Param("itemId") String itemId);

    @Query("select max(i.prayedAt) from PrayerIntercession i where i.shareToken in "
            + "(select s.token from PrayerShare s where s.itemId = :itemId)")
    LocalDateTime lastPrayedForItem(@Param("itemId") String itemId);

    @Query("select i from PrayerIntercession i where i.shareToken in "
            + "(select s.token from PrayerShare s where s.itemId = :itemId) order by i.prayedAt asc")
    List<PrayerIntercession> findForItem(@Param("itemId") String itemId);

    boolean existsByShareTokenAndVisitorIdAndPrayedAtAfter(String shareToken, String visitorId, LocalDateTime after);
}
