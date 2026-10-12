package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;

import java.util.Random;

/**
 * PCV-21 — người máy trả lời giống người (design §3.1).
 *
 * <p>Xác suất đúng theo cấp × độ khó câu:
 * <pre>
 *            Dễ    TB    Khó
 *   Dễ      0,55  0,40  0,25
 *   Vừa     0,80  0,65  0,45
 *   Giỏi    0,95  0,85  0,70
 * </pre>
 * Thời gian: Dễ 6–14 giây, Vừa 4–10 giây, Giỏi 2,5–7 giây, luôn trước hạn ít nhất 1 giây.
 * Trả lời sai thì chọn ngẫu nhiên một phương án sai.
 */
public final class BotAnswerPlanner {

    private BotAnswerPlanner() {}

    public record Plan(int answerIndex, int delayMs) {}

    public static Plan plan(RoomBotService.BotLevel level, Question.Difficulty difficulty, int timeLimitSeconds,
                            int optionCount, int correctIndex, Random random) {
        double p = accuracy(level, difficulty);
        int options = Math.max(2, optionCount);
        int answer;
        if (random.nextDouble() < p) {
            answer = correctIndex;
        } else {
            int wrong = random.nextInt(options - 1);
            answer = wrong >= correctIndex ? wrong + 1 : wrong;
        }

        int[] range = switch (level) {
            case EASY -> new int[]{6_000, 14_000};
            case MEDIUM -> new int[]{4_000, 10_000};
            case HARD -> new int[]{2_500, 7_000};
        };
        int latest = Math.max(500, timeLimitSeconds * 1000 - 1000);
        int from = Math.min(range[0], latest);
        int to = Math.min(range[1], latest);
        int delay = from + (to > from ? random.nextInt(to - from + 1) : 0);
        return new Plan(answer, delay);
    }

    static double accuracy(RoomBotService.BotLevel level, Question.Difficulty difficulty) {
        int col = difficulty == Question.Difficulty.easy ? 0 : difficulty == Question.Difficulty.hard ? 2 : 1;
        double[] row = switch (level) {
            case EASY -> new double[]{0.55, 0.40, 0.25};
            case MEDIUM -> new double[]{0.80, 0.65, 0.45};
            case HARD -> new double[]{0.95, 0.85, 0.70};
        };
        return row[col];
    }
}
