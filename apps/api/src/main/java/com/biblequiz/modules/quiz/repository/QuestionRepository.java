package com.biblequiz.modules.quiz.repository;

import com.biblequiz.modules.quiz.entity.Question;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;


@Repository
public interface QuestionRepository extends JpaRepository<Question, String> {
    
    Page<Question> findByIsActiveTrue(Pageable pageable);
    
    Page<Question> findByBookAndIsActiveTrue(String book, Pageable pageable);
    
    Page<Question> findByBookAndChapterAndIsActiveTrue(String book, Integer chapter, Pageable pageable);
    
    Page<Question> findByDifficultyAndIsActiveTrue(Question.Difficulty difficulty, Pageable pageable);
    
    Page<Question> findByTypeAndIsActiveTrue(Question.Type type, Pageable pageable);
    
    Page<Question> findByLanguageAndIsActiveTrue(String language, Pageable pageable);
    
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND " +
           "(:book IS NULL OR q.book = :book) AND " +
           "(:chapter IS NULL OR q.chapter = :chapter) AND " +
           "(:difficulty IS NULL OR q.difficulty = :difficulty) AND " +
           "(:type IS NULL OR q.type = :type) AND " +
           "(:language IS NULL OR q.language = :language)")
    Page<Question> findWithFilters(@Param("book") String book,
                                  @Param("chapter") Integer chapter,
                                  @Param("difficulty") Question.Difficulty difficulty,
                                  @Param("type") Question.Type type,
                                  @Param("language") String language,
                                  Pageable pageable);
    
    // Random selection will be implemented in service layer using count + random page
    
    long countByIsActiveTrue();

    long countByBookAndIsActiveTrue(String book);

    long countByDifficultyAndIsActiveTrue(Question.Difficulty difficulty);

    long countByBookAndDifficultyAndIsActiveTrue(String book, Question.Difficulty difficulty);

    // Language-aware counts
    long countByLanguageAndIsActiveTrue(String language);

    long countByBookAndLanguageAndIsActiveTrue(String book, String language);

    long countByDifficultyAndLanguageAndIsActiveTrue(Question.Difficulty difficulty, String language);

    long countByBookAndDifficultyAndLanguageAndIsActiveTrue(String book, Question.Difficulty difficulty, String language);

    // Language-aware page queries
    Page<Question> findByLanguageAndBookAndIsActiveTrue(String language, String book, Pageable pageable);

    Page<Question> findByLanguageAndDifficultyAndIsActiveTrue(String language, Question.Difficulty difficulty, Pageable pageable);

    Page<Question> findByLanguageAndBookAndDifficultyAndIsActiveTrue(String language, String book, Question.Difficulty difficulty, Pageable pageable);
    
    // Derived queries to support service-side randomization and filtering
    Page<Question> findByBookAndDifficultyAndIsActiveTrue(String book, Question.Difficulty difficulty, Pageable pageable);
    
    // Optimized queries for better performance
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsExcludingIds(@Param("excludeIds") List<String> excludeIds, Pageable pageable);
    
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.book = :book AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByBookExcludingIds(@Param("book") String book, 
                                                         @Param("excludeIds") List<String> excludeIds, 
                                                         Pageable pageable);
    
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.difficulty = :difficulty AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByDifficultyExcludingIds(@Param("difficulty") Question.Difficulty difficulty,
                                                                @Param("excludeIds") List<String> excludeIds,
                                                                Pageable pageable);
    
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.book = :book AND q.difficulty = :difficulty AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByBookAndDifficultyExcludingIds(@Param("book") String book,
                                                                      @Param("difficulty") Question.Difficulty difficulty,
                                                                      @Param("excludeIds") List<String> excludeIds,
                                                                      Pageable pageable);
    
    // Performance optimization: Get question count by filters
    @Query("SELECT COUNT(q) FROM Question q WHERE q.isActive = true AND " +
           "(:book IS NULL OR q.book = :book) AND " +
           "(:difficulty IS NULL OR q.difficulty = :difficulty) AND " +
           "(:type IS NULL OR q.type = :type) AND " +
           "(:language IS NULL OR q.language = :language)")
    long countByFilters(@Param("book") String book,
                       @Param("difficulty") Question.Difficulty difficulty,
                       @Param("type") Question.Type type,
                       @Param("language") String language);
    
    // Smart question selection — list queries (no pagination)
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language")
    List<Question> findAllActiveByLanguage(@Param("language") String language);

    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book = :book")
    List<Question> findAllActiveByLanguageAndBook(@Param("language") String language, @Param("book") String book);

    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.difficulty = :difficulty")
    List<Question> findAllActiveByLanguageAndDifficulty(@Param("language") String language, @Param("difficulty") Question.Difficulty difficulty);

    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book = :book AND q.difficulty = :difficulty")
    List<Question> findAllActiveByLanguageAndBookAndDifficulty(@Param("language") String language, @Param("book") String book, @Param("difficulty") Question.Difficulty difficulty);

    // Review workflow
    Page<Question> findByReviewStatus(Question.ReviewStatus reviewStatus, Pageable pageable);

    // Admin list with all filters (no isActive restriction)
    @Query("SELECT q FROM Question q WHERE " +
           "(:book IS NULL OR q.book = :book) AND " +
           "(:difficulty IS NULL OR q.difficulty = :difficulty) AND " +
           "(:type IS NULL OR q.type = :type) AND " +
           "(:language IS NULL OR q.language = :language) AND " +
           "(:reviewStatus IS NULL OR q.reviewStatus = :reviewStatus) AND " +
           "(:category IS NULL OR q.category = :category) AND " +
           "(:search IS NULL OR LOWER(q.content) LIKE :search)")
    Page<Question> findWithAdminFilters(
            @Param("book") String book,
            @Param("difficulty") Question.Difficulty difficulty,
            @Param("type") Question.Type type,
            @Param("language") String language,
            @Param("reviewStatus") Question.ReviewStatus reviewStatus,
            @Param("category") String category,
            @Param("search") String search,
            Pageable pageable);

    long countByReviewStatus(Question.ReviewStatus reviewStatus);

    @Query("SELECT q FROM Question q WHERE q.reviewStatus = :status AND q.id NOT IN :excludeIds")
    Page<Question> findByReviewStatusAndIdNotIn(
            @Param("status") Question.ReviewStatus status,
            @Param("excludeIds") List<String> excludeIds,
            Pageable pageable);

    @Query("SELECT COUNT(q) FROM Question q WHERE q.reviewStatus = :status AND q.id NOT IN :excludeIds")
    long countByReviewStatusAndIdNotIn(
            @Param("status") Question.ReviewStatus status,
            @Param("excludeIds") List<String> excludeIds);

    @Query("SELECT DISTINCT q.book FROM Question q WHERE q.isActive = true ORDER BY q.book")
    List<String> findDistinctActiveBooks();

    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :lang AND q.difficulty = 'EASY' ORDER BY RAND()")
    List<Question> findRandomEasyByLanguage(@Param("lang") String language, Pageable pageable);

    // Index hints for better performance
    @Query(value = "SELECT * FROM questions q USE INDEX (idx_is_active) WHERE q.is_active = true ORDER BY RAND() LIMIT :limit",
           nativeQuery = true)
    List<Question> findRandomQuestionsNative(@Param("limit") int limit);

    @Query("SELECT CASE WHEN COUNT(q) > 0 THEN true ELSE false END FROM Question q WHERE LOWER(q.content) = :content")
    boolean existsByContentIgnoreCase(@Param("content") String contentLowerCase);

    @Query("SELECT q FROM Question q WHERE LOWER(REPLACE(REPLACE(q.content, '?', ''), '.', '')) = :normalized AND q.isActive = true")
    List<Question> findByNormalizedContent(@Param("normalized") String normalizedContent);

    List<Question> findByBookAndChapterAndVerseStartAndLanguageAndIsActiveTrue(
            String book, Integer chapter, Integer verseStart, String language);

    List<Question> findByBookAndChapterAndLanguageAndIsActiveTrue(
            String book, Integer chapter, String language);

    // Bible Basics catechism quiz lookup (category='bible_basics' identifies
    // the 10 doctrinal questions that gate Ranked unlock).
    List<Question> findByCategoryAndLanguageAndIsActiveTrue(String category, String language);

    long countByCategoryAndLanguageAndIsActiveTrue(String category, String language);
}
