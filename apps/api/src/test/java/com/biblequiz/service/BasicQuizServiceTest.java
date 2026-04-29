package com.biblequiz.service;

import com.biblequiz.api.dto.basicquiz.BasicQuizQuestionResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizResultResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizStatusResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizSubmitRequest;
import com.biblequiz.infrastructure.exception.BusinessLogicException;
import com.biblequiz.infrastructure.exception.ResourceNotFoundException;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.exception.BasicQuizCooldownException;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.service.BasicQuizService;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link BasicQuizService}. Mocks the repos and verifies
 * the state-machine: status snapshots, cooldown enforcement, scoring,
 * pass/fail flag transitions, and submission validation.
 */
@ExtendWith(MockitoExtension.class)
class BasicQuizServiceTest {

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private BasicQuizService service;

    private static final String USER_ID = "user-1";
    private static final String LANG = "vi";

    // ── helpers ──────────────────────────────────────────────────────

    private User userWithDefaults() {
        User u = new User();
        u.setId(USER_ID);
        u.setEmail("user1@test.com");
        u.setName("User1");
        u.setBasicQuizPassed(false);
        u.setBasicQuizAttempts(0);
        return u;
    }

    private Question q(int n, int correctIndex) {
        Question q = new Question();
        q.setId("q" + n);
        q.setContent("Câu " + n);
        q.setOptions(Arrays.asList("A", "B", "C", "D"));
        q.setCorrectAnswer(new ArrayList<>(List.of(correctIndex)));
        q.setExplanation("Giải thích " + n);
        return q;
    }

    /** Build the canonical 10-question set with correct index = n%4. */
    private List<Question> tenQuestions() {
        List<Question> list = new ArrayList<>(10);
        for (int i = 0; i < 10; i++) {
            list.add(q(i, i % 4));
        }
        return list;
    }

    /** Build a submission where the first {@code numCorrect} answers match. */
    private BasicQuizSubmitRequest submission(int numCorrect) {
        BasicQuizSubmitRequest req = new BasicQuizSubmitRequest();
        req.setLanguage(LANG);
        List<BasicQuizSubmitRequest.Answer> answers = new ArrayList<>(10);
        for (int i = 0; i < 10; i++) {
            BasicQuizSubmitRequest.Answer a = new BasicQuizSubmitRequest.Answer();
            a.setQuestionId("q" + i);
            // First numCorrect get the right answer; rest get a wrong one.
            int picked = (i < numCorrect) ? (i % 4) : (i % 4 + 1) % 4;
            a.setSelectedOptions(new ArrayList<>(List.of(picked)));
            answers.add(a);
        }
        req.setAnswers(answers);
        return req;
    }

    // ── TC-1: getStatus — fresh user, never attempted ────────────────

