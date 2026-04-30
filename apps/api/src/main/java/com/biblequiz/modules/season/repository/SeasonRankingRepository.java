package com.biblequiz.modules.season.repository;

import com.biblequiz.modules.season.entity.SeasonRanking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SeasonRankingRepository extends JpaRepository<SeasonRanking, String> {

    Optional<SeasonRanking> findBySeasonIdAndUserId(String seasonId, String userId);

    @Query(value = "SELECT sr.id, u.id AS userId, u.name, u.avatar_url AS avatarUrl, "
            + "sr.total_points AS points, sr.total_questions AS questions "
            + "FROM season_rankings sr JOIN users u ON sr.user_id = u.id "
            + "WHERE sr.season_id = :seasonId "
            + "ORDER BY sr.total_points DESC, u.id ASC "
            + "LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<Object[]> findSeasonLeaderboard(@Param("seasonId") String seasonId,
            @Param("limit") int limit, @Param("offset") int offset);

    @Query("SELECT COUNT(sr) FROM SeasonRanking sr WHERE sr.season.id = :seasonId AND sr.totalPoints > :points")
    long countUsersAheadInSeason(@Param("seasonId") String seasonId, @Param("points") int points);

    /**
     * Returns the total_points value of the user at a given 1-based rank in
     * the active season's leaderboard (e.g. rank=50 returns the 50th-highest
     * total). Empty when fewer than {@code rank} users have a SeasonRanking
     * row.
     *
     * <p>Tie-breaker matches {@link #findSeasonLeaderboard} (id ASC after
     * points DESC) so the value is deterministic.
     *
     * <p>Caller passes {@code rank - 1} as the offset parameter (LIMIT 1
     * OFFSET N is the canonical "Nth row" SQL idiom).
     */
    @Query(value = "SELECT total_points FROM season_rankings "
            + "WHERE season_id = :seasonId "
            + "ORDER BY total_points DESC, id ASC "
            + "LIMIT 1 OFFSET :offset", nativeQuery = true)
    Optional<Integer> findScoreAtRankOffset(@Param("seasonId") String seasonId,
            @Param("offset") int offset);
}
