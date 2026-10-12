package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.entity.Room;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Lỗi phát hiện khi làm PCV-7: Room.RoomDifficulty viết hoa (EASY) nhưng Question.Difficulty
 * viết thường (easy) — {@code Question.Difficulty.valueOf("EASY")} ném lỗi nên mọi phòng chọn
 * độ khó Dễ/Trung bình/Khó kết thúc ngay khi vừa bắt đầu.
 */
class RoomDifficultyMappingTest {

    @Test
    void mapsEveryFixedRoomDifficulty() {
        assertEquals(Question.Difficulty.easy, RoomQuizService.toQuestionDifficulty(Room.RoomDifficulty.EASY));
        assertEquals(Question.Difficulty.medium, RoomQuizService.toQuestionDifficulty(Room.RoomDifficulty.MEDIUM));
        assertEquals(Question.Difficulty.hard, RoomQuizService.toQuestionDifficulty(Room.RoomDifficulty.HARD));
        assertNull(RoomQuizService.toQuestionDifficulty(Room.RoomDifficulty.MIXED));
    }
}
