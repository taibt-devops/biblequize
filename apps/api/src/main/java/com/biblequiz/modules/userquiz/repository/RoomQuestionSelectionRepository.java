package com.biblequiz.modules.userquiz.repository;

import com.biblequiz.modules.userquiz.entity.RoomQuestionSelection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomQuestionSelectionRepository extends JpaRepository<RoomQuestionSelection, String> {
    List<RoomQuestionSelection> findByRoomIdOrderByOrderIndex(String roomId);
    void deleteByRoomId(String roomId);
    long countByRoomId(String roomId);
}
