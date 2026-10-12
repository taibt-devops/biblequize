package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * PCV-15 — Đấu vương xoay vòng (design §2.4): thua về cuối hàng; kết thúc khi mọi người đã đấu ≥ 1 trận
 * và vua có chuỗi ≥ 3 (≤ 5 người) hoặc 4 (đông hơn); xếp hạng: trận thắng → chuỗi dài nhất → câu đúng → tốc độ.
 */
@ExtendWith(MockitoExtension.class)
class SuddenDeathRotationTest {

    private static final String ROOM = "room-1";
    private static final String ROUND = "round-1";

    @Mock private RoomPlayerRepository players;
    @Mock private RoomAnswerRepository answers;
    @Mock private RoomStateService state;
    @InjectMocks private SuddenDeathMatchService service;

    private final Map<String, RoomPlayer> byId = new HashMap<>();
    private List<String> queue;

    private RoomPlayer player(String id) {
        User u = new User();
        u.setId(id);
        RoomPlayer p = new RoomPlayer();
        p.setUser(u);
        p.setUsername(id.toUpperCase());
        p.setPlayerStatus(RoomPlayer.PlayerStatus.SPECTATOR);
        byId.put(id, p);
        return p;
    }

    private RoomAnswer answer(boolean correct) {
        RoomAnswer a = new RoomAnswer();
        a.setIsCorrect(correct);
        a.setResponseMs(3000);
        return a;
    }

    @BeforeEach
    void setUp() {
        lenient().when(players.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(players.saveAll(anyList())).thenAnswer(i -> i.getArgument(0));
        lenient().when(players.findByRoomIdAndUserId(eq(ROOM), anyString()))
                .thenAnswer(i -> Optional.ofNullable(byId.get(i.<String>getArgument(1))));
        lenient().when(players.findByRoomId(ROOM)).thenAnswer(i -> new ArrayList<>(byId.values()));
        queue = new ArrayList<>();
        lenient().when(state.getSdQueue(ROOM)).thenAnswer(i -> new ArrayList<>(queue));
        lenient().doAnswer(i -> { queue = new ArrayList<>(i.<List<String>>getArgument(1)); return null; })
                .when(state).setSdQueue(eq(ROOM), anyList());
    }

    @Test
    void initializeQueue_putsEveryoneInLine_andResetsStats() {
        RoomPlayer a = player("a");
        a.setMatchesWon(4);
        a.setBestStreak(3);
        a.setMatchesPlayed(5);
        player("b");
        player("c");

        service.initializeQueue(ROOM);

        assertEquals(Set.of("a", "b", "c"), Set.copyOf(queue));
        assertEquals(0, a.getMatchesWon());
        assertEquals(0, a.getBestStreak());
        assertEquals(0, a.getMatchesPlayed());
        assertTrue(byId.values().stream().allMatch(p -> p.getPlayerStatus() == RoomPlayer.PlayerStatus.SPECTATOR));
    }

    @Test
    void loserGoesToTheBackOfTheLine_winnerCountsTheWin() {
        RoomPlayer king = player("a");
        king.setWinningStreak(1);
        king.setMatchesWon(1);
        king.setMatchesPlayed(1);
        king.setBestStreak(1);
        king.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        RoomPlayer challenger = player("b");
        challenger.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        player("c");
        player("d");
        queue.addAll(List.of("c", "d"));
        when(state.getSdChampion(ROOM)).thenReturn("a");
        when(state.getSdChallenger(ROOM)).thenReturn("b");
        when(answers.findByRoundIdAndUserId(ROUND, "a")).thenReturn(Optional.of(answer(true)));
        when(answers.findByRoundIdAndUserId(ROUND, "b")).thenReturn(Optional.of(answer(false)));

        SuddenDeathMatchService.MatchResult r = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.MATCH_ENDED, r.outcome);
        assertEquals(List.of("c", "d", "b"), queue, "người thua về cuối hàng");
        assertEquals(2, king.getWinningStreak());
        assertEquals(2, king.getMatchesWon());
        assertEquals(2, king.getMatchesPlayed());
        assertEquals(2, king.getBestStreak());
        assertEquals(1, challenger.getMatchesPlayed());
        assertEquals(0, challenger.getMatchesWon());
        assertEquals(RoomPlayer.PlayerStatus.SPECTATOR, challenger.getPlayerStatus());
    }

    @Test
    void gameEnds_whenEveryoneHasPlayed_andKingStreakReachesThree() {
        for (String id : List.of("a", "b", "c", "d")) player(id).setMatchesPlayed(1);
        byId.get("a").setWinningStreak(3);
        when(state.getSdChampion(ROOM)).thenReturn("a");

        assertTrue(service.shouldEndAfterMatch(ROOM));

        byId.get("a").setWinningStreak(2);
        assertFalse(service.shouldEndAfterMatch(ROOM));
    }

    @Test
    void gameContinues_whileSomeoneHasNotPlayed() {
        for (String id : List.of("a", "b", "c")) player(id).setMatchesPlayed(1);
        player("d"); // chưa tới lượt
        byId.get("a").setWinningStreak(5);
        when(state.getSdChampion(ROOM)).thenReturn("a");

        assertFalse(service.shouldEndAfterMatch(ROOM));
    }

