package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * PCV-22 — Hội ý (design §3.2): đáp án của đội là phương án nhiều phiếu nhất (hòa → phương án được chọn
 * sớm nhất); đúng 100, cả đội cùng chọn đúng thêm 50.
 */
@ExtendWith(MockitoExtension.class)
class TeamConsensusTest {

    private static final String ROOM = "room-1";
    private static final String ROUND = "round-1";
    private static final LocalDateTime T0 = LocalDateTime.of(2026, 10, 13, 9, 0, 0);

    @Mock private RoomPlayerRepository players;
    @Mock private RoomAnswerRepository answers;
    @InjectMocks private TeamScoringService service;

    private final List<RoomPlayer> roster = new ArrayList<>();
    private final List<RoomAnswer> votes = new ArrayList<>();

    private void member(String id, RoomPlayer.Team team) {
        User u = new User();
        u.setId(id);
        RoomPlayer p = new RoomPlayer("rp-" + id, null, u, id);
        p.setTeam(team);
        roster.add(p);
    }

    private void vote(String id, int idx, int secondsAfterStart) {
        RoomAnswer a = new RoomAnswer();
        a.setUserId(id);
        a.setAnswerIndex(idx);
        a.setAnsweredAt(T0.plusSeconds(secondsAfterStart));
        a.setResponseMs(secondsAfterStart * 1000);
        votes.add(a);
    }

    /** Review: room_answers.answered_at chỉ chính xác đến giây — hai phiếu cùng giây xét thời gian trả lời (ms). */
    @Test
    void tieWithinTheSameSecond_goesToTheFasterVote() {
        member("b1", RoomPlayer.Team.B);
        member("b2", RoomPlayer.Team.B);
        RoomAnswer slow = new RoomAnswer();
        slow.setUserId("b1");
        slow.setAnswerIndex(0);
        slow.setAnsweredAt(T0.plusSeconds(3));
        slow.setResponseMs(3900);
        RoomAnswer fast = new RoomAnswer();
        fast.setUserId("b2");
        fast.setAnswerIndex(1);
        fast.setAnsweredAt(T0.plusSeconds(3));
        fast.setResponseMs(3100);
        votes.add(slow);
        votes.add(fast);

        TeamScoringService.ConsensusResult r = run(1);

        assertEquals(1, r.answerB, "phương án 1 được chọn trước (3,1 giây so với 3,9 giây)");
    }

    private TeamScoringService.ConsensusResult run(int correctIndex) {
        when(players.findByRoomId(ROOM)).thenReturn(roster);
        when(answers.findByRoundId(ROUND)).thenReturn(votes);
        return service.consensus(ROOM, ROUND, correctIndex);
    }

    @Test
    void majorityDecides_correctEarns100() {
        member("a1", RoomPlayer.Team.A); member("a2", RoomPlayer.Team.A); member("a3", RoomPlayer.Team.A);
        vote("a1", 1, 2); vote("a2", 1, 3); vote("a3", 2, 1);

        TeamScoringService.ConsensusResult r = run(1);

        assertEquals(1, r.answerA);
        assertEquals(100, r.pointsA);
        assertFalse(r.unanimousA);
    }

    @Test
    void wholeTeamOnTheCorrectOption_earns150() {
        member("a1", RoomPlayer.Team.A); member("a2", RoomPlayer.Team.A);
        vote("a1", 3, 2); vote("a2", 3, 4);

        TeamScoringService.ConsensusResult r = run(3);

        assertEquals(150, r.pointsA);
        assertTrue(r.unanimousA);
    }

    @Test
    void tie_goesToTheOptionChosenFirst() {
        member("b1", RoomPlayer.Team.B); member("b2", RoomPlayer.Team.B);
        vote("b1", 0, 5); vote("b2", 2, 1);

        TeamScoringService.ConsensusResult r = run(0);

        assertEquals(2, r.answerB, "hòa 1–1: phương án 2 được chọn trước");
        assertEquals(0, r.pointsB);
    }

    @Test
    void nobodyOnTheTeamAnswered_noTeamAnswer() {
        member("a1", RoomPlayer.Team.A); member("b1", RoomPlayer.Team.B);
        vote("b1", 1, 1);

        TeamScoringService.ConsensusResult r = run(1);

        assertNull(r.answerA);
        assertEquals(0, r.pointsA);
        assertEquals(150, r.pointsB, "đội một người chọn đúng = cả đội cùng đúng");
    }

    @Test
    void memberWhoLeftDoesNotBreakUnanimity() {
        member("a1", RoomPlayer.Team.A); member("a2", RoomPlayer.Team.A);
        roster.get(1).setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        vote("a1", 2, 1);

        TeamScoringService.ConsensusResult r = run(2);

        assertTrue(r.unanimousA);
        assertEquals(150, r.pointsA);
    }
}
