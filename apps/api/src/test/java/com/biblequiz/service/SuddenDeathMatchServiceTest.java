package com.biblequiz.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.service.RoomStateService;
import com.biblequiz.modules.room.service.SuddenDeathMatchService;
import com.biblequiz.modules.user.entity.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SuddenDeathMatchServiceTest {

    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomAnswerRepository roomAnswerRepository;
    @Mock private RoomStateService roomStateService;
    @InjectMocks private SuddenDeathMatchService service;

    private static final String ROOM = "room-1";
    private static final String ROUND = "round-1";

    private RoomPlayer createPlayer(String userId, String name) {
        User u = new User(); u.setId(userId); u.setName(name);
        RoomPlayer p = new RoomPlayer(); p.setUser(u); p.setUsername(name);
        p.setPlayerStatus(RoomPlayer.PlayerStatus.SPECTATOR);
        p.setWinningStreak(0);
        p.setJoinedAt(LocalDateTime.now());
        return p;
    }

    @BeforeEach
    void setUp() {
        lenient().when(roomPlayerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(roomPlayerRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ── initializeQueue ──

    @Test
    void initializeQueue_setsAllSpectatorAndCreatesQueue() {
        RoomPlayer p1 = createPlayer("u1", "P1"); p1.setJoinedAt(LocalDateTime.of(2026, 1, 1, 10, 0));
        RoomPlayer p2 = createPlayer("u2", "P2"); p2.setJoinedAt(LocalDateTime.of(2026, 1, 1, 10, 1));
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(new ArrayList<>(List.of(p2, p1)));

        service.initializeQueue(ROOM);

        // PCV-15: hàng chờ xáo ngẫu nhiên (không còn theo thứ tự vào phòng).
        verify(roomStateService).setSdQueue(eq(ROOM), argThat(q -> q.size() == 2 && q.containsAll(List.of("u1", "u2"))));
        assertEquals(RoomPlayer.PlayerStatus.SPECTATOR, p1.getPlayerStatus());
    }

    // ── startNextMatch ──

    @Test
    void startNextMatch_firstMatch_takesTwoFromQueue() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn(null);
        when(roomStateService.getSdQueue(ROOM)).thenReturn(new ArrayList<>(List.of("u1", "u2", "u3")));
        // After setSdChallenger("u2"), getSdChallenger should return "u2"
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");
        when(roomPlayerRepository.findByRoomIdAndUserId(eq(ROOM), anyString()))
                .thenAnswer(inv -> Optional.of(createPlayer(inv.getArgument(1), "P")));

        var match = service.startNextMatch(ROOM);

        assertNotNull(match);
        assertEquals("u1", match.championId);
        assertEquals("u2", match.challengerId);
        verify(roomStateService).setSdChampion(ROOM, "u1");
        verify(roomStateService).setSdChallenger(ROOM, "u2");
    }

    @Test
    void startNextMatch_subsequent_championStays() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdQueue(ROOM)).thenReturn(new ArrayList<>(List.of("u3")));
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u3");
        when(roomPlayerRepository.findByRoomIdAndUserId(eq(ROOM), anyString()))
                .thenAnswer(inv -> Optional.of(createPlayer(inv.getArgument(1), "P")));

        var match = service.startNextMatch(ROOM);

        assertNotNull(match);
        assertEquals("u1", match.championId);
        assertEquals("u3", match.challengerId);
    }

    @Test
    void startNextMatch_emptyQueue_returnsNull() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdQueue(ROOM)).thenReturn(new ArrayList<>());

        var match = service.startNextMatch(ROOM);

        assertNull(match);
    }

    // ── processRound ──

    @Test
    void processRound_championCorrectChallengerWrong_championWins() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");
        RoomPlayer champ = createPlayer("u1", "Champ"); champ.setWinningStreak(2);
        RoomPlayer chall = createPlayer("u2", "Chall");
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u1")).thenReturn(Optional.of(champ));
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u2")).thenReturn(Optional.of(chall));

        RoomAnswer a1 = new RoomAnswer(); a1.setIsCorrect(true);
        RoomAnswer a2 = new RoomAnswer(); a2.setIsCorrect(false);
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u1")).thenReturn(Optional.of(a1));
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u2")).thenReturn(Optional.of(a2));

        var result = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.MATCH_ENDED, result.outcome);
        assertEquals("u1", result.winner.userId);
        assertEquals("u2", result.loser.userId);
    }

    @Test
    void processRound_challengerCorrectChampionWrong_challengerWins() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");
        RoomPlayer champ = createPlayer("u1", "Champ");
        RoomPlayer chall = createPlayer("u2", "Chall");
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u1")).thenReturn(Optional.of(champ));
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u2")).thenReturn(Optional.of(chall));

        RoomAnswer a1 = new RoomAnswer(); a1.setIsCorrect(false);
        RoomAnswer a2 = new RoomAnswer(); a2.setIsCorrect(true);
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u1")).thenReturn(Optional.of(a1));
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u2")).thenReturn(Optional.of(a2));

        var result = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.MATCH_ENDED, result.outcome);
        assertEquals("u2", result.winner.userId);
    }

    @Test
    void processRound_bothCorrect_continues() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");

        RoomAnswer a1 = new RoomAnswer(); a1.setIsCorrect(true);
        RoomAnswer a2 = new RoomAnswer(); a2.setIsCorrect(true);
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u1")).thenReturn(Optional.of(a1));
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u2")).thenReturn(Optional.of(a2));

        var result = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.CONTINUE, result.outcome);
    }

    @Test
    void processRound_bothWrong_continues() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");

        RoomAnswer a1 = new RoomAnswer(); a1.setIsCorrect(false);
        RoomAnswer a2 = new RoomAnswer(); a2.setIsCorrect(false);
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u1")).thenReturn(Optional.of(a1));
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u2")).thenReturn(Optional.of(a2));

        var result = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.CONTINUE, result.outcome);
    }

    @Test
    void processRound_noChampion_returnsNoMatch() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn(null);

        var result = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.NO_MATCH, result.outcome);
    }

    // ── assignFinalRanks ──

    @Test
    void assignFinalRanks_sortsByMatchesWonDescending() {
        // PCV-15: xếp theo số trận thắng (trước: chuỗi hiện tại — người thua về 0 nên hạng gần như ngẫu nhiên).
        RoomPlayer p1 = createPlayer("u1", "P1"); p1.setMatchesWon(3);
        RoomPlayer p2 = createPlayer("u2", "P2"); p2.setMatchesWon(5);
        RoomPlayer p3 = createPlayer("u3", "P3"); p3.setMatchesWon(1);
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(new ArrayList<>(List.of(p1, p2, p3)));

        service.assignFinalRanks(ROOM);

        assertEquals(1, p2.getFinalRank()); // 5 trận thắng = hạng 1
        assertEquals(2, p1.getFinalRank());
        assertEquals(3, p3.getFinalRank());
    }

    // ── elapsedMs + max continues ──

    @Test
    void processRound_bothCorrect_fasterWins_above200ms() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");
        RoomPlayer champ = createPlayer("u1", "Champ");
        RoomPlayer chall = createPlayer("u2", "Chall");
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u1")).thenReturn(Optional.of(champ));
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u2")).thenReturn(Optional.of(chall));

        RoomAnswer a1 = new RoomAnswer(); a1.setIsCorrect(true); a1.setResponseMs(2000);
        RoomAnswer a2 = new RoomAnswer(); a2.setIsCorrect(true); a2.setResponseMs(5000);
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u1")).thenReturn(Optional.of(a1));
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u2")).thenReturn(Optional.of(a2));

        var result = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.MATCH_ENDED, result.outcome);
        assertEquals("u1", result.winner.userId); // faster
    }

    @Test
    void processRound_bothCorrect_closeTimes_continues() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");

        RoomAnswer a1 = new RoomAnswer(); a1.setIsCorrect(true); a1.setResponseMs(3000);
        RoomAnswer a2 = new RoomAnswer(); a2.setIsCorrect(true); a2.setResponseMs(3100); // diff=100ms < 200
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u1")).thenReturn(Optional.of(a1));
        when(roomAnswerRepository.findByRoundIdAndUserId(ROUND, "u2")).thenReturn(Optional.of(a2));

        var result = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.CONTINUE, result.outcome);
    }

    @Test
    void processRound_maxContinues_championAdvantage() {
        when(roomStateService.getSdChampion(ROOM)).thenReturn("u1");
        when(roomStateService.getSdChallenger(ROOM)).thenReturn("u2");
        RoomPlayer champ = createPlayer("u1", "Champ");
        RoomPlayer chall = createPlayer("u2", "Chall");
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u1")).thenReturn(Optional.of(champ));
        when(roomPlayerRepository.findByRoomIdAndUserId(ROOM, "u2")).thenReturn(Optional.of(chall));

        // Simulate 3 continues (both wrong each time)
        RoomAnswer wrong1 = new RoomAnswer(); wrong1.setIsCorrect(false);
        RoomAnswer wrong2 = new RoomAnswer(); wrong2.setIsCorrect(false);
        when(roomAnswerRepository.findByRoundIdAndUserId(anyString(), eq("u1"))).thenReturn(Optional.of(wrong1));
        when(roomAnswerRepository.findByRoundIdAndUserId(anyString(), eq("u2"))).thenReturn(Optional.of(wrong2));

        // Round 1, 2: CONTINUE
        var r1 = service.processRound(ROOM, "r1");
        assertEquals(SuddenDeathMatchService.MatchOutcome.CONTINUE, r1.outcome);
        var r2 = service.processRound(ROOM, "r2");
        assertEquals(SuddenDeathMatchService.MatchOutcome.CONTINUE, r2.outcome);
        // Round 3: max reached → champion wins
        var r3 = service.processRound(ROOM, "r3");
        assertEquals(SuddenDeathMatchService.MatchOutcome.MATCH_ENDED, r3.outcome);
        assertEquals("u1", r3.winner.userId); // champion advantage
    }

    // ── helpers ──

    @Test
    void hasNextChallenger_emptyQueue_false() {
        when(roomStateService.getSdQueue(ROOM)).thenReturn(new ArrayList<>());
        assertFalse(service.hasNextChallenger(ROOM));
    }

    @Test
    void hasNextChallenger_nonEmptyQueue_true() {
        when(roomStateService.getSdQueue(ROOM)).thenReturn(new ArrayList<>(List.of("u3")));
        assertTrue(service.hasNextChallenger(ROOM));
    }
}
