package com.biblequiz.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.service.TeamScoringService;
import com.biblequiz.modules.user.entity.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TeamScoringServiceTest {

    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomAnswerRepository roomAnswerRepository;
    @InjectMocks private TeamScoringService service;

    private static final String ROOM = "room-1";
    private static final String ROUND = "round-1";

    private RoomPlayer createPlayer(String userId, RoomPlayer.Team team, int score) {
        User u = new User(); u.setId(userId); u.setName(userId);
        RoomPlayer p = new RoomPlayer(); p.setUser(u); p.setTeam(team); p.setScore(score);
        return p;
    }

    private RoomAnswer createAnswer(String userId, boolean correct) {
        RoomAnswer a = new RoomAnswer(); a.setUserId(userId); a.setIsCorrect(correct);
        return a;
    }

    @Test
    void teamScore_isRoundedAverageOfActiveMembers_plusFiftyPerAllCorrectRound() {
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(List.of(
                createPlayer("a1", RoomPlayer.Team.A, 100),
                createPlayer("a2", RoomPlayer.Team.A, 151),
                createPlayer("b1", RoomPlayer.Team.B, 200)
        ));

        var scores = service.calculateTeamScores(ROOM, 2, 0);

        assertEquals(126 + 100, scores.teamA, "TB 125,5 → 126, cộng 2 lần cả đội đúng");
        assertEquals(200, scores.teamB);
    }

    @Test
    void biggerTeam_doesNotWinJustByHavingMorePlayers() {
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(List.of(
                createPlayer("a1", RoomPlayer.Team.A, 100), createPlayer("a2", RoomPlayer.Team.A, 100),
                createPlayer("a3", RoomPlayer.Team.A, 100),
                createPlayer("b1", RoomPlayer.Team.B, 120), createPlayer("b2", RoomPlayer.Team.B, 120)));

        var scores = service.calculateTeamScores(ROOM, 0, 0);

        assertTrue(scores.teamB > scores.teamA, "tổng A = 300 > B = 240, nhưng trung bình B hơn");
    }

    @Test
    void membersWhoLeft_areNotAveraged_unlessTheWholeTeamLeft() {
        RoomPlayer a1 = createPlayer("a1", RoomPlayer.Team.A, 300);
        RoomPlayer a2 = createPlayer("a2", RoomPlayer.Team.A, 0);
        a2.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        RoomPlayer b1 = createPlayer("b1", RoomPlayer.Team.B, 100);
        b1.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        RoomPlayer b2 = createPlayer("b2", RoomPlayer.Team.B, 300);
        b2.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(List.of(a1, a2, b1, b2));

        var scores = service.calculateTeamScores(ROOM, 0, 0);

        assertEquals(300, scores.teamA);
        assertEquals(200, scores.teamB, "cả đội đã rời ⇒ trung bình tất cả");
    }

    @Test
    void determineWinner_teamAWins() {
        assertEquals("A", service.determineWinner(new TeamScoringService.TeamScores(300, 200)));
    }

    @Test
    void determineWinner_teamBWins() {
        assertEquals("B", service.determineWinner(new TeamScoringService.TeamScores(200, 300)));
    }

    @Test
    void determineWinner_tie() {
        assertEquals("TIE", service.determineWinner(new TeamScoringService.TeamScores(250, 250)));
    }

    @Test
    void allCorrectRound_isTeamLevel_noIndividualBonus() {
        RoomPlayer a1 = createPlayer("a1", RoomPlayer.Team.A, 100);
        RoomPlayer a2 = createPlayer("a2", RoomPlayer.Team.A, 100);
        RoomPlayer b1 = createPlayer("b1", RoomPlayer.Team.B, 100);

        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.A)).thenReturn(new ArrayList<>(List.of(a1, a2)));
        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.B)).thenReturn(new ArrayList<>(List.of(b1)));
        when(roomAnswerRepository.findByRoundId(ROUND)).thenReturn(List.of(
                createAnswer("a1", true), createAnswer("a2", true), createAnswer("b1", false)));

        var result = service.processPerfectRound(ROOM, ROUND);

        assertTrue(result.teamAPerfect);
        assertFalse(result.teamBPerfect);
        assertEquals(100, a1.getScore(), "thưởng cả đội không cộng vào điểm cá nhân");
        assertEquals(100, a2.getScore());
    }

    @Test
    void memberWhoLeft_doesNotBlockAllCorrect() {
        RoomPlayer a1 = createPlayer("a1", RoomPlayer.Team.A, 100);
        RoomPlayer a2 = createPlayer("a2", RoomPlayer.Team.A, 100);
        a2.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.A)).thenReturn(new ArrayList<>(List.of(a1, a2)));
        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.B)).thenReturn(List.of());
        when(roomAnswerRepository.findByRoundId(ROUND)).thenReturn(List.of(createAnswer("a1", true)));

        assertTrue(service.processPerfectRound(ROOM, ROUND).teamAPerfect);
    }

    @Test
    void perfectRound_onePlayerWrong_noBonus() {
        RoomPlayer a1 = createPlayer("a1", RoomPlayer.Team.A, 100);
        RoomPlayer a2 = createPlayer("a2", RoomPlayer.Team.A, 100);

        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.A)).thenReturn(new ArrayList<>(List.of(a1, a2)));
        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.B)).thenReturn(List.of());
        when(roomAnswerRepository.findByRoundId(ROUND)).thenReturn(List.of(
                createAnswer("a1", true), createAnswer("a2", false)));

        var result = service.processPerfectRound(ROOM, ROUND);

        assertFalse(result.teamAPerfect);
        assertEquals(100, a1.getScore()); // no bonus
    }

    // ── Tie-break tests ──

    @Test
    void tieBreak_scoreWins() {
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(List.of(
                createPlayer("a1", RoomPlayer.Team.A, 300),
                createPlayer("b1", RoomPlayer.Team.B, 200)));

        var result = service.determineWinnerWithTieBreak(ROOM, 0, 0);
        assertEquals("A", result.winningTeam);
        assertEquals("SCORE", result.reason);
    }

    @Test
    void tieBreak_sameScore_moreAllCorrectRoundsWin() {
        // A: 200 + 50×1 = 250; B: 150 + 50×2 = 250 → bằng điểm, B nhiều lần cả đội đúng hơn.
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(List.of(
                createPlayer("a1", RoomPlayer.Team.A, 200),
                createPlayer("b1", RoomPlayer.Team.B, 150)));

        var result = service.determineWinnerWithTieBreak(ROOM, 1, 2);
        assertEquals("B", result.winningTeam);
        assertEquals("PERFECT_ROUNDS", result.reason);
    }

    @Test
    void tieBreak_sameScoreSamePerfect_speedWins() {
        RoomPlayer a1 = createPlayer("a1", RoomPlayer.Team.A, 200);
        a1.setAverageReactionTime(3000.0); a1.setTotalAnswered(10);
        RoomPlayer b1 = createPlayer("b1", RoomPlayer.Team.B, 200);
        b1.setAverageReactionTime(5000.0); b1.setTotalAnswered(10);
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(List.of(a1, b1));

        var result = service.determineWinnerWithTieBreak(ROOM, 2, 2);
        assertEquals("A", result.winningTeam); // A faster
        assertEquals("SPEED", result.reason);
    }

    @Test
    void tieBreak_allEqual_realTie() {
        RoomPlayer a1 = createPlayer("a1", RoomPlayer.Team.A, 200);
        a1.setAverageReactionTime(4000.0); a1.setTotalAnswered(10);
        RoomPlayer b1 = createPlayer("b1", RoomPlayer.Team.B, 200);
        b1.setAverageReactionTime(4000.0); b1.setTotalAnswered(10);
        when(roomPlayerRepository.findByRoomId(ROOM)).thenReturn(List.of(a1, b1));

        var result = service.determineWinnerWithTieBreak(ROOM, 2, 2);
        assertEquals("TIE", result.winningTeam);
        assertEquals("TIE", result.reason);
    }

    @Test
    void emptyTeam_noPerfectRound() {
        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.A)).thenReturn(List.of());
        when(roomPlayerRepository.findByRoomIdAndTeam(ROOM, RoomPlayer.Team.B)).thenReturn(List.of());
        when(roomAnswerRepository.findByRoundId(ROUND)).thenReturn(List.of());

        var result = service.processPerfectRound(ROOM, ROUND);

        assertFalse(result.teamAPerfect);
        assertFalse(result.teamBPerfect);
    }
}
