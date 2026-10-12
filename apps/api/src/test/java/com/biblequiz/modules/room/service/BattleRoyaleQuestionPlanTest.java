package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** PCV-12 — bộ câu Sinh tồn (design §2.2): 30/40/30 Dễ → TB → Khó, thêm 5 câu Khó dự phòng. */
class BattleRoyaleQuestionPlanTest {

    /** Kho giả: số câu có sẵn theo độ khó; trả về câu chưa dùng, không trùng. */
    private static BattleRoyaleQuestionPlan.Fetcher pool(int easy, int medium, int hard) {
        Map<Question.Difficulty, Integer> stock = new HashMap<>();
        stock.put(Question.Difficulty.easy, easy);
        stock.put(Question.Difficulty.medium, medium);
        stock.put(Question.Difficulty.hard, hard);
        return (difficulty, count, exclude) -> {
            List<Question> out = new ArrayList<>();
            for (Question.Difficulty d : Question.Difficulty.values()) {
                if (difficulty != null && d != difficulty) continue;
                for (int i = 0; i < stock.get(d) && out.size() < count; i++) {
                    String id = d.name() + i;
                    if (exclude.contains(id)) continue;
                    Question q = new Question();
                    q.setId(id);
                    q.setDifficulty(d);
                    out.add(q);
                }
            }
            return out;
        };
    }

    private static String levels(List<Question> qs) {
        StringBuilder sb = new StringBuilder();
        for (Question q : qs) sb.append(q.getDifficulty().name().charAt(0));
        return sb.toString();
    }

    @Test
    void tenQuestions_ramp3_4_3_thenFiveHardReserve() {
        BattleRoyaleQuestionPlan.Result r = BattleRoyaleQuestionPlan.build(10, pool(50, 50, 50));

        assertEquals(10, r.regularCount());
        assertEquals("eeemmmmhhhhhhhh", levels(r.questions()));
        assertEquals(15, r.questions().stream().map(Question::getId).distinct().count(), "không trùng câu");
    }

    @Test
    void shortOnEasy_backfillsFromOtherLevels_keepsEasyToHardOrder() {
        BattleRoyaleQuestionPlan.Result r = BattleRoyaleQuestionPlan.build(10, pool(1, 50, 50));

        assertEquals(10, r.regularCount());
        String regular = levels(r.questions().subList(0, 10));
        assertTrue(regular.startsWith("e"), regular);
        String sorted = regular.chars().boxed()
                .sorted(java.util.Comparator.comparingInt(BattleRoyaleQuestionPlanTest::rank))
                .map(c -> String.valueOf((char) c.intValue()))
                .collect(java.util.stream.Collectors.joining());
        assertEquals(sorted, regular, "độ khó tăng dần");
    }

    private static int rank(int c) {
        return c == 'e' ? 0 : c == 'm' ? 1 : 2;
    }

    @Test
    void notEnoughHardForReserve_fillsReserveWithAnyLevel() {
        BattleRoyaleQuestionPlan.Result r = BattleRoyaleQuestionPlan.build(10, pool(50, 50, 4));

        assertEquals(10, r.regularCount());
        assertEquals(15, r.questions().size());
    }

    @Test
    void smallPool_returnsWhatExists() {
        BattleRoyaleQuestionPlan.Result r = BattleRoyaleQuestionPlan.build(10, pool(2, 2, 2));

        assertEquals(6, r.regularCount());
        assertEquals(6, r.questions().size());
    }
}
