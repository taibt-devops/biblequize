package com.biblequiz.modules.userquiz.repository;

import com.biblequiz.modules.userquiz.entity.QuestionSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface QuestionSetRepository extends JpaRepository<QuestionSet, String> {

    List<QuestionSet> findByUserIdOrderByUpdatedAtDesc(String userId);

    long countByUserId(String userId);

    List<QuestionSet> findByVisibilityOrderByUpdatedAtDesc(QuestionSet.Visibility visibility);

    @Query("SELECT COUNT(r) FROM Room r WHERE r.questionSetId = :setId AND r.status = 'IN_PROGRESS'")
    long countActiveRoomsUsingSet(@Param("setId") String setId);
}