    @Test
    void moreThanFivePlayers_needAStreakOfFour() {
        for (String id : List.of("a", "b", "c", "d", "e", "f")) player(id).setMatchesPlayed(1);
        when(state.getSdChampion(ROOM)).thenReturn("a");
        byId.get("a").setWinningStreak(3);
        assertFalse(service.shouldEndAfterMatch(ROOM));
        byId.get("a").setWinningStreak(4);
        assertTrue(service.shouldEndAfterMatch(ROOM));
    }

    @Test
    void playersWhoLeft_areSkippedInLine_andNotRequiredToPlay() {
        RoomPlayer gone = player("gone");
        gone.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        player("c");
        player("a").setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        queue.addAll(List.of("gone", "c"));
        when(state.getSdChampion(ROOM)).thenReturn("a");
        when(state.getSdChallenger(ROOM)).thenReturn("c");

        SuddenDeathMatchService.MatchInfo m = service.startNextMatch(ROOM);

        assertEquals("c", m.challengerId);
        ArgumentCaptor<String> challenger = ArgumentCaptor.forClass(String.class);
        verify(state).setSdChallenger(eq(ROOM), challenger.capture());
        assertEquals("c", challenger.getValue());
    }

    @Test
    void finalRanks_winsThenBestStreakThenCorrectThenSpeed() {
        RoomPlayer a = player("a"); a.setMatchesWon(4); a.setBestStreak(2);
        RoomPlayer b = player("b"); b.setMatchesWon(4); b.setBestStreak(3);
        RoomPlayer c = player("c"); c.setMatchesWon(1); c.setBestStreak(1); c.setCorrectAnswers(6); c.setTotalAnswered(6); c.setAverageReactionTime(2000.0);
        RoomPlayer d = player("d"); d.setMatchesWon(1); d.setBestStreak(1); d.setCorrectAnswers(6); d.setTotalAnswered(6); d.setAverageReactionTime(3000.0);
        RoomPlayer e = player("e");
        RoomPlayer f = player("f"); f.setMatchesWon(9); f.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);

        service.assignFinalRanks(ROOM);

        assertEquals(1, b.getFinalRank(), "cùng số trận thắng ⇒ chuỗi dài hơn");
        assertEquals(2, a.getFinalRank());
        assertEquals(3, c.getFinalRank(), "bằng nhau ⇒ nhanh hơn");
        assertEquals(4, d.getFinalRank());
        assertEquals(5, e.getFinalRank());
        assertEquals(6, f.getFinalRank(), "người bỏ trận xếp cuối");
    }

    // ── Review: người đã rời không bao giờ quay lại ACTIVE ──

    @Test
    void championWhoLeft_isReplacedAtTheNextMatch_andStaysLeft() {
        RoomPlayer a = player("a");
        a.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        player("b");
        player("c");
        queue.addAll(List.of("b", "c"));
        when(state.getSdChampion(ROOM)).thenReturn("a");
        when(state.getSdChallenger(ROOM)).thenReturn("c");

        service.startNextMatch(ROOM);

        verify(state).setSdChampion(ROOM, "b");
        verify(state).setSdChallenger(ROOM, "c");
        assertEquals(RoomPlayer.PlayerStatus.LEFT, a.getPlayerStatus(), "vua đã rời không được đưa lại");
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, byId.get("b").getPlayerStatus());
    }

    @Test
    void duelistWhoLeft_losesTheMatchRightAway_andStaysLeft() {
        RoomPlayer king = player("a");
        king.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        RoomPlayer gone = player("b");
        gone.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        when(state.getSdChampion(ROOM)).thenReturn("a");
        when(state.getSdChallenger(ROOM)).thenReturn("b");
        lenient().when(answers.findByRoundIdAndUserId(ROUND, "a")).thenReturn(Optional.of(answer(false)));

        SuddenDeathMatchService.MatchResult r = service.processRound(ROOM, ROUND);

        assertEquals(SuddenDeathMatchService.MatchOutcome.MATCH_ENDED, r.outcome, "không bắt người còn lại chờ người đã rời");
        assertEquals("a", r.winner.userId);
        assertEquals(RoomPlayer.PlayerStatus.LEFT, gone.getPlayerStatus());
        assertFalse(queue.contains("b"), "người đã rời không vào lại hàng chờ");
    }

    @Test
    void absentKingDoesNotWin_whenTheChallengerMisses() {
        RoomPlayer gone = player("a");
        gone.setPlayerStatus(RoomPlayer.PlayerStatus.LEFT);
        gone.setWinningStreak(2);
        RoomPlayer challenger = player("b");
        challenger.setPlayerStatus(RoomPlayer.PlayerStatus.ACTIVE);
        when(state.getSdChampion(ROOM)).thenReturn("a");
        when(state.getSdChallenger(ROOM)).thenReturn("b");
        lenient().when(answers.findByRoundIdAndUserId(ROUND, "b")).thenReturn(Optional.of(answer(false)));

        SuddenDeathMatchService.MatchResult r = service.processRound(ROOM, ROUND);

        assertEquals("b", r.winner.userId, "vua đã rời thua ngay");
        assertEquals(RoomPlayer.PlayerStatus.LEFT, gone.getPlayerStatus());
        assertEquals(RoomPlayer.PlayerStatus.ACTIVE, challenger.getPlayerStatus());
    }
}
