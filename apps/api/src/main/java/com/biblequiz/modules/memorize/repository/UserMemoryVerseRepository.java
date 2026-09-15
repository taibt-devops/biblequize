package com.biblequiz.modules.memorize.repository;

import com.biblequiz.modules.memorize.entity.UserMemoryVerse;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserMemoryVerseRepository extends JpaRepository<UserMemoryVerse, String> {

    /** Danh sách của tôi: đến hạn sớm nhất trước, rồi câu mới thêm. */
    @Query("SELECT m FROM UserMemoryVerse m WHERE m.user.id = :userId " +
           "ORDER BY m.nextReviewAt ASC, m.createdAt DESC")
    List<UserMemoryVerse> findAllByUserId(@Param("userId") String userId);

    /** Câu đến hạn, cũ nhất trước; giới hạn bằng Pageable (phiên ôn lấy 10). */
    @Query("SELECT m FROM UserMemoryVerse m WHERE m.user.id = :userId " +
           "AND m.nextReviewAt <= :now ORDER BY m.nextReviewAt ASC")
    List<UserMemoryVerse> findDue(@Param("userId") String userId, @Param("now") LocalDateTime now,
                                  Pageable pageable);

    @Query("SELECT COUNT(m) FROM UserMemoryVerse m WHERE m.user.id = :userId AND m.nextReviewAt <= :now")
    long countDue(@Param("userId") String userId, @Param("now") LocalDateTime now);

    @Query("SELECT m FROM UserMemoryVerse m WHERE m.id = :id AND m.user.id = :userId")
    Optional<UserMemoryVerse> findOwned(@Param("id") String id, @Param("userId") String userId);

    @Query("SELECT CASE WHEN COUNT(m) > 0 THEN true ELSE false END FROM UserMemoryVerse m WHERE m.user.id = :userId " +
           "AND m.version = :version AND m.book = :book AND m.chapter = :chapter " +
           "AND m.verseStart = :verseStart AND m.verseEnd = :verseEnd")
    boolean existsRef(@Param("userId") String userId, @Param("version") String version,
                      @Param("book") String book, @Param("chapter") int chapter,
                      @Param("verseStart") int verseStart, @Param("verseEnd") int verseEnd);
}
