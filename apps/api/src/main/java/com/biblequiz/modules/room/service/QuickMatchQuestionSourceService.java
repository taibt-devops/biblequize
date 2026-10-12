package com.biblequiz.modules.room.service;

import com.biblequiz.infrastructure.bible.BookScopes;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * QP-3 — Question source for Quick Match (Đấu Nhanh) rooms: pre-pick {@code count} active question IDs from
 * the {@code questions} table with optional book filter and a mixed difficulty proportion
 * (30% EASY / 50% MEDIUM / 20% HARD). Caller saves into {@code Room.customQuestionIds} JSON column
 * (V36 contract). Anti-spoiler: pick at create time so client cannot enumerate the upcoming question
 * pool via a list endpoint. AIR-1 (13/10/2026): không còn nguồn câu do AI sinh.
 */
@Service
public class QuickMatchQuestionSourceService {

    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired private QuestionRepository questionRepository;

    /**
     * Pick {@code count} question IDs from the DB with a 30/50/20
     * difficulty mix. {@code book} is optional ({@code null} or "ALL"
     * → no book filter). {@code language} filters vi/en so rooms don't
     * mix the two pools (bug 2026-05-20 — was leaking EN questions into
     * VN rooms because language wasn't passed through).
     */
    public List<String> pickDatabaseIds(String book, int count, String language) {
        int easy = Math.round(count * 0.30f);
        int hard = Math.round(count * 0.20f);
        int medium = count - easy - hard;

        String lang = (language == null || language.isBlank()) ? "vi" : language;
        List<Question> bag = new ArrayList<>();
        bag.addAll(pick(lang, book, Question.Difficulty.easy, easy));
        bag.addAll(pick(lang, book, Question.Difficulty.medium, medium));
        bag.addAll(pick(lang, book, Question.Difficulty.hard, hard));
        Collections.shuffle(bag, RANDOM);

        // Trim if any tier returned more than requested (shouldn't happen
        // with Pageable but be defensive).
        return bag.stream().limit(count).map(Question::getId).toList();
    }

    private List<Question> pick(String language, String book, Question.Difficulty diff, int count) {
        if (count <= 0) return List.of();
        PageRequest pr = PageRequest.of(0, count);
        List<String> excludeNone = List.of("__none__");
        // MBV-3: expand scope (group sentinel / single book) to a book set; empty = no
        // filter. A scoped query that returns nothing falls back to the whole pool.
        List<String> books = BookScopes.expand(book);
        if (!books.isEmpty()) {
            List<Question> scoped = questionRepository
                    .findRandomQuestionsByLanguageAndBooksAndDifficultyExcludingIds(language, books, diff, excludeNone, pr);
            if (!scoped.isEmpty()) return scoped;
        }
        return questionRepository.findRandomQuestionsByLanguageAndDifficultyExcludingIds(language, diff, excludeNone, pr);
    }
}
