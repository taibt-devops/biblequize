package com.biblequiz.modules.userquiz.repository;

import com.biblequiz.modules.userquiz.entity.QuestionSetItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionSetItemRepository extends JpaRepository<QuestionSetItem, String> {

    List<QuestionSetItem> findByQuestionSetIdOrderByOrderIndexAsc(String setId);

    void deleteByQuestionSetId(String setId);
}
