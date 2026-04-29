package com.biblequiz.infrastructure.seed.question;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * DTO mapping a single entry in
 * {@code src/main/resources/seed/questions/*_quiz.json}.
 *
 * <p>Only the fields the seeder consumes are declared; unknown JSON keys
 * are ignored (future-proof for optional metadata like {@code tags} or
 * {@code source}).
 *
 * <h3>Schema contract</h3>
 * <pre>
 * {
 *   "book":        "Genesis",                // required
 *   "chapter":     1,                        // required, integer
 *   "verseStart":  1,                        // required
 *   "verseEnd":    22,                       // optional
 *   "difficulty":  "easy|medium|hard",       // required
 *   "type":        "multiple_choice_single|multiple_choice_multi|true_false|fill_in_blank",
 *   "content":     "...",                    // required — renamed from legacy "text"
 *   "options":     ["A", "B", "C", "D"],     // required except for true_false/fill_in_blank
 *   "correctAnswer": [0],                    // required — list of correct option indices
 *   "explanation": "...",                    // optional but recommended
 *   "language":    "vi" | "en"               // required
 * }
 * </pre>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class SeedQuestion {

    public String book;
    public Integer chapter;
    public Integer verseStart;
    public Integer verseEnd;
    public String difficulty;
    public String type;
    public String content;
    public List<String> options;
    public List<Integer> correctAnswer;
    public String explanation;
    public String correctAnswerText;
    public String language;

    // Optional future fields (not consumed yet but reserved)
    public List<String> tags;
    public String source;

    /**
     * Category tag persisted as Question.category. Currently used by
     * Bible Basics catechism quiz ("bible_basics") to distinguish the
     * 10 doctrinal questions that gate Ranked from regular content.
     * Null/absent ⇒ regular question.
     */
    public String category;
}
