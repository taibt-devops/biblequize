package com.biblequiz.api;

import com.biblequiz.api.dto.SeedPointsRequest;
import com.biblequiz.api.dto.SetMissionStateRequest;
import com.biblequiz.api.dto.SetStateRequest;
import com.biblequiz.modules.group.entity.ChurchGroup;
import com.biblequiz.modules.group.entity.GroupMember;
import com.biblequiz.modules.group.repository.ChurchGroupRepository;
import com.biblequiz.modules.group.repository.GroupMemberRepository;
import com.biblequiz.modules.quiz.entity.DailyMission;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.DailyMissionRepository;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.quiz.repository.UserQuestionHistoryRepository;
import com.biblequiz.modules.quiz.service.SmartQuestionSelector;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AdminTestController (pure Mockito, no Spring context).
 *
 * <p>Note: unknown-field rejection (HTTP 400 "Field 'xxx' is not allowed") is enforced
 * at the Jackson deserialization layer and tested via integration tests, not here.
 * Profile guard (@Profile) is verified at application startup; cannot be asserted in
 * unit tests without a full Spring context.
 */
@ExtendWith(MockitoExtension.class)
class AdminTestControllerTest {

    @Mock private UserRepository userRepository;
    @Mock private UserQuestionHistoryRepository historyRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private UserDailyProgressRepository dailyProgressRepository;
    @Mock private DailyMissionRepository dailyMissionRepository;
    @Mock private SmartQuestionSelector smartQuestionSelector;
    @Mock private ChurchGroupRepository churchGroupRepository;
    @Mock private GroupMemberRepository groupMemberRepository;

    @InjectMocks private AdminTestController controller;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId("u1");
        testUser.setName("Test User");
        testUser.setEmail("test@dev.local");
        testUser.setRole("USER");
        testUser.setDaysAtTier6(0);
        testUser.setXpSurgeUntil(null);

