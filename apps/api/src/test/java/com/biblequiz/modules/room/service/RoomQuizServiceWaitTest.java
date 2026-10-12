package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.repository.RoomAnswerRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Targets {@link RoomQuizService#waitForRoundEnd(String, long, int)} —
 * the early-end polling helper that lets a round finish as soon as
 * every player has submitted, instead of blocking the full timer.
 *
 * <p>Avoids the heavy Spring + Hibernate wiring of the rest of
 * RoomQuizService by injecting only the field this method touches.
 */
@ExtendWith(MockitoExtension.class)
class RoomQuizServiceWaitTest {

    @Mock private RoomAnswerRepository answerRepo;

    private RoomQuizService newService() {
        RoomQuizService svc = new RoomQuizService();
        ReflectionTestUtils.setField(svc, "roomAnswerRepository", answerRepo);
        return svc;
    }

    @Test
    void returnsEarlyOnceExpectedSubmitted() throws Exception {
        when(answerRepo.countByRoundIdAndGhostFalse("r1")).thenReturn(3L);
        long start = System.currentTimeMillis();

        newService().waitForRoundEnd("r1", 5_000, 3);

        long elapsed = System.currentTimeMillis() - start;
        // Should be well under the 5s timeout — first poll satisfies.
        assertTrue(elapsed < 1_000, "expected early-return < 1s, was " + elapsed + "ms");
    }

    @Test
    void waitsUntilDeadlineWhenAnswersNeverComplete() throws Exception {
        when(answerRepo.countByRoundIdAndGhostFalse("r1")).thenReturn(1L); // 1 of 3, never grows
        long start = System.currentTimeMillis();

        newService().waitForRoundEnd("r1", 600, 3);

        long elapsed = System.currentTimeMillis() - start;
        // Should hit the timeout deadline (~600ms) ± a poll interval.
        assertTrue(elapsed >= 550 && elapsed < 1_000,
                "expected ~600ms timeout, was " + elapsed + "ms");
    }

    @Test
    void zeroExpectedAnswersFallsBackToFullSleep() throws Exception {
        long start = System.currentTimeMillis();

        newService().waitForRoundEnd("r1", 300, 0);

        long elapsed = System.currentTimeMillis() - start;
        assertTrue(elapsed >= 290, "expected at least 300ms full sleep, was " + elapsed + "ms");
    }
}
