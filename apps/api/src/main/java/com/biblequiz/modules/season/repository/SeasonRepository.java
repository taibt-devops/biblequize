package com.biblequiz.modules.season.repository;

import com.biblequiz.modules.season.entity.Season;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SeasonRepository extends JpaRepository<Season, String> {

    Optional<Season> findByIsActiveTrue();

    List<Season> findAllByOrderByStartDateDesc();

    /**
     * Find the season covering {@code date1..date2} (intended use:
     * {@code findFor(today, today)}). Uses {@code findTop...OrderByStartDateDesc}
     * to guarantee at most one row even when multiple Seasons happen to overlap
     * the date — e.g. legacy data from older seeder versions overlapping the
     * new quarter grid. Tie-break by most recent {@code startDate} so freshly
     * seeded rows win over stale legacy rows.
     */
    Optional<Season> findTopByStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(LocalDate date1, LocalDate date2);
}
