package com.biblequiz.modules.user.repository;

import com.biblequiz.modules.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    /** PCV-20: các tài khoản người máy (bot-01..06). */
    List<User> findByIsBotTrueOrderByIdAsc();

    @Query("SELECT u FROM User u JOIN u.authIdentities ai WHERE ai.provider = :provider AND ai.providerUserId = :providerUserId")
    Optional<User> findByProviderAndProviderUserId(@Param("provider") String provider, @Param("providerUserId") String providerUserId);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.currentStreak > 0 AND (u.lastPlayedAt IS NULL OR u.lastPlayedAt < :since)")
    List<User> findUsersWithStreakAtRisk(@Param("since") LocalDateTime since);

    long countByLastPlayedAtAfter(LocalDateTime since);

    // ── Early Ranked Unlock metrics (admin) ────────────────────────────
    // See AdminDashboardController.getEarlyUnlockMetrics. The timestamp
    // earlyRankedUnlockedAt is set exactly once — the first time the
    // 80%/10Q policy flips the flag — so counts over this field represent
    // distinct unlock events, not flag flips.

    long countByEarlyRankedUnlockTrue();

    long countByEarlyRankedUnlockedAtAfter(LocalDateTime since);

    /**
     * Average practice accuracy (as a percentage 0–100) across users who
     * have earned the early unlock. Returns {@code null} when no
     * unlockers exist yet (JPA AVG over empty set).
     *
     * <p>Filters out rows with {@code practiceTotalCount <= 0} defensively,
     * though the policy guarantees total ≥ 10 before the flag flips.
     */
    @Query("SELECT AVG((u.practiceCorrectCount * 100.0) / u.practiceTotalCount) " +
           "FROM User u WHERE u.earlyRankedUnlock = true AND u.practiceTotalCount > 0")
    Double findAverageAccuracyPctAtUnlock();

    /**
     * Per-day unlock counts since {@code since}. Each row: {@code [LocalDate, Long]}.
     * Callers fill gaps (days with zero unlocks) client-side since SQL
     * generate_series varies across dialects.
     */
    @Query("SELECT FUNCTION('DATE', u.earlyRankedUnlockedAt) AS day, COUNT(u) " +
           "FROM User u WHERE u.earlyRankedUnlockedAt IS NOT NULL " +
           "AND u.earlyRankedUnlockedAt >= :since " +
           "GROUP BY FUNCTION('DATE', u.earlyRankedUnlockedAt) " +
           "ORDER BY day ASC")
    List<Object[]> findEarlyUnlockDailyCountsSince(@Param("since") LocalDateTime since);
}
