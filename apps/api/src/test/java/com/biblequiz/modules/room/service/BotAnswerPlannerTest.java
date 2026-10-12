package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;
import org.junit.jupiter.api.Test;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

/** PCV-21 — người máy trả lời giống người (design §3.1): đúng theo cấp × độ khó, thời gian theo cấp. */
class BotAnswerPlannerTest {

    private static double accuracy(RoomBotService.BotLevel level, Question.Difficulty d) {
        Random rnd = new Random(42);
        int right = 0, n = 20_000;
        for (int i = 0; i < n; i++) {
            if (BotAnswerPlanner.plan(level, d, 30, 4, 2, rnd).answerIndex() == 2) right++;
        }
        return right / (double) n;
    }

    @Test
    void accuracyFollowsTheTable() {
        assertEquals(0.55, accuracy(RoomBotService.BotLevel.EASY, Question.Difficulty.easy), 0.02);
        assertEquals(0.25, accuracy(RoomBotService.BotLevel.EASY, Question.Difficulty.hard), 0.02);
        assertEquals(0.65, accuracy(RoomBotService.BotLevel.MEDIUM, Question.Difficulty.medium), 0.02);
        assertEquals(0.95, accuracy(RoomBotService.BotLevel.HARD, Question.Difficulty.easy), 0.02);
        assertEquals(0.70, accuracy(RoomBotService.BotLevel.HARD, Question.Difficulty.hard), 0.02);
    }

    @Test
    void unknownDifficulty_usesMediumColumn() {
        assertEquals(0.85, accuracy(RoomBotService.BotLevel.HARD, null), 0.02);
    }

    @Test
    void delayFollowsLevel_andAlwaysLandsAtLeastOneSecondBeforeTheDeadline() {
        Random rnd = new Random(7);
        for (int i = 0; i < 2_000; i++) {
            int easy = BotAnswerPlanner.plan(RoomBotService.BotLevel.EASY, Question.Difficulty.easy, 30, 4, 0, rnd).delayMs();
            assertTrue(easy >= 6_000 && easy <= 14_000, "Dễ 6–14 s: " + easy);
            int hard = BotAnswerPlanner.plan(RoomBotService.BotLevel.HARD, Question.Difficulty.easy, 30, 4, 0, rnd).delayMs();
            assertTrue(hard >= 2_500 && hard <= 7_000, "Giỏi 2,5–7 s: " + hard);
            int shortQuestion = BotAnswerPlanner.plan(RoomBotService.BotLevel.EASY, Question.Difficulty.easy, 10, 4, 0, rnd).delayMs();
            assertTrue(shortQuestion <= 9_000, "câu 10 giây: trả lời trước hạn ≥ 1 s: " + shortQuestion);
        }
    }

    @Test
    void wrongAnswer_isAnotherValidOption() {
        Random rnd = new Random(3);
        for (int i = 0; i < 2_000; i++) {
            BotAnswerPlanner.Plan p = BotAnswerPlanner.plan(RoomBotService.BotLevel.EASY, Question.Difficulty.hard, 30, 3, 1, rnd);
            assertTrue(p.answerIndex() >= 0 && p.answerIndex() < 3);
        }
    }
}
