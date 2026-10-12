package com.biblequiz.service;

import com.biblequiz.modules.quiz.entity.DailyMission;
import com.biblequiz.modules.quiz.repository.DailyMissionRepository;
import com.biblequiz.modules.quiz.service.DailyMissionService;
import com.biblequiz.modules.ranked.service.UserTierService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DailyMissionServiceTest {

    @Mock
    private DailyMissionRepository missionRepository;

    @Mock
    private UserTierService userTierService;

    private DailyMissionService service;

    private static final String USER_ID = "user-123";

    @BeforeEach
    void setUp() {
        service = new DailyMissionService(missionRepository, userTierService);
    }

    @Test
    void getOrCreate_createsNewMissions_forTier1() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(List.of());
        when(userTierService.getTierLevel(USER_ID)).thenReturn(1);
        when(missionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<DailyMission> result = service.getOrCreateMissions(USER_ID);

        assertEquals(3, result.size());
        assertEquals("answer_correct", result.get(0).getMissionType());
        assertEquals(3, result.get(0).getTarget());
        assertEquals("complete_daily_challenge", result.get(1).getMissionType());
        assertEquals("answer_combo", result.get(2).getMissionType());
        verify(missionRepository).saveAll(anyList());
    }

    @Test
    void getOrCreate_returnsExisting_whenAlreadyCreated() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id", USER_ID, today, 1, "answer_correct", "{}", 3);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(List.of(m));

        List<DailyMission> result = service.getOrCreateMissions(USER_ID);

        assertEquals(1, result.size());
        verify(missionRepository, never()).saveAll(anyList());
    }

    @Test
    void trackProgress_incrementsProgress() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 1, "answer_correct", "{}", 3);
        m.setProgress(1);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackProgress(USER_ID, "answer_correct", 1);

        assertEquals(2, m.getProgress());
        assertFalse(m.isCompleted());
        verify(missionRepository).save(m);
    }

    @Test
    void trackProgress_completesMission_whenTargetReached() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 1, "answer_correct", "{}", 3);
        m.setProgress(2);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackProgress(USER_ID, "answer_correct", 1);

        assertEquals(3, m.getProgress());
        assertTrue(m.isCompleted());
        assertNotNull(m.getCompletedAt());
    }

    @Test
    void trackProgress_doesNotExceedTarget() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 1, "answer_correct", "{}", 3);
        m.setProgress(2);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackProgress(USER_ID, "answer_correct", 5);

        assertEquals(3, m.getProgress()); // capped at target
    }

    @Test
    void trackProgress_ignoresCompletedMission() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 1, "answer_correct", "{}", 3);
        m.setProgress(3);
        m.setCompleted(true);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackProgress(USER_ID, "answer_correct", 1);

        verify(missionRepository, never()).save(any());
    }

    @Test
    void trackCombo_incrementsOnCorrect() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 3, "answer_combo", "{}", 3);
        m.setProgress(1);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackComboProgress(USER_ID, "answer_combo", true);

        assertEquals(2, m.getProgress());
        assertFalse(m.isCompleted());
        verify(missionRepository).save(m);
    }

    @Test
    void trackCombo_resetsOnWrong() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 3, "answer_combo", "{}", 3);
        m.setProgress(2);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackComboProgress(USER_ID, "answer_combo", false);

        assertEquals(0, m.getProgress());
        assertFalse(m.isCompleted());
        verify(missionRepository).save(m);
    }

    @Test
    void trackCombo_completesAtTarget() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 3, "answer_combo", "{}", 3);
        m.setProgress(2);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackComboProgress(USER_ID, "answer_combo", true);

        assertEquals(3, m.getProgress());
        assertTrue(m.isCompleted());
        assertNotNull(m.getCompletedAt());
    }

    @Test
    void trackCombo_idempotentAfterCompletion() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 3, "answer_combo", "{}", 3);
        m.setProgress(3);
        m.setCompleted(true);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackComboProgress(USER_ID, "answer_combo", false);

        assertTrue(m.isCompleted());
        assertEquals(3, m.getProgress());
        verify(missionRepository, never()).save(any());
    }

    @Test
    void trackCombo_skipSaveWhenProgressAlreadyZero() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        DailyMission m = new DailyMission("id1", USER_ID, today, 3, "answer_combo", "{}", 3);
        m.setProgress(0);
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(new ArrayList<>(List.of(m)));

        service.trackComboProgress(USER_ID, "answer_combo", false);

        assertEquals(0, m.getProgress());
        verify(missionRepository, never()).save(any());
    }

    @Test
    void getMissionsResponse_returnsCorrectShape() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(List.of());
        when(userTierService.getTierLevel(USER_ID)).thenReturn(2);
        when(missionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> response = service.getMissionsResponse(USER_ID);

        assertEquals(today.toString(), response.get("date"));
        assertNotNull(response.get("missions"));
        assertEquals(false, response.get("allCompleted"));
        assertEquals(false, response.get("bonusClaimed"));
        assertEquals(50, response.get("bonusXp"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> missions = (List<Map<String, Object>>) response.get("missions");
        assertEquals(3, missions.size());
        // Tier 2 missions
        assertEquals("play_any_mode", missions.get(0).get("type"));
    }

    @Test
    void tier3Missions_correctTypes() {
        LocalDate today = com.biblequiz.infrastructure.time.GameClock.today();
        when(missionRepository.findByUserIdAndDateOrderByMissionSlot(USER_ID, today))
                .thenReturn(List.of());
        when(userTierService.getTierLevel(USER_ID)).thenReturn(3);
        when(missionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<DailyMission> missions = service.getOrCreateMissions(USER_ID);
        assertEquals("answer_correct", missions.get(0).getMissionType());
        assertEquals("answer_correct_difficulty", missions.get(1).getMissionType());
        assertEquals("win_multiplayer_room", missions.get(2).getMissionType());
    }
}
