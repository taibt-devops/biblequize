package com.biblequiz.modules.quiz.service;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository;
import com.biblequiz.modules.ranked.service.TierDifficultyConfig;
import com.biblequiz.modules.ranked.service.TierDifficultyConfig.DifficultyDistribution;
import com.biblequiz.modules.ranked.service.UserTierService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class SmartQuestionSelector {

    private final QuestionRepository questionRepository;
    private final UserQuestionHistoryRepository historyRepository;
    private final TierDifficultyConfig tierDifficultyConfig;
    private final UserTierService userTierService;

    public SmartQuestionSelector(QuestionRepository questionRepository,
                                 UserQuestionHistoryRepository historyRepository,
                                 TierDifficultyConfig tierDifficultyConfig,
                                 UserTierService userTierService) {
        this.questionRepository = questionRepository;
        this.historyRepository = historyRepository;
        this.tierDifficultyConfig = tierDifficultyConfig;
        this.userTierService = userTierService;
    }

    /**
     * Select questions with tier-based difficulty distribution + smart history.
     * If filter already specifies a difficulty, uses that. Otherwise distributes by tier.
     */
    public List<Question> selectQuestions(String userId, int count, QuestionFilter filter) {
        if (filter.difficulty() != null) {
            // Explicit difficulty → use smart selection with that difficulty only
            return selectWithSmartHistory(userId, count, filter);
        }

        // No explicit difficulty → distribute by tier
        int tierLevel = userTierService.getTierLevel(userId);
        DifficultyDistribution dist = tierDifficultyConfig.getDistribution(tierLevel);

        int easyCount = (int) Math.round(count * dist.easyPercent() / 100.0);
        int mediumCount = (int) Math.round(count * dist.mediumPercent() / 100.0);
        int hardCount = count - easyCount - mediumCount;

        List<Question> questions = new ArrayList<>();
        questions.addAll(selectWithSmartHistory(userId, easyCount,
                new QuestionFilter(filter.book(), "easy", filter.language())));
        questions.addAll(selectWithSmartHistory(userId, mediumCount,
                new QuestionFilter(filter.book(), "medium", filter.language())));
        questions.addAll(selectWithSmartHistory(userId, hardCount,
                new QuestionFilter(filter.book(), "hard", filter.language())));

        // If not enough from per-difficulty, fill from any difficulty
        if (questions.size() < count) {
            int remaining = count - questions.size();
            Set<String> selectedIds = new HashSet<>();
            for (Question q : questions) selectedIds.add(q.getId());

            List<Question> extra = selectWithSmartHistory(userId, remaining,
                    new QuestionFilter(filter.book(), null, filter.language()));
            for (Question q : extra) {
                if (!selectedIds.contains(q.getId())) {
                    questions.add(q);
                    if (questions.size() >= count) break;
                }
            }
        }

        Collections.shuffle(questions);
        return questions;
    }

    /**
     * Get the timer seconds for a user based on their tier.
     */
    public int getTimerSeconds(String userId) {
        int tierLevel = userTierService.getTierLevel(userId);
        return tierDifficultyConfig.getDistribution(tierLevel).timerSeconds();
    }

    /**
     * Smart selection from a single pool (with or without difficulty filter).
     * Prioritizes: unseen → need review → seen long ago → seen recently.
     */
    private List<Question> selectWithSmartHistory(String userId, int count, QuestionFilter filter) {
        if (count <= 0) return List.of();

        Set<String> seenIds = new HashSet<>(historyRepository.findQuestionIdsByUserId(userId));
        Set<String> reviewIds = new HashSet<>(
                historyRepository.findNeedReviewQuestionIds(userId, LocalDateTime.now()));

        List<Question> allQuestions = findByFilter(filter);

        List<Question> neverSeen = new ArrayList<>();
        List<Question> needReview = new ArrayList<>();
        List<Question> seenLongAgo = new ArrayList<>();
        List<Question> seenRecently = new ArrayList<>();

        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

        for (Question q : allQuestions) {
            if (!seenIds.contains(q.getId())) {
                neverSeen.add(q);
            } else if (reviewIds.contains(q.getId())) {
                needReview.add(q);
            } else {
                historyRepository.findByUserIdAndQuestionId(userId, q.getId())
                        .ifPresent(h -> {
                            if (h.getLastSeenAt().isBefore(thirtyDaysAgo)) {
                                seenLongAgo.add(q);
                            } else {
                                seenRecently.add(q);
                            }
                        });
            }
        }

        Collections.shuffle(neverSeen);
        Collections.shuffle(needReview);
        Collections.shuffle(seenLongAgo);
        Collections.shuffle(seenRecently);

        List<Question> selected = new ArrayList<>();

        int newCount = Math.min((int) (count * 0.6), neverSeen.size());
        selected.addAll(neverSeen.subList(0, newCount));

        int revCount = Math.min((int) (count * 0.2), needReview.size());
        selected.addAll(needReview.subList(0, revCount));

        int oldCount = Math.min((int) (count * 0.15), seenLongAgo.size());
        selected.addAll(seenLongAgo.subList(0, oldCount));

        int remaining = count - selected.size();
        if (remaining > 0) {
            List<Question> fallback = new ArrayList<>();
            if (newCount < neverSeen.size())
                fallback.addAll(neverSeen.subList(newCount, neverSeen.size()));
            if (revCount < needReview.size())
                fallback.addAll(needReview.subList(revCount, needReview.size()));
            if (oldCount < seenLongAgo.size())
                fallback.addAll(seenLongAgo.subList(oldCount, seenLongAgo.size()));
            fallback.addAll(seenRecently);

            selected.addAll(fallback.subList(0, Math.min(remaining, fallback.size())));
        }

        return selected;
    }

    private List<Question> findByFilter(QuestionFilter filter) {
        String book = filter.book();
        String language = filter.language() != null ? filter.language() : "vi";
        Question.Difficulty difficulty = (filter.difficulty() != null
                && !filter.difficulty().isEmpty()
                && !"all".equalsIgnoreCase(filter.difficulty()))
                ? Question.Difficulty.valueOf(filter.difficulty().toLowerCase()) : null;

        boolean hasBook = book != null && !book.isEmpty();
        if (hasBook && difficulty != null) {
            return questionRepository.findAllActiveByLanguageAndBookAndDifficulty(language, book, difficulty);
        } else if (hasBook) {
            return questionRepository.findAllActiveByLanguageAndBook(language, book);
        } else if (difficulty != null) {
            return questionRepository.findAllActiveByLanguageAndDifficulty(language, difficulty);
        } else {
            return questionRepository.findAllActiveByLanguage(language);
        }
    }

    /**
     * Select from a pre-built pool of questions with smart history prioritization.
     */
    public List<Question> selectFromPool(String userId, List<Question> pool, int count) {
        if (pool.isEmpty() || count <= 0) return List.of();

        Set<String> seenIds = new HashSet<>(historyRepository.findQuestionIdsByUserId(userId));

        List<Question> unseen = new ArrayList<>();
        List<Question> seen = new ArrayList<>();
        for (Question q : pool) {
            if (!seenIds.contains(q.getId())) unseen.add(q);
            else seen.add(q);
        }

        Collections.shuffle(unseen);
        Collections.shuffle(seen);

        List<Question> result = new ArrayList<>();
        result.addAll(unseen.subList(0, Math.min(count, unseen.size())));
        int remaining = count - result.size();
        if (remaining > 0) {
            result.addAll(seen.subList(0, Math.min(remaining, seen.size())));
        }
        return result;
    }

    public record QuestionFilter(String book, String difficulty, String language) {
        public QuestionFilter(String book, String difficulty) {
            this(book, difficulty, "vi");
        }
    }
}
