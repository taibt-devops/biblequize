package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.service.mode.BattleRoyaleStrategy;
import com.biblequiz.modules.room.service.mode.GameLoopContext;
import com.biblequiz.modules.room.service.mode.RoundPlan;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** PCV-12 — Sinh tồn: vùng nguy hiểm từ câu 10 (max(10, base − 2×(câu − 9))), câu quyết định sau câu chính. */
class BattleRoyalePlanRoundTest {

    private final BattleRoyaleStrategy strategy =
            new BattleRoyaleStrategy(mock(BattleRoyaleEngine.class), new SpeedRaceScoringService());

    private GameLoopContext ctx(int total, int regular, int base) {
        List<Question> qs = new ArrayList<>();
        for (int i = 0; i < total; i++) qs.add(new Question());
        GameLoopContext ctx = new GameLoopContext("room-1", qs, base, 5000, null, null, null, null, null, null, null);
        ctx.setRegularCount(regular);
        return ctx;
    }

    @Test
    void beforeQuestionTen_fullTime_noFlags() {
        RoundPlan p = strategy.planRound(ctx(20, 15, 20), 8, new Question()); // câu 9
        assertEquals(20, p.timeLimitSeconds());
        assertFalse(p.dangerZone());
        assertFalse(p.showdown());
    }

    @Test
    void dangerZone_shrinksTwoSecondsPerQuestion_neverBelowTen() {
        GameLoopContext c = ctx(20, 15, 20);
        assertEquals(18, strategy.planRound(c, 9, new Question()).timeLimitSeconds());  // câu 10
        assertTrue(strategy.planRound(c, 9, new Question()).dangerZone());
        assertEquals(14, strategy.planRound(c, 11, new Question()).timeLimitSeconds()); // câu 12
        assertEquals(10, strategy.planRound(c, 14, new Question()).timeLimitSeconds()); // câu 15: 20−12=8 → 10
    }

    @Test
    void afterRegularQuestions_isShowdown() {
        RoundPlan p = strategy.planRound(ctx(20, 15, 20), 15, new Question());
        assertTrue(p.showdown());
        assertEquals(10, p.timeLimitSeconds());
    }

    @Test
    void shortGame_showdownWithoutDangerZone() {
        RoundPlan p = strategy.planRound(ctx(10, 5, 30), 5, new Question()); // câu 6 = câu quyết định 1
        assertTrue(p.showdown());
        assertFalse(p.dangerZone());
        assertEquals(30, p.timeLimitSeconds());
    }

    @Test
    void stopsWhenOneOrNoPlayerLeft() {
        GameLoopContext c = ctx(20, 15, 20);
        assertTrue(strategy.shouldStopBeforeRound(c, 1, 3));
        assertFalse(strategy.shouldStopBeforeRound(c, 2, 16));
    }
}
