package com.biblequiz.modules.userquiz.entity;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.shared.converter.JsonListConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "user_questions")
public class UserQuestion {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Convert(converter = JsonListConverter.class)
    @Column(nullable = false, columnDefinition = "JSON")
    private List<String> options;

    @Column(name = "correct_answer", nullable = false)
    private Integer correctAnswer;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private Difficulty difficulty = Difficulty.MIXED;

    @Column(length = 100)
    private String book;

    @Column(name = "chapter_start")
    private Integer chapterStart;

    @Column(name = "chapter_end")
    private Integer chapterEnd;

    @Column(name = "verse_start")
    private Integer verseStart;

    @Column(name = "verse_end")
    private Integer verseEnd;

    @Column(length = 255)
    private String theme;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private Source source = Source.MANUAL;

    @Column(nullable = false, length = 10)
    private String language = "vi";

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Difficulty { EASY, MEDIUM, HARD, MIXED }
    public enum Source { AI, MANUAL }

    public UserQuestion() {}

    // Getters / Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public Integer getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(Integer correctAnswer) { this.correctAnswer = correctAnswer; }

    public Difficulty getDifficulty() { return difficulty; }
    public void setDifficulty(Difficulty difficulty) { this.difficulty = difficulty; }

    public String getBook() { return book; }
    public void setBook(String book) { this.book = book; }

    public Integer getChapterStart() { return chapterStart; }
    public void setChapterStart(Integer chapterStart) { this.chapterStart = chapterStart; }

    public Integer getChapterEnd() { return chapterEnd; }
    public void setChapterEnd(Integer chapterEnd) { this.chapterEnd = chapterEnd; }

    public Integer getVerseStart() { return verseStart; }
    public void setVerseStart(Integer verseStart) { this.verseStart = verseStart; }

    public Integer getVerseEnd() { return verseEnd; }
    public void setVerseEnd(Integer verseEnd) { this.verseEnd = verseEnd; }

    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }

    public Source getSource() { return source; }
    public void setSource(Source source) { this.source = source; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
