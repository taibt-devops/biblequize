package com.biblequiz.modules.quiz.service;

import com.biblequiz.infrastructure.service.CacheService;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

@Service
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final CacheService cacheService;
    private final Random random;

    public QuestionService(QuestionRepository questionRepository, CacheService cacheService) {
        this.questionRepository = questionRepository;
        this.cacheService = cacheService;
        this.random = new Random();
    }

    /**
     * Backward-compatible overload — defaults to language "vi".
     */
    public List<Question> getRandomQuestions(String book, String difficultyStr, int limit, List<String> excludeIds) {
        return getRandomQuestions(book, difficultyStr, "vi", limit, excludeIds);
    }

    public List<Question> getRandomQuestions(String book, String difficultyStr, String language, int limit, List<String> excludeIds) {
        return getRandomQuestions(book, difficultyStr, language, null, null, null, null, limit, excludeIds);
    }

    /**
     * Practice-screen overload: supports optional chapter/verse range.
     * When any range param is non-null, uses unified filter query (cache disabled).
     */
    public List<Question> getRandomQuestions(String book, String difficultyStr, String language,
                                             Integer chapterFrom, Integer chapterTo,
                                             Integer verseFrom, Integer verseTo,
                                             int limit, List<String> excludeIds) {
        String lang = (language != null && !language.isBlank()) ? language : "vi";
        boolean hasRangeFilter = chapterFrom != null || chapterTo != null || verseFrom != null || verseTo != null;

        // Check cache first (keyed by book+difficulty+language) — skip when range filter present
        if (hasRangeFilter) {
            return getRandomQuestionsWithRange(book, difficultyStr, lang,
                    chapterFrom, chapterTo, verseFrom, verseTo, limit, excludeIds);
        }
        String cacheKey = book + ":" + difficultyStr + ":" + lang;
        if (excludeIds == null || excludeIds.isEmpty()) {
            Optional<List<Question>> cached = cacheService.getCachedQuestionList(book, difficultyStr);
            if (cached.isPresent()) {
                List<Question> cachedList = new ArrayList<>(cached.get());
                // Filter by language in case cache has mixed
                cachedList.removeIf(q -> !lang.equals(q.getLanguage()));
                if (!cachedList.isEmpty()) {
                    Collections.shuffle(cachedList, random);
                    return cachedList.size() <= limit ? cachedList : cachedList.subList(0, limit);
                }
            }
        }

        Question.Difficulty difficulty = null;
        if (difficultyStr != null && !difficultyStr.isEmpty() && !"all".equalsIgnoreCase(difficultyStr)) {
            try {
                difficulty = Question.Difficulty.valueOf(difficultyStr);
            } catch (IllegalArgumentException ignored) {
            }
        }

        if (limit <= 0) {
            return Collections.emptyList();
        }

        // Compute total count based on filters + language
        long total;
        boolean hasBook = book != null && !book.isEmpty();
        if (hasBook && difficulty != null) {
            total = questionRepository.countByBookAndDifficultyAndLanguageAndIsActiveTrue(book, difficulty, lang);
        } else if (hasBook) {
            total = questionRepository.countByBookAndLanguageAndIsActiveTrue(book, lang);
        } else if (difficulty != null) {
            total = questionRepository.countByDifficultyAndLanguageAndIsActiveTrue(difficulty, lang);
        } else {
            total = questionRepository.countByLanguageAndIsActiveTrue(lang);
        }

        if (total == 0) {
            return Collections.emptyList();
        }

        // Choose a random page and collect results until we reach limit
        int pageSize = Math.min(Math.max(limit, 10), 50);
        int totalPages = (int) Math.max(1, Math.ceil(total / (double) pageSize));
        int startPage = random.nextInt(totalPages);

        List<Question> result = new ArrayList<>(limit);
        Set<String> excludeSet = excludeIds != null ? new HashSet<>(excludeIds) : new HashSet<>();
        int pageIndex = startPage;
        int attempts = 0;
        int maxAttempts = totalPages * 2;

        while (result.size() < limit && attempts < maxAttempts) {
            Page<Question> page;
            if (hasBook && difficulty != null) {
                page = questionRepository.findByLanguageAndBookAndDifficultyAndIsActiveTrue(lang, book, difficulty,
                        PageRequest.of(pageIndex, pageSize));
            } else if (hasBook) {
                page = questionRepository.findByLanguageAndBookAndIsActiveTrue(lang, book, PageRequest.of(pageIndex, pageSize));
            } else if (difficulty != null) {
                page = questionRepository.findByLanguageAndDifficultyAndIsActiveTrue(lang, difficulty,
                        PageRequest.of(pageIndex, pageSize));
            } else {
                page = questionRepository.findByLanguageAndIsActiveTrue(lang, PageRequest.of(pageIndex, pageSize));
            }

            for (Question q : page.getContent()) {
                if (result.size() >= limit) break;
                if (excludeSet.contains(q.getId())) continue;
                result.add(q);
                excludeSet.add(q.getId());
            }

            if (totalPages <= 1) break;
            pageIndex = (pageIndex + 1) % totalPages;
            attempts++;
            if (pageIndex == startPage) break;
        }

        Collections.shuffle(result, random);
        if (result.size() > limit) {
            result = new ArrayList<>(result.subList(0, limit));
        }

        if (excludeIds == null || excludeIds.isEmpty()) {
            cacheService.cacheQuestions(book, difficultyStr, result);
        }

        return result;
    }

    private List<Question> getRandomQuestionsWithRange(String book, String difficultyStr, String lang,
                                                       Integer chapterFrom, Integer chapterTo,
                                                       Integer verseFrom, Integer verseTo,
                                                       int limit, List<String> excludeIds) {
        if (limit <= 0) {
            return Collections.emptyList();
        }

        Question.Difficulty difficulty = parseDifficulty(difficultyStr);
        String bookFilter = (book != null && !book.isEmpty()) ? book : null;

        long total = questionRepository.countForPracticeFiltered(lang, bookFilter, difficulty,
                chapterFrom, chapterTo, verseFrom, verseTo);
        if (total == 0) {
            return Collections.emptyList();
        }

        int pageSize = Math.min(Math.max(limit, 10), 50);
        int totalPages = (int) Math.max(1, Math.ceil(total / (double) pageSize));
        int startPage = random.nextInt(totalPages);

        List<Question> result = new ArrayList<>(limit);
        Set<String> excludeSet = excludeIds != null ? new HashSet<>(excludeIds) : new HashSet<>();
        int pageIndex = startPage;
        int attempts = 0;
        int maxAttempts = totalPages * 2;

        while (result.size() < limit && attempts < maxAttempts) {
            Page<Question> page = questionRepository.findForPracticeFiltered(lang, bookFilter, difficulty,
                    chapterFrom, chapterTo, verseFrom, verseTo, PageRequest.of(pageIndex, pageSize));
            for (Question q : page.getContent()) {
                if (result.size() >= limit) break;
                if (excludeSet.contains(q.getId())) continue;
                result.add(q);
                excludeSet.add(q.getId());
            }
            if (totalPages <= 1) break;
            pageIndex = (pageIndex + 1) % totalPages;
            attempts++;
            if (pageIndex == startPage) break;
        }

        Collections.shuffle(result, random);
        if (result.size() > limit) {
            result = new ArrayList<>(result.subList(0, limit));
        }
        return result;
    }

    /**
     * Every active question of one story (V73), shuffled. Practice "Theo câu chuyện"
     * plays the whole story, so {@code limit} only caps the size of the response.
     */
    public List<Question> getStoryQuestions(String story, String language, int limit) {
        if (story == null || story.isBlank() || limit <= 0) {
            return Collections.emptyList();
        }
        String lang = (language != null && !language.isBlank()) ? language : "vi";
        List<Question> result = new ArrayList<>(
                questionRepository.findByStoryAndLanguageAndIsActiveTrue(story, lang));
        Collections.shuffle(result, random);
        return result.size() > limit ? new ArrayList<>(result.subList(0, limit)) : result;
    }

    /** Active question count per story for one language; stories without questions are absent. */
    public Map<String, Long> countQuestionsByStory(String language) {
        String lang = (language != null && !language.isBlank()) ? language : "vi";
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : questionRepository.countActiveByStory(lang)) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] instanceof Number n) {
                counts.put(row[0].toString(), n.longValue());
            }
        }
        return counts;
    }

    private Question.Difficulty parseDifficulty(String difficultyStr) {
        if (difficultyStr == null || difficultyStr.isEmpty() || "all".equalsIgnoreCase(difficultyStr)) {
            return null;
        }
        try {
            return Question.Difficulty.valueOf(difficultyStr);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    public Question getQuestionOfTheDay(String language) {
        String lang = (language != null && !language.isBlank()) ? language : "vi";
        // Check cache first
        Optional<Question> cached = cacheService.getCachedQuestionOfTheDay(lang, Question.class);
        if (cached.isPresent()) {
            return cached.get();
        }

        long total = questionRepository.countByLanguageAndIsActiveTrue(lang);
        if (total == 0)
            return null;
        // Deterministic daily index based on date + language
        long seed = Long.parseLong(java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE));
        seed = seed * 31 + lang.hashCode();
        Random seeded = new Random(seed);
        int index = seeded.nextInt((int) Math.min(Integer.MAX_VALUE, total));
        Page<Question> page = questionRepository.findByLanguageAndIsActiveTrue(lang, PageRequest.of(index, 1));
        if (page.isEmpty()) {
            return questionRepository.findByLanguageAndIsActiveTrue(lang, PageRequest.of(0, 1)).stream().findFirst().orElse(null);
        }

        Question question = page.getContent().get(0);
        cacheService.cacheQuestionOfTheDay(lang, question);
        return question;
    }

}
