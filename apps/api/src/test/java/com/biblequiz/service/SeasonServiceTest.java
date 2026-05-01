package com.biblequiz.service;

import com.biblequiz.modules.season.entity.Season;
import com.biblequiz.modules.season.entity.SeasonRanking;
import com.biblequiz.modules.season.repository.SeasonRankingRepository;
import com.biblequiz.modules.season.repository.SeasonRepository;
import com.biblequiz.modules.season.service.SeasonService;
import com.biblequiz.modules.user.entity.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SeasonServiceTest {

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private SeasonRankingRepository seasonRankingRepository;

    @InjectMocks
    private SeasonService seasonService;

    private User testUser;
    private Season activeSeason;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("user-1");
        testUser.setName("Test User");

        activeSeason = new Season();
        activeSeason.setId("season-1");
        activeSeason.setName("Season 1");
        activeSeason.setStartDate(LocalDate.now().minusDays(10));
        activeSeason.setEndDate(LocalDate.now().plusDays(20));
        activeSeason.setIsActive(true);
    }

    @Test
    void getActiveSeason_byDate_shouldReturnSeasonCoveringToday() {
        // Date-based lookup — primary path per LB-2 / DECISIONS 2026-05-01 4B
        when(seasonRepository.findByStartDateLessThanEqualAndEndDateGreaterThanEqual(any(), any()))
                .thenReturn(Optional.of(activeSeason));

        Optional<Season> result = seasonService.getActiveSeason();

        assertTrue(result.isPresent());
        assertEquals("Season 1", result.get().getName());
        // Fallback should NOT be invoked when date lookup hits
        verify(seasonRepository, never()).findByIsActiveTrue();
    }

    @Test
    void getActiveSeason_dateLookupEmpty_fallsBackToIsActiveTrue() {
        when(seasonRepository.findByStartDateLessThanEqualAndEndDateGreaterThanEqual(any(), any()))
                .thenReturn(Optional.empty());
        when(seasonRepository.findByIsActiveTrue()).thenReturn(Optional.of(activeSeason));

        Optional<Season> result = seasonService.getActiveSeason();

        assertTrue(result.isPresent());
        assertEquals("Season 1", result.get().getName());
    }

    @Test
    void getActiveSeason_whenNone_shouldReturnEmpty() {
        when(seasonRepository.findByStartDateLessThanEqualAndEndDateGreaterThanEqual(any(), any()))
                .thenReturn(Optional.empty());
        when(seasonRepository.findByIsActiveTrue()).thenReturn(Optional.empty());

        assertTrue(seasonService.getActiveSeason().isEmpty());
    }

    @Test
    void addPoints_withActiveSeason_shouldAccumulatePoints() {
        when(seasonRepository.findByIsActiveTrue()).thenReturn(Optional.of(activeSeason));

        SeasonRanking existing = new SeasonRanking("sr-1", activeSeason, testUser);
        existing.setTotalPoints(100);
        existing.setTotalQuestions(5);

        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.of(existing));

        seasonService.addPoints(testUser, 50, 3);

        verify(seasonRankingRepository).save(argThat(ranking ->
                ranking.getTotalPoints() == 150 && ranking.getTotalQuestions() == 8));
    }

    @Test
    void addPoints_newUser_shouldCreateRanking() {
        when(seasonRepository.findByIsActiveTrue()).thenReturn(Optional.of(activeSeason));
        when(seasonRankingRepository.findBySeasonIdAndUserId("season-1", "user-1"))
                .thenReturn(Optional.empty());

        seasonService.addPoints(testUser, 50, 3);

        verify(seasonRankingRepository).save(argThat(ranking ->
                ranking.getTotalPoints() == 50 && ranking.getTotalQuestions() == 3));
    }

    @Test
    void addPoints_noActiveSeason_shouldDoNothing() {
        when(seasonRepository.findByIsActiveTrue()).thenReturn(Optional.empty());

        seasonService.addPoints(testUser, 50, 3);

        verify(seasonRankingRepository, never()).save(any());
    }

    @Test
    void addPoints_outsideSeasonDates_shouldDoNothing() {
        activeSeason.setStartDate(LocalDate.now().plusDays(1)); // Starts tomorrow
        when(seasonRepository.findByIsActiveTrue()).thenReturn(Optional.of(activeSeason));

        seasonService.addPoints(testUser, 50, 3);

        verify(seasonRankingRepository, never()).save(any());
    }
}
