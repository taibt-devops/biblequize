package com.biblequiz.api;

import com.biblequiz.modules.quiz.service.QuestionService;
import com.biblequiz.modules.quiz.service.StoryCatalog;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * The stories Practice can play one at a time ("Theo câu chuyện"). Under
 * {@code /api/public/**} (permitAll) because guests can practise too.
 *
 * <p>Lists every story in canonical order with its active question count in the
 * requested language. A story with no questions in that language stays in the list
 * with {@code questionCount = 0}: the picker hides it, but past sessions still get
 * their story title. Titles and references follow the requested language.
 */
@RestController
@RequestMapping("/api/public/stories")
@RequiredArgsConstructor
public class PublicStoryController {

    private final StoryCatalog storyCatalog;
    private final QuestionService questionService;

    public record StoryView(String id, int order, String title, String ref, String testament,
                            long questionCount) {
    }

    @GetMapping
    public List<StoryView> stories(@RequestParam(value = "language", defaultValue = "vi") String language) {
        Map<String, Long> counts = questionService.countQuestionsByStory(language);
        return storyCatalog.all().stream()
                .map(s -> new StoryView(s.id(), s.order(), s.title(language), s.ref(language), s.testament(),
                        counts.getOrDefault(s.id(), 0L)))
                .toList();
    }
}
