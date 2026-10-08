package com.biblequiz.modules.quiz.repository;

import com.biblequiz.modules.quiz.entity.Question;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
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

    /** Active question count per book: rows of {@code [book, count]}. */
    @Query("SELECT q.book, COUNT(q) FROM Question q WHERE q.isActive = true AND q.language = :language GROUP BY q.book")
    List<Object[]> countActiveByBook(@Param("language") String language);

    /** Active question count per story (V73): rows of {@code [story, count]}. */
    @Query("SELECT q.story, COUNT(q) FROM Question q WHERE q.isActive = true AND q.language = :language AND q.story IS NOT NULL GROUP BY q.story")
    List<Object[]> countActiveByStory(@Param("language") String language);

    List<Question> findByStoryAndLanguageAndIsActiveTrue(String story, String language);

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

    // Quick Match DATABASE source filters by language so rooms don't mix vi/en.
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.difficulty = :difficulty AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByLanguageAndDifficultyExcludingIds(@Param("language") String language,
                                                                          @Param("difficulty") Question.Difficulty difficulty,
                                                                          @Param("excludeIds") List<String> excludeIds,
                                                                          Pageable pageable);

    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book = :book AND q.difficulty = :difficulty AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByLanguageAndBookAndDifficultyExcludingIds(@Param("language") String language,
                                                                                  @Param("book") String book,
                                                                                  @Param("difficulty") Question.Difficulty difficulty,
                                                                                  @Param("excludeIds") List<String> excludeIds,
                                                                                  Pageable pageable);

    // Normal-room DATABASE selection (RoomQuizService) — MIXED-difficulty
    // variants so non-quickmatch rooms don't mix vi/en either (V65).
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByLanguageExcludingIds(@Param("language") String language,
                                                             @Param("excludeIds") List<String> excludeIds,
                                                             Pageable pageable);

    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book = :book AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByLanguageAndBookExcludingIds(@Param("language") String language,
                                                                    @Param("book") String book,
                                                                    @Param("excludeIds") List<String> excludeIds,
                                                                    Pageable pageable);

    // MBV-2: multi-book scope (e.g. Pentateuch, Old Testament) — filter by a set of books.
    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book IN :books AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByLanguageAndBooksExcludingIds(@Param("language") String language,
                                                                     @Param("books") List<String> books,
                                                                     @Param("excludeIds") List<String> excludeIds,
                                                                     Pageable pageable);

    @Query("SELECT q FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book IN :books AND q.difficulty = :difficulty AND q.id NOT IN :excludeIds ORDER BY RAND()")
    List<Question> findRandomQuestionsByLanguageAndBooksAndDifficultyExcludingIds(@Param("language") String language,
                                                                                  @Param("books") List<String> books,
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

    @Query("SELECT new com.biblequiz.modules.quiz.dto.QuestionMeta(q.id, q.book, q.difficulty) " +
           "FROM Question q WHERE q.isActive = true AND q.language = :language")
    List<com.biblequiz.modules.quiz.dto.QuestionMeta> findMetaByLanguage(@Param("language") String language);

    @Query("SELECT new com.biblequiz.modules.quiz.dto.QuestionMeta(q.id, q.book, q.difficulty) " +
           "FROM Question q WHERE q.isActive = true AND q.language = :language AND q.difficulty = :difficulty")
    List<com.biblequiz.modules.quiz.dto.QuestionMeta> findMetaByLanguageAndDifficulty(@Param("language") String language, @Param("difficulty") Question.Difficulty difficulty);

    @Query("SELECT new com.biblequiz.modules.quiz.dto.QuestionMeta(q.id, q.book, q.difficulty) " +
           "FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book = :book")
    List<com.biblequiz.modules.quiz.dto.QuestionMeta> findMetaByLanguageAndBook(@Param("language") String language, @Param("book") String book);

    @Query("SELECT new com.biblequiz.modules.quiz.dto.QuestionMeta(q.id, q.book, q.difficulty) " +
           "FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book = :book AND q.difficulty = :difficulty")
    List<com.biblequiz.modules.quiz.dto.QuestionMeta> findMetaByLanguageAndBookAndDifficulty(@Param("language") String language, @Param("book") String book, @Param("difficulty") Question.Difficulty difficulty);

    @Query("SELECT new com.biblequiz.modules.quiz.dto.QuestionMeta(q.id, q.book, q.difficulty) " +
           "FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book IN :books")
    List<com.biblequiz.modules.quiz.dto.QuestionMeta> findMetaByLanguageAndBooks(@Param("language") String language, @Param("books") List<String> books);

    @Query("SELECT new com.biblequiz.modules.quiz.dto.QuestionMeta(q.id, q.book, q.difficulty) " +
           "FROM Question q WHERE q.isActive = true AND q.language = :language AND q.book IN :books AND q.difficulty = :difficulty")
    List<com.biblequiz.modules.quiz.dto.QuestionMeta> findMetaByLanguageAndBooksAndDifficulty(@Param("language") String language, @Param("books") List<String> books, @Param("difficulty") Question.Difficulty difficulty);

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

    // Practice screen: unified filter with optional chapter/verse range
    @Query("SELECT q FROM Question q WHERE q.isActive = true " +
           "AND q.language = :language " +
           "AND (:book IS NULL OR q.book = :book) " +
           "AND (:difficulty IS NULL OR q.difficulty = :difficulty) " +
           "AND (:chapterFrom IS NULL OR q.chapter >= :chapterFrom) " +
           "AND (:chapterTo IS NULL OR q.chapter <= :chapterTo) " +
           "AND (:verseFrom IS NULL OR q.verseStart >= :verseFrom) " +
           "AND (:verseTo IS NULL OR q.verseStart <= :verseTo)")
    Page<Question> findForPracticeFiltered(@Param("language") String language,
                                           @Param("book") String book,
                                           @Param("difficulty") Question.Difficulty difficulty,
                                           @Param("chapterFrom") Integer chapterFrom,
                                           @Param("chapterTo") Integer chapterTo,
                                           @Param("verseFrom") Integer verseFrom,
                                           @Param("verseTo") Integer verseTo,
                                           Pageable pageable);

    @Query("SELECT COUNT(q) FROM Question q WHERE q.isActive = true " +
           "AND q.language = :language " +
           "AND (:book IS NULL OR q.book = :book) " +
           "AND (:difficulty IS NULL OR q.difficulty = :difficulty) " +
           "AND (:chapterFrom IS NULL OR q.chapter >= :chapterFrom) " +
           "AND (:chapterTo IS NULL OR q.chapter <= :chapterTo) " +
           "AND (:verseFrom IS NULL OR q.verseStart >= :verseFrom) " +
           "AND (:verseTo IS NULL OR q.verseStart <= :verseTo)")
    long countForPracticeFiltered(@Param("language") String language,
                                  @Param("book") String book,
                                  @Param("difficulty") Question.Difficulty difficulty,
                                  @Param("chapterFrom") Integer chapterFrom,
                                  @Param("chapterTo") Integer chapterTo,
                                  @Param("verseFrom") Integer verseFrom,
                                  @Param("verseTo") Integer verseTo);

    // Used by QuestionSeeder sync-mode: hard-delete seed rows that the JSON
    // no longer contains for a given (book, language). Restricted to a single
    // source so admin-curated rows ("admin", "ai-generated", etc.) survive.
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM questions " +
                   "WHERE source = :source AND book = :book AND language = :lang " +
                   "AND id NOT IN (:keepIds)",
           nativeQuery = true)
    int deleteStaleBySourceBookLanguage(@Param("source") String source,
                                        @Param("book") String book,
                                        @Param("lang") String language,
                                        @Param("keepIds") Collection<String> keepIds);

    // All existing content_hash values (generated column, V68). Used by the
    // JSON seeder to skip inserting a question whose logical-identity hash
    // already exists — the deterministic seed ID keeps punctuation while
    // content_hash strips it, so punctuation-variants would otherwise slip
    // past the id-based dedup and violate uq_questions_content_hash.
    @Query(value = "SELECT content_hash FROM questions", nativeQuery = true)
    List<String> findAllContentHashes();

    // When the JSON file shrinks to zero questions for a (book, language)
    // group we still need to clear out everything seeded under that group
    // (the IN-clause variant fails with empty list on most DBs).
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM questions " +
                   "WHERE source = :source AND book = :book AND language = :lang",
           nativeQuery = true)
    int deleteAllBySourceBookLanguage(@Param("source") String source,
                                      @Param("book") String book,
                                      @Param("lang") String language);
}