    @Test
    void getStatus_freshUser_returnsZeros() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithDefaults()));

        BasicQuizStatusResponse status = service.getStatus(USER_ID);

        assertFalse(status.isPassed());
        assertNull(status.getPassedAt());
        assertEquals(0, status.getAttemptCount());
        assertEquals(0, status.getCooldownRemainingSeconds());
        assertEquals(10, status.getTotalQuestions());
        assertEquals(8, status.getThreshold());
    }

    // ── TC-2: getStatus — cooldown active right after fail ───────────

    @Test
    void getStatus_recentFailedAttempt_returnsCooldown() {
        User u = userWithDefaults();
        u.setBasicQuizAttempts(1);
        u.setBasicQuizLastAttemptAt(LocalDateTime.now().minusSeconds(20));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(u));

        BasicQuizStatusResponse status = service.getStatus(USER_ID);

        assertFalse(status.isPassed());
        assertEquals(1, status.getAttemptCount());
        // 60s cooldown - 20s elapsed = ~40s remaining (allow ±2s for execution time)
        assertTrue(status.getCooldownRemainingSeconds() >= 38
                && status.getCooldownRemainingSeconds() <= 41,
                "cooldownRemaining=" + status.getCooldownRemainingSeconds());
    }

    // ── TC-3: getStatus — passed user has zero cooldown ──────────────

    @Test
    void getStatus_passedUser_zeroCooldown() {
        User u = userWithDefaults();
        u.setBasicQuizPassed(true);
        u.setBasicQuizPassedAt(LocalDateTime.now().minusDays(3));
        // Even with a recent attempt, cooldown is 0 once passed.
        u.setBasicQuizLastAttemptAt(LocalDateTime.now().minusSeconds(5));
        u.setBasicQuizAttempts(2);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(u));

        BasicQuizStatusResponse status = service.getStatus(USER_ID);

        assertTrue(status.isPassed());
        assertNotNull(status.getPassedAt());
        assertEquals(0, status.getCooldownRemainingSeconds());
    }

    // ── TC-4: getQuestions — happy path returns 10 shuffled ──────────

    @Test
    void getQuestions_returns10WithoutAnswers() {
        when(questionRepository.findByCategoryAndLanguageAndIsActiveTrue("bible_basics", LANG))
                .thenReturn(tenQuestions());

        List<BasicQuizQuestionResponse> result = service.getQuestions(LANG);

        assertEquals(10, result.size());
        // Each entry has id + content + options; no correctAnswer/explanation field exists on the DTO.
        for (BasicQuizQuestionResponse r : result) {
            assertNotNull(r.getId());
            assertNotNull(r.getContent());
            assertEquals(4, r.getOptions().size());
        }
    }

    // ── TC-5: getQuestions — incomplete seed throws ──────────────────

    @Test
    void getQuestions_incompleteSeed_throws() {
        when(questionRepository.findByCategoryAndLanguageAndIsActiveTrue("bible_basics", LANG))
                .thenReturn(tenQuestions().subList(0, 7));

        assertThrows(ResourceNotFoundException.class, () -> service.getQuestions(LANG));
    }

    // ── TC-6: submit — pass exactly 8/10 flips passed-flag ───────────

    @Test
    void submit_8outOf10_passes() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithDefaults()));
        when(questionRepository.findByCategoryAndLanguageAndIsActiveTrue("bible_basics", LANG))
                .thenReturn(tenQuestions());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        BasicQuizResultResponse result = service.submitAttempt(USER_ID, submission(8));

        assertTrue(result.isPassed());
        assertEquals(8, result.getCorrectCount());
        assertEquals(10, result.getTotalQuestions());
        assertEquals(8, result.getThreshold());
        assertEquals(1, result.getAttemptCount());
        assertEquals(0, result.getCooldownSeconds());
        assertTrue(result.getWrongAnswers() == null || result.getWrongAnswers().isEmpty());

        ArgumentCaptor<User> userSaved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userSaved.capture());
        assertTrue(userSaved.getValue().getBasicQuizPassed());
        assertNotNull(userSaved.getValue().getBasicQuizPassedAt());
        assertEquals(1, userSaved.getValue().getBasicQuizAttempts());
    }

    // ── TC-7: submit — perfect 10/10 also passes ─────────────────────

    @Test
    void submit_perfectScore_passes() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithDefaults()));
        when(questionRepository.findByCategoryAndLanguageAndIsActiveTrue("bible_basics", LANG))
                .thenReturn(tenQuestions());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        BasicQuizResultResponse result = service.submitAttempt(USER_ID, submission(10));

        assertTrue(result.isPassed());
        assertEquals(10, result.getCorrectCount());
    }

    // ── TC-8: submit — 7/10 fails, returns review entries ────────────

    @Test
    void submit_7outOf10_failsAndReturnsReview() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithDefaults()));
        when(questionRepository.findByCategoryAndLanguageAndIsActiveTrue("bible_basics", LANG))
                .thenReturn(tenQuestions());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        BasicQuizResultResponse result = service.submitAttempt(USER_ID, submission(7));

        assertFalse(result.isPassed());
        assertEquals(7, result.getCorrectCount());
        assertEquals(60, result.getCooldownSeconds());
        assertEquals(3, result.getWrongAnswers().size());
        // Each wrong answer carries explanation + correctOptions for the FE review screen.
        for (BasicQuizResultResponse.WrongAnswer w : result.getWrongAnswers()) {
            assertNotNull(w.getQuestionId());
            assertNotNull(w.getExplanation());
            assertNotNull(w.getCorrectOptions());
            assertNotEquals(w.getCorrectOptions(), w.getSelectedOptions());
        }

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertFalse(Boolean.TRUE.equals(saved.getValue().getBasicQuizPassed()));
        assertNotNull(saved.getValue().getBasicQuizLastAttemptAt());
    }

    // ── TC-9: submit — cooldown active raises BasicQuizCooldownException ──

    @Test
    void submit_duringCooldown_throwsCooldown() {
        User u = userWithDefaults();
        u.setBasicQuizAttempts(1);
        u.setBasicQuizLastAttemptAt(LocalDateTime.now().minusSeconds(10));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(u));

        BasicQuizCooldownException ex = assertThrows(
                BasicQuizCooldownException.class,
                () -> service.submitAttempt(USER_ID, submission(8)));
        assertTrue(ex.getSecondsRemaining() > 0 && ex.getSecondsRemaining() <= 60);
        // No scoring happened: questionRepo not called, attempts NOT bumped.
        verify(questionRepository, never()).findByCategoryAndLanguageAndIsActiveTrue(anyString(), anyString());
        verify(userRepository, never()).save(any());
    }

    // ── TC-10: submit — already passed user is rejected ──────────────

    @Test
    void submit_alreadyPassed_throwsBusinessLogic() {
        User u = userWithDefaults();
        u.setBasicQuizPassed(true);
        u.setBasicQuizPassedAt(LocalDateTime.now().minusDays(1));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(u));

        assertThrows(BusinessLogicException.class,
                () -> service.submitAttempt(USER_ID, submission(10)));
        verify(userRepository, never()).save(any());
    }

    // ── TC-11: submit — questionId outside seed is rejected ──────────

    @Test
    void submit_unknownQuestionId_throwsBusinessLogic() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithDefaults()));
        when(questionRepository.findByCategoryAndLanguageAndIsActiveTrue("bible_basics", LANG))
                .thenReturn(tenQuestions());

        BasicQuizSubmitRequest req = submission(10);
        // Tamper with one questionId so it's outside the seed.
        req.getAnswers().get(0).setQuestionId("not-a-real-id");

        assertThrows(BusinessLogicException.class,
                () -> service.submitAttempt(USER_ID, req));
        verify(userRepository, never()).save(any());
    }
}
