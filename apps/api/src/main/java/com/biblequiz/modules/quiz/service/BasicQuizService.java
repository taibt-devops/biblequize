package com.biblequiz.modules.quiz.service;

import com.biblequiz.api.dto.basicquiz.BasicQuizQuestionResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizResultResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizStatusResponse;
import com.biblequiz.api.dto.basicquiz.BasicQuizSubmitRequest;
import com.biblequiz.infrastructure.exception.BusinessLogicException;
import com.biblequiz.infrastructure.exception.ResourceNotFoundException;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.exception.BasicQuizCooldownException;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Bible Basics catechism quiz: a fixed 10-question doctrinal quiz that
 * permanently unlocks Ranked mode when a user passes ≥8/10. Replaces the
 * legacy XP / practice-accuracy Ranked gate.
 *
 * <h3>Constants</h3>
 * <ul>
 *   <li>{@link #TOTAL_QUESTIONS} — exactly 10 questions per language.</li>
 *   <li>{@link #PASS_THRESHOLD} — 8 correct = pass.</li>
 *   <li>{@link #COOLDOWN_SECONDS} — 60s wait between failed attempts.</li>
 * </ul>
 *
 * <h3>State machine on the user</h3>
 * <ul>
 *   <li>Never attempted → first attempt allowed.</li>
 *   <li>Failed attempt → cooldown, then retry.</li>
 *   <li>Passed → permanent. Re-attempts are rejected
 *       ({@link BusinessLogicException}) to avoid re-running scoring on a
 *       user who's already unlocked.</li>
 * </ul>
 */
@Service
public class BasicQuizService {

    private static final Logger log = LoggerFactory.getLogger(BasicQuizService.class);

    public static final String CATEGORY = "bible_basics";
    public static final int TOTAL_QUESTIONS = 10;
    public static final int PASS_THRESHOLD = 8;
    public static final int COOLDOWN_SECONDS = 60;

    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public BasicQuizService(QuestionRepository questionRepository, UserRepository userRepository) {
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    /**
     * Snapshot the user's current quiz state for the HomePage card.
     * Cooldown is computed live from the last-attempt timestamp; we do not
     * persist a "cooldown ends at" timestamp because clock skew is then
     * harder to reason about. Source-of-truth = last_attempt_at + 60s.
     */
    public BasicQuizStatusResponse getStatus(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        boolean passed = Boolean.TRUE.equals(user.getBasicQuizPassed());
        int attemptCount = user.getBasicQuizAttempts() == null ? 0 : user.getBasicQuizAttempts();
        int cooldown = passed ? 0 : computeCooldownSeconds(user.getBasicQuizLastAttemptAt());

        return new BasicQuizStatusResponse(
                passed,
                user.getBasicQuizPassedAt(),
                attemptCount,
                cooldown,
                TOTAL_QUESTIONS,
                PASS_THRESHOLD);
    }

    /**
     * Load the 10 catechism questions for the requested language and return
     * them in shuffled order (every load = different order to discourage
     * memorization-by-position). Never reveals correctAnswer/explanation;
     * those only return after /submit.
     *
     * @throws ResourceNotFoundException when the seed is incomplete (the
     *         seeder failed to insert 10 rows for this language) — this is
     *         a server-side data error, not a user error.
     */
    public List<BasicQuizQuestionResponse> getQuestions(String language) {
        String lang = (language == null || language.isBlank()) ? "vi" : language;
        List<Question> questions = questionRepository.findByCategoryAndLanguageAndIsActiveTrue(CATEGORY, lang);

        if (questions.size() != TOTAL_QUESTIONS) {
            throw new ResourceNotFoundException(
                    "Bible Basics quiz must have exactly " + TOTAL_QUESTIONS
                            + " active questions for language '" + lang
                            + "', found: " + questions.size());
        }

        List<Question> shuffled = new ArrayList<>(questions);
        Collections.shuffle(shuffled);

        List<BasicQuizQuestionResponse> result = new ArrayList<>(TOTAL_QUESTIONS);
        for (Question q : shuffled) {
            result.add(new BasicQuizQuestionResponse(q.getId(), q.getContent(), q.getOptions()));
        }
        return result;
    }

    /**
     * Score the user's submitted answers and update state.
     *
     * <p>Order of operations is deliberate:
     * <ol>
     *   <li>If already passed → reject (no scoring).</li>
     *   <li>If cooldown active → reject (no scoring, no attempt counted).</li>
     *   <li>Score → bump attempts → flip passed-flag if ≥8/10.</li>
     * </ol>
     *
     * <p>We score by re-fetching each submitted question by id (not by
     * trusting the original order returned from /questions) — this is the
     * server-of-truth pattern used elsewhere; client-supplied scoring is
     * not trusted.
     */
    @Transactional
    public BasicQuizResultResponse submitAttempt(String userId, BasicQuizSubmitRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        if (Boolean.TRUE.equals(user.getBasicQuizPassed())) {
            throw new BusinessLogicException("Bible Basics quiz already passed — no need to retake.");
        }

        int cooldown = computeCooldownSeconds(user.getBasicQuizLastAttemptAt());
        if (cooldown > 0) {
            throw new BasicQuizCooldownException(cooldown);
        }

        String lang = (request.getLanguage() == null || request.getLanguage().isBlank())
                ? "vi"
                : request.getLanguage();

        // Pre-load the official set so we can reject submissions that mix
        // languages or include question ids outside the catechism category.
        List<Question> officialSet = questionRepository.findByCategoryAndLanguageAndIsActiveTrue(CATEGORY, lang);
        if (officialSet.size() != TOTAL_QUESTIONS) {
            throw new ResourceNotFoundException(
                    "Bible Basics quiz seed incomplete for language '" + lang + "'");
        }
        Map<String, Question> byId = new HashMap<>(TOTAL_QUESTIONS * 2);
        for (Question q : officialSet) {
            byId.put(q.getId(), q);
        }

        int correctCount = 0;
        List<BasicQuizResultResponse.WrongAnswer> wrongs = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (BasicQuizSubmitRequest.Answer ans : request.getAnswers()) {
            if (ans == null || ans.getQuestionId() == null) {
                throw new BusinessLogicException("Submitted answer is missing questionId.");
            }
            if (!seen.add(ans.getQuestionId())) {
                throw new BusinessLogicException(
                        "Duplicate questionId in submission: " + ans.getQuestionId());
            }
            Question q = byId.get(ans.getQuestionId());
            if (q == null) {
                throw new BusinessLogicException(
                        "Question " + ans.getQuestionId() + " is not part of the Bible Basics quiz "
                                + "for language '" + lang + "'");
            }
            List<Integer> selected = ans.getSelectedOptions() == null
                    ? Collections.emptyList()
                    : ans.getSelectedOptions();
            boolean correct = isAnswerCorrect(q, selected);
            if (correct) {
                correctCount++;
            } else {
                wrongs.add(BasicQuizResultResponse.WrongAnswer.builder()
                        .questionId(q.getId())
                        .content(q.getContent())
                        .options(q.getOptions())
                        .selectedOptions(new ArrayList<>(selected))
                        .correctOptions(new ArrayList<>(q.getCorrectAnswer()))
                        .explanation(q.getExplanation())
                        .build());
            }
        }

        boolean passed = correctCount >= PASS_THRESHOLD;
        LocalDateTime now = LocalDateTime.now();

        int newAttempts = (user.getBasicQuizAttempts() == null ? 0 : user.getBasicQuizAttempts()) + 1;
        user.setBasicQuizAttempts(newAttempts);
        user.setBasicQuizLastAttemptAt(now);
        if (passed) {
            user.setBasicQuizPassed(true);
            user.setBasicQuizPassedAt(now);
        }
        userRepository.save(user);

        log.info("BasicQuiz submit user={} score={}/{} passed={} attempts={}",
                userId, correctCount, TOTAL_QUESTIONS, passed, newAttempts);

        return BasicQuizResultResponse.builder()
                .passed(passed)
                .correctCount(correctCount)
                .totalQuestions(TOTAL_QUESTIONS)
                .threshold(PASS_THRESHOLD)
                .attemptCount(newAttempts)
                .cooldownSeconds(passed ? 0 : COOLDOWN_SECONDS)
                .wrongAnswers(passed ? Collections.emptyList() : wrongs)
                .build();
    }

    // ── helpers ──────────────────────────────────────────────────────

    private int computeCooldownSeconds(LocalDateTime lastAttempt) {
        if (lastAttempt == null) return 0;
        long elapsed = ChronoUnit.SECONDS.between(lastAttempt, LocalDateTime.now());
        if (elapsed >= COOLDOWN_SECONDS) return 0;
        // Round up at least 1s — never report 0 mid-cooldown so the FE
        // doesn't think it can submit.
        return (int) Math.max(1L, COOLDOWN_SECONDS - elapsed);
    }

    /**
     * Compare the user's selected options against the question's correct
     * answer set. Order-independent (a multi-correct question with answer
     * [1,3] accepts [3,1] as correct). Catechism is currently single-choice
     * only but we keep the multi-choice path for robustness.
     */
    private static boolean isAnswerCorrect(Question q, List<Integer> selected) {
        List<Integer> correct = q.getCorrectAnswer();
        if (correct == null || selected == null) return false;
        if (correct.size() != selected.size()) return false;
        return new HashSet<>(correct).equals(new HashSet<>(selected));
    }
}
