package com.biblequiz.modules.userquiz.repository;

import com.biblequiz.modules.userquiz.entity.UserQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserQuestionRepository extends JpaRepository<UserQuestion, String> {
    List<UserQuestion> findByUserIdOrderByCreatedAtDesc(String userId);
    List<UserQuestion> findByUserIdAndBookOrderByCreatedAtDesc(String userId, String book);
    long countByUserId(String userId);
}
