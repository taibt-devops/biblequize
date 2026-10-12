package com.biblequiz.service;

import com.biblequiz.modules.quiz.entity.DailyMission;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.DailyMissionRepository;
import com.biblequiz.modules.quiz.service.DailyMissionService;
import com.biblequiz.modules.quiz.service.DailyMissionService.AnswerEvent;
import com.biblequiz.modules.quiz.service.MissionRewardService;
import com.biblequiz.modules.ranked.service.UserTierService;
import com.biblequiz.infrastructure.time.GameClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-7 — đủ 13 loại nhiệm vụ đều tiến được; loại không còn lối vào được thay; thưởng 50 XP thật. */
@ExtendWith(MockitoExtension.class)
class DailyMissionEventsTest {

    private static final String U = "user-1";

    @Mock private DailyMissionRepository repo;
    @Mock private UserTierService tierService;
    @Mock private MissionRewardService rewardService;

    private DailyMissionService service;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        service = new DailyMissionService(repo, tierService);
        ReflectionTestUtils.setField(service, "rewardService", rewardService);
        today = GameClock.today();
        lenient().when(repo.saveAll(anyList())).thenAnswer(i -> i.getArgument(0));
    }

    private DailyMission m(int slot, String type, String config, int target) {
        return new DailyMission("m" + slot, U, today, slot, type, config, target);
    }

    private void today(DailyMission... ms) {
        when(repo.findByUserIdAndDateOrderByMissionSlot(U, today)).thenReturn(new ArrayList<>(List.of(ms)));
    }

    @Test
    void onAnswer_correctMediumCounts_onlyForMatchingDifficulty() {
        DailyMission medium = m(1, "answer_correct_difficulty", "{\"difficulty\":\"MEDIUM\",\"count\":5}", 5);
        DailyMission plain = m(2, "answer_correct", "{\"count\":3}", 3);
        today(medium, plain);

        service.onAnswer(U, new AnswerEvent(true, Question.Difficulty.medium, "Genesis", 4000));
        service.onAnswer(U, new AnswerEvent(true, Question.Difficulty.easy, "Genesis", 4000));
        service.onAnswer(U, new AnswerEvent(false, Question.Difficulty.medium, "Genesis", 4000));

        assertEquals(1, medium.getProgress());
        assertEquals(2, plain.getProgress());
    }

    @Test
    void onAnswer_hardFast_countsOnlyWithinMaxSeconds() {
        DailyMission fast = m(1, "answer_hard_fast", "{\"count\":5,\"maxSec\":10}", 5);
        today(fast);

        service.onAnswer(U, new AnswerEvent(true, Question.Difficulty.hard, "Job", 9_500));
        service.onAnswer(U, new AnswerEvent(true, Question.Difficulty.hard, "Job", 12_000));
        service.onAnswer(U, new AnswerEvent(true, Question.Difficulty.medium, "Job", 3_000));
        service.onAnswer(U, new AnswerEvent(true, Question.Difficulty.hard, "Job", 0)); // không đo được giờ

        assertEquals(1, fast.getProgress());
    }

    @Test
    void onAnswer_sameBook_progressIsBestSingleBook() {
        DailyMission book = m(1, "answer_correct_book", "{\"count\":5}", 5);
        today(book);

        service.onAnswer(U, new AnswerEvent(true, null, "Genesis", 0));
        service.onAnswer(U, new AnswerEvent(true, null, "Exodus", 0));
        service.onAnswer(U, new AnswerEvent(true, null, "Genesis", 0));
        service.onAnswer(U, new AnswerEvent(false, null, "Genesis", 0));

        assertEquals(2, book.getProgress());
    }

    @Test
    void onAnswer_combo_resetsOnWrong() {
        DailyMission combo = m(1, "answer_combo", "{\"streak\":3}", 3);
        today(combo);

        service.onAnswer(U, new AnswerEvent(true, null, null, 0));
        service.onAnswer(U, new AnswerEvent(true, null, null, 0));
        service.onAnswer(U, new AnswerEvent(false, null, null, 0));

        assertEquals(0, combo.getProgress());
    }

    @Test
    void onRankedPoints_completesWhenThresholdReached() {
        DailyMission ranked = m(1, "ranked_score", "{\"minScore\":60}", 1);
        today(ranked);

        service.onRankedPoints(U, 45);
        assertFalse(ranked.isCompleted());
        service.onRankedPoints(U, 61);
        assertTrue(ranked.isCompleted());
    }

    @Test
    void onEvent_roomPlayAndMemorize() {
        DailyMission play = m(1, "play_multiplayer_room", "{}", 1);
        DailyMission mem = m(2, "memorize_review", "{\"count\":3}", 3);
        DailyMission any = m(3, "play_any_mode", "{}", 1);
        today(play, mem, any);

        service.onEvent(U, "play_multiplayer_room");
        service.onEvent(U, "memorize_review");
        service.onEvent(U, "play_any_mode");

        assertTrue(play.isCompleted());
        assertEquals(1, mem.getProgress());
        assertTrue(any.isCompleted());
    }

    @Test
    void retiredTypes_areReplacedOnRead_progressReset() {
        DailyMission speed = m(1, "complete_speed_round", "{}", 1);
        DailyMission mystery = m(2, "complete_mystery_mode", "{}", 1);
        DailyMission top3 = m(3, "leaderboard_daily_top3", "{}", 1);
        today(speed, mystery, top3);

        List<DailyMission> list = service.getOrCreateMissions(U);

        assertEquals("play_multiplayer_room", list.get(0).getMissionType());
        assertEquals("memorize_review", list.get(1).getMissionType());
        assertEquals(3, list.get(1).getTarget());
        assertEquals("win_multiplayer_room", list.get(2).getMissionType());
        verify(repo).saveAll(anyList());
    }

    @Test
    void reviewAiDraft_isReplacedByHardQuestions() {
        DailyMission ai = m(1, "review_ai_draft", "{\"count\":3}", 3);
        today(ai);

        DailyMission replaced = service.getOrCreateMissions(U).get(0);

        assertEquals("answer_correct_difficulty", replaced.getMissionType());
        assertTrue(replaced.getConfig().contains("HARD"));
        assertEquals(5, replaced.getTarget());
    }

    @Test
    void allThreeDone_creditsBonusXpExactlyOnce() {
        DailyMission a = m(1, "answer_correct", "{\"count\":1}", 1);
        DailyMission b = m(2, "play_any_mode", "{}", 1);
        DailyMission c = m(3, "play_multiplayer_room", "{}", 1);
        b.setProgress(1); b.setCompleted(true);
        c.setProgress(1); c.setCompleted(true);
        today(a, b, c);

        service.onAnswer(U, new AnswerEvent(true, null, null, 0));
        service.onEvent(U, "play_any_mode");

        verify(rewardService, times(1)).creditBonus(U, 50);
        assertTrue(a.isBonusClaimed());
    }

    @Test
    void trackingCreatesTodaysMissionsWhenMissing() {
        when(repo.findByUserIdAndDateOrderByMissionSlot(U, today)).thenReturn(new ArrayList<>());
        when(tierService.getTierLevel(U)).thenReturn(1);

        service.onAnswer(U, new AnswerEvent(true, null, null, 0));

        verify(repo, atLeastOnce()).saveAll(argThat(l -> {
            List<?> list = (List<?>) l;
            return list.stream().anyMatch(x -> "answer_correct".equals(((DailyMission) x).getMissionType())
                    && ((DailyMission) x).getProgress() == 1);
        }));
    }

    @Test
    void descriptions_followConfig() {
        DailyMission medium = m(1, "answer_correct_difficulty", "{\"difficulty\":\"MEDIUM\",\"count\":5}", 5);
        DailyMission ranked = m(2, "ranked_score", "{\"minScore\":60}", 1);
        DailyMission room = m(3, "win_multiplayer_room", "{}", 1);
        today(medium, ranked, room);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) service.getMissionsResponse(U).get("missions");

        assertEquals("Trả lời đúng 5 câu trung bình", rows.get(0).get("description"));
        assertEquals("Đạt 60 điểm Đấu Hạng trong ngày", rows.get(1).get("description"));
        assertEquals("Thắng 1 trận Phòng chơi", rows.get(2).get("description"));
    }
}