        lenient().when(userRepository.findById("u1")).thenReturn(Optional.of(testUser));
        lenient().when(dailyProgressRepository.findByUserIdAndDate(eq("u1"), any(LocalDate.class)))
                .thenReturn(Optional.empty());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-state: partial update — livesRemaining only
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setState_livesRemainingOnly_updatesProgressAndNotUser() {
        SetStateRequest req = new SetStateRequest();
        req.setLivesRemaining(42);

        ResponseEntity<?> res = controller.setState("u1", req);

        assertEquals(200, res.getStatusCode().value());
        ArgumentCaptor<UserDailyProgress> captor = ArgumentCaptor.forClass(UserDailyProgress.class);
        verify(dailyProgressRepository).save(captor.capture());
        assertEquals(42, captor.getValue().getLivesRemaining());
        // User entity must NOT be saved when only progress fields are set
        verify(userRepository, never()).save(any());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-state: partial update — questionsCounted only
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setState_questionsCountedOnly_updatesProgress() {
        SetStateRequest req = new SetStateRequest();
        req.setQuestionsCounted(100);

        ResponseEntity<?> res = controller.setState("u1", req);

        assertEquals(200, res.getStatusCode().value());
        ArgumentCaptor<UserDailyProgress> captor = ArgumentCaptor.forClass(UserDailyProgress.class);
        verify(dailyProgressRepository).save(captor.capture());
        assertEquals(100, captor.getValue().getQuestionsCounted());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-state: xpSurgeHoursFromNow=0 clears the surge
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setState_xpSurgeZero_clearsSurge() {
        testUser.setXpSurgeUntil(LocalDateTime.now().plusHours(5));
        SetStateRequest req = new SetStateRequest();
        req.setXpSurgeHoursFromNow(0);

        controller.setState("u1", req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertNull(captor.getValue().getXpSurgeUntil());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-state: xpSurgeHoursFromNow=2 sets surge ~2h from now
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setState_xpSurgePositive_setsFutureTimestamp() {
        SetStateRequest req = new SetStateRequest();
        req.setXpSurgeHoursFromNow(2);

        controller.setState("u1", req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        LocalDateTime surge = captor.getValue().getXpSurgeUntil();
        assertNotNull(surge);
        assertTrue(surge.isAfter(LocalDateTime.now().plusMinutes(100)),
                "xpSurgeUntil should be approximately 2h from now");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-state: all-null request → no-op
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setState_allNullFields_noOp() {
        SetStateRequest req = new SetStateRequest(); // all fields null

        ResponseEntity<?> res = controller.setState("u1", req);

        assertEquals(200, res.getStatusCode().value());
        verify(dailyProgressRepository, never()).save(any());
        verify(userRepository, never()).save(any());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) res.getBody();
        assertNotNull(body);
        @SuppressWarnings("unchecked")
        Map<String, Object> applied = (Map<String, Object>) body.get("applied");
        assertTrue(applied.isEmpty(), "applied map should be empty for all-null request");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-mission-state: happy path — updates progress + completed
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setMissionState_happyPath_updatesFields() {
        LocalDate today = LocalDate.now();
        DailyMission m = new DailyMission("m1", "u1", today, 0, "answer_correct", "{}", 5);
        m.setProgress(0);
        m.setCompleted(false);
        m.setBonusClaimed(false);

        when(dailyMissionRepository.findByUserIdAndDateOrderByMissionSlot("u1", today))
                .thenReturn(List.of(m));

        SetMissionStateRequest req = new SetMissionStateRequest();
        req.setDate(today);
        SetMissionStateRequest.MissionUpdate upd = new SetMissionStateRequest.MissionUpdate();
        upd.setMissionType("answer_correct");
        upd.setProgress(5);
        upd.setCompleted(true);
        upd.setBonusClaimed(false);
        req.setMissions(List.of(upd));

        ResponseEntity<?> res = controller.setMissionState("u1", req);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(5, m.getProgress());
        assertTrue(m.isCompleted());
        verify(dailyMissionRepository).saveAll(List.of(m));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-mission-state: mission type not found → 404
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setMissionState_unknownMissionType_returns404() {
        LocalDate today = LocalDate.now();
        DailyMission m = new DailyMission("m1", "u1", today, 0, "answer_correct", "{}", 5);

        when(dailyMissionRepository.findByUserIdAndDateOrderByMissionSlot("u1", today))
                .thenReturn(List.of(m));

        SetMissionStateRequest req = new SetMissionStateRequest();
        req.setDate(today);
        SetMissionStateRequest.MissionUpdate upd = new SetMissionStateRequest.MissionUpdate();
        upd.setMissionType("nonexistent_type");
        upd.setProgress(3);
        req.setMissions(List.of(upd));

        ResponseEntity<?> res = controller.setMissionState("u1", req);

        assertEquals(404, res.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) res.getBody();
        assertNotNull(body);
        String errMsg = (String) body.get("error");
        assertTrue(errMsg.contains("nonexistent_type"), "Error should mention the missing mission type");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // set-mission-state: no missions for that date → 404
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void setMissionState_noMissionsForDate_returns404() {
        LocalDate pastDate = LocalDate.now().minusDays(10);
        when(dailyMissionRepository.findByUserIdAndDateOrderByMissionSlot("u1", pastDate))
                .thenReturn(List.of());

        SetMissionStateRequest req = new SetMissionStateRequest();
        req.setDate(pastDate);
        SetMissionStateRequest.MissionUpdate upd = new SetMissionStateRequest.MissionUpdate();
        upd.setMissionType("answer_correct");
        upd.setProgress(3);
        req.setMissions(List.of(upd));

        ResponseEntity<?> res = controller.setMissionState("u1", req);

        assertEquals(404, res.getStatusCode().value());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // seed-points: happy path — wipes existing + creates fresh row at target
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void seedPoints_happyPath_wipesExistingAndCreatesFreshRow() {
        UserDailyProgress old1 = new UserDailyProgress();
        old1.setId("old1");
        old1.setPointsCounted(500);
        UserDailyProgress old2 = new UserDailyProgress();
        old2.setId("old2");
        old2.setPointsCounted(200);
        when(dailyProgressRepository.findByUserIdOrderByDateDesc("u1"))
                .thenReturn(List.of(old1, old2));

        SeedPointsRequest req = new SeedPointsRequest(4999);

        ResponseEntity<?> res = controller.seedPoints("u1", req);

        assertEquals(200, res.getStatusCode().value());
        // Old rows deleted
        verify(dailyProgressRepository).deleteAll(List.of(old1, old2));
        // Fresh row saved with target points
        ArgumentCaptor<UserDailyProgress> captor = ArgumentCaptor.forClass(UserDailyProgress.class);
        verify(dailyProgressRepository).save(captor.capture());
        UserDailyProgress saved = captor.getValue();
        assertEquals(4999, saved.getPointsCounted());
        assertEquals(100, saved.getLivesRemaining());
        assertEquals(0, saved.getQuestionsCounted());
        assertEquals(LocalDate.now(java.time.ZoneOffset.UTC), saved.getDate());

        // Response body — 4999 is in tier 2 (1000 .. 4999)
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) res.getBody();
        assertNotNull(body);
        assertEquals(4999, body.get("totalPoints"));
        assertEquals(2, body.get("tierLevel"));
        assertEquals("Người Tìm Kiếm", body.get("tierName"));
        assertEquals(2, body.get("wipedRows"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // seed-points: no existing rows → skips delete but still saves fresh row
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void seedPoints_noExistingRows_stillCreatesFreshRow() {
        when(dailyProgressRepository.findByUserIdOrderByDateDesc("u1"))
                .thenReturn(List.of());

        SeedPointsRequest req = new SeedPointsRequest(0);

        ResponseEntity<?> res = controller.seedPoints("u1", req);

        assertEquals(200, res.getStatusCode().value());
        // deleteAll should not be called when list is empty
        verify(dailyProgressRepository, never()).deleteAll(anyList());
        verify(dailyProgressRepository, never()).flush();
        // Fresh row with 0 points (tier 1)
        ArgumentCaptor<UserDailyProgress> captor = ArgumentCaptor.forClass(UserDailyProgress.class);
        verify(dailyProgressRepository).save(captor.capture());
        assertEquals(0, captor.getValue().getPointsCounted());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) res.getBody();
        assertEquals(1, body.get("tierLevel"));
        assertEquals("Tân Tín Hữu", body.get("tierName"));
        assertEquals(0, body.get("wipedRows"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // seed-points: seeding at tier 6 threshold (100000)
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void seedPoints_tier6Threshold_returnsTier6() {
        when(dailyProgressRepository.findByUserIdOrderByDateDesc("u1"))
                .thenReturn(List.of());

        SeedPointsRequest req = new SeedPointsRequest(100_000);
        ResponseEntity<?> res = controller.seedPoints("u1", req);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) res.getBody();
        assertEquals(6, body.get("tierLevel"));
        assertEquals("Sứ Đồ", body.get("tierName"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // seed-group: regression — both saves must persist a non-null created_at.
    // Bug: the second churchGroupRepository.save() merged a detached entity with
    // createdAt=null, hitting the NOT NULL constraint on church_groups.created_at.
    // Fix: explicitly set createdAt/updatedAt before the first save so the
    // second save's UPDATE carries the same value.
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void seedGroup_setsCreatedAtBeforeBothSaves() {
        User owner = new User();
        owner.setId("owner-id");
        owner.setEmail("owner@dev.local");
        when(userRepository.findByEmail("owner@dev.local")).thenReturn(Optional.of(owner));
        when(churchGroupRepository.findByGroupCode(anyString())).thenReturn(Optional.empty());
        when(churchGroupRepository.save(any(ChurchGroup.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> res = controller.seedGroup(Map.of(
                "ownerEmail", "owner@dev.local",
                "memberEmails", List.of(),
                "groupName", "Regression Group"
        ));

        assertEquals(200, res.getStatusCode().value());
        ArgumentCaptor<ChurchGroup> captor = ArgumentCaptor.forClass(ChurchGroup.class);
        verify(churchGroupRepository, atLeast(2)).save(captor.capture());
        for (ChurchGroup g : captor.getAllValues()) {
            assertNotNull(g.getCreatedAt(),
                    "createdAt must be non-null on every save() to avoid NOT NULL violation");
            assertNotNull(g.getUpdatedAt(),
                    "updatedAt must be non-null on every save()");
        }
    }
}
