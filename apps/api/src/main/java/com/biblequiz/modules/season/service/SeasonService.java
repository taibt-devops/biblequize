package com.biblequiz.modules.season.service;

import com.biblequiz.modules.season.entity.Season;
import com.biblequiz.modules.season.entity.SeasonRanking;
import com.biblequiz.modules.season.repository.SeasonRankingRepository;
import com.biblequiz.modules.season.repository.SeasonRepository;
import com.biblequiz.modules.user.entity.User;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

@Service
public class SeasonService {

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private SeasonRankingRepository seasonRankingRepository;

    /**
     * Returns the season covering today's date — date-based lookup per
     * DECISIONS.md 2026-05-01 "4B: compute on-the-fly". 4 liturgical
     * seasons per year don't overlap, so exactly one row matches at any
     * time. Falls back to {@code findByIsActiveTrue()} if no row covers
     * today (e.g. legacy data from older seeder versions).
     */
    public Optional<Season> getActiveSeason() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Optional<Season> byDate = seasonRepository
                .findByStartDateLessThanEqualAndEndDateGreaterThanEqual(today, today);
        if (byDate.isPresent()) {
            return byDate;
        }
        return seasonRepository.findByIsActiveTrue();
    }

    /**
     * Accumulates points and questions for a user in the active season.
     * Called after each ranked answer submission.
     */
    public void addPoints(User user, int pointsEarned, int questionsAnswered) {
        Optional<Season> activeSeason = getActiveSeason();
        if (activeSeason.isEmpty()) return;

        Season season = activeSeason.get();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (today.isBefore(season.getStartDate()) || today.isAfter(season.getEndDate())) return;

        SeasonRanking ranking = seasonRankingRepository
                .findBySeasonIdAndUserId(season.getId(), user.getId())
                .orElseGet(() -> {
                    SeasonRanking sr = new SeasonRanking(UUID.randomUUID().toString(), season, user);
                    sr.setTotalPoints(0);
                    sr.setTotalQuestions(0);
                    return sr;
                });

        ranking.setTotalPoints(ranking.getTotalPoints() + pointsEarned);
        ranking.setTotalQuestions(ranking.getTotalQuestions() + questionsAnswered);
        seasonRankingRepository.save(ranking);
    }
}
