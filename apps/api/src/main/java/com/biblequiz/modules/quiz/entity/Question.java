package com.biblequiz.modules.quiz.entity;

import com.biblequiz.shared.converter.JsonListConverter;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "questions")
public class Question {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 100)
    private String book;

    private Integer chapter;

    @Column(name = "verse_start")
    private Integer verseStart;

    @Column(name = "verse_end")
    private Integer verseEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Difficulty difficulty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "JSON")
    @Convert(converter = JsonListConverter.class)
    private List<String> options;

    @Column(name = "correct_answer", nullable = false, columnDefinition = "JSON")
    @Convert(converter = JsonListConverter.class)
    private List<Integer> correctAnswer;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    /**
     * FIX #4: Expected free-text answer for fill_in_blank questions.
     * Keep this separate from 'explanation' which is shown after the quiz.
     */
    @Column(name = "correct_answer_text", columnDefinition = "TEXT")
    private String correctAnswerText;

    @Column(columnDefinition = "JSON")
    private String tags;

    private String source;

    // 'bible_basics' marks the 10-question catechism that gates Ranked mode.
    // NULL = regular question. Indexed (idx_questions_category, V31).
    @Column(length = 50)
    private String category;

    @Column(nullable = false, length = 10)
    private String language = "vi";

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", nullable = false)
    private ReviewStatus reviewStatus = ReviewStatus.ACTIVE;

    @Column(name = "approvals_count", nullable = false)
    private Integer approvalsCount = 0;

    public enum ReviewStatus {
        PENDING, ACTIVE, REJECTED
    }

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Difficulty {
        easy, medium, hard
    }

    public enum Type {
        multiple_choice_single, multiple_choice_multi, true_false, fill_in_blank
    }

    // Constructors
    public Question() {
    }

    public Question(String id, String book, Integer chapter, Integer verseStart, Integer verseEnd,
            Difficulty difficulty, Type type, String content, List<String> options,
            List<Integer> correctAnswer, String explanation, String tags, String source,
            String language) {
        this.id = id;
        this.book = book;
        this.chapter = chapter;
        this.verseStart = verseStart;
        this.verseEnd = verseEnd;
        this.difficulty = difficulty;
        this.type = type;
        this.content = content;
        this.options = options;
        this.correctAnswer = correctAnswer;
        this.explanation = explanation;
        this.tags = tags;
        this.source = source;
        this.language = language;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getBook() {
        return book;
    }

    public void setBook(String book) {
        this.book = book;
    }

    public Integer getChapter() {
        return chapter;
    }

    public void setChapter(Integer chapter) {
        this.chapter = chapter;
    }

    public Integer getVerseStart() {
        return verseStart;
    }

    public void setVerseStart(Integer verseStart) {
        this.verseStart = verseStart;
    }

    public Integer getVerseEnd() {
        return verseEnd;
    }

    public void setVerseEnd(Integer verseEnd) {
        this.verseEnd = verseEnd;
    }

    public Difficulty getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(Difficulty difficulty) {
        this.difficulty = difficulty;
    }

    public Type getType() {
        return type;
    }

    public void setType(Type type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }

    public List<Integer> getCorrectAnswer() {
        return correctAnswer;
    }

    public void setCorrectAnswer(List<Integer> correctAnswer) {
        this.correctAnswer = correctAnswer;
    }

    public String getExplanation() {
        return explanation;
    }

    public void setExplanation(String explanation) {
        this.explanation = explanation;
    }

    public String getCorrectAnswerText() {
        return correctAnswerText;
    }

    public void setCorrectAnswerText(String correctAnswerText) {
        this.correctAnswerText = correctAnswerText;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public ReviewStatus getReviewStatus() {
        return reviewStatus;
    }

    public void setReviewStatus(ReviewStatus reviewStatus) {
        this.reviewStatus = reviewStatus;
    }

    public Integer getApprovalsCount() {
        return approvalsCount;
    }

    public void setApprovalsCount(Integer approvalsCount) {
        this.approvalsCount = approvalsCount;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }
}
