package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** PCV-2 — dữ liệu công bố sau mỗi câu (design §1.3, §1.9). */
@ExtendWith(MockitoExtension.class)
class RoundResultBuilderTest {

    @Mock private RoomAnswerRepository answerRepository;
    @Mock private RoomPlayerRepository playerRepository;
    @Mock private RoomService roomService;

    private final Room room = new Room();
    private final RoomRound round = new RoomRound();
    private Question question;

    private RoomPlayer player(String id, String name) {
        User u = new User();
        u.setId(id);
        u.setName(name);
        return new RoomPlayer("p-" + id, room, u, name);
    }

    private RoomAnswer answer(String userId, int idx, boolean correct, int points) {
        return new RoomAnswer("a-" + userId, round, userId, idx, correct, 3000, points);
    }

    @BeforeEach
    void setUp() {
        room.setId("room-1");
        round.setId("round-1");
        question = new Question();
        question.setId("q1");
        question.setOptions(List.of("A", "B", "C", "D"));
        question.setCorrectAnswer(List.of(2));
        question.setBook("Genesis");
        question.setChapter(27);
        question.setVerseStart(5);
        question.setVerseEnd(8);
        question.setExplanation("Rê-bê-ca nghe Y-sác nói với Ê-sau.");
        lenient().when(roomService.getRoomLeaderboard("room-1")).thenReturn(List.of());
    }

    @Test
    void countsAnswersPerOption_andMarksNonAnswerers() {
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(
                player("u1", "An"), player("u2", "Bình"), player("u3", "Châu")));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of(
                answer("u1", 2, true, 140), answer("u2", 0, false, 0)));

        WebSocketMessage.RoundEndData data = new RoundResultBuilder(answerRepository, playerRepository, roomService)
                .build("room-1", "round-1", question);

        assertEquals(2, data.correctIndex);
        assertArrayEquals(new int[]{1, 0, 1, 0}, data.answerCounts);
        assertEquals(3, data.results.size());
        WebSocketMessage.RoundEndData.PlayerResult an = data.results.stream().filter(r -> r.playerId.equals("u1")).findFirst().orElseThrow();
        assertTrue(an.answered);
        assertTrue(an.isCorrect);
        assertEquals(140, an.pointsEarned);
        WebSocketMessage.RoundEndData.PlayerResult chau = data.results.stream().filter(r -> r.playerId.equals("u3")).findFirst().orElseThrow();
        assertFalse(chau.answered);
        assertFalse(chau.isCorrect);
    }

    @Test
    void carriesExplanationAndReference() {
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of());
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of());

        WebSocketMessage.RoundEndData data = new RoundResultBuilder(answerRepository, playerRepository, roomService)
                .build("room-1", "round-1", question);

        assertEquals("Rê-bê-ca nghe Y-sác nói với Ê-sau.", data.explanation);
        assertEquals("Genesis", data.reference.book);
        assertEquals(27, data.reference.chapter);
        assertEquals(5, data.reference.verseStart);
        assertEquals(8, data.reference.verseEnd);
    }

    @Test
    void outOfRangeAnswerIndex_isIgnoredInCounts_andNoReferenceWithoutBook() {
        question.setBook("");
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(player("u1", "An")));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of(answer("u1", 7, false, 0)));

        WebSocketMessage.RoundEndData data = new RoundResultBuilder(answerRepository, playerRepository, roomService)
                .build("room-1", "round-1", question);

        assertArrayEquals(new int[]{0, 0, 0, 0}, data.answerCounts);
        assertNull(data.reference);
    }

    @Test
    void closeRound_resetsStreakOfActivePlayersWhoDidNotAnswer() {
        RoomPlayer answered = player("u1", "An");
        answered.setAnswerStreak(3);
        RoomPlayer silent = player("u2", "Bình");
        silent.setAnswerStreak(2);
        RoomPlayer out = player("u3", "Châu");
        out.setAnswerStreak(1);
        out.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(answered, silent, out));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of(answer("u1", 2, true, 140)));

        new RoundResultBuilder(answerRepository, playerRepository, roomService).closeRound("room-1", "round-1");

        assertEquals(3, answered.getAnswerStreak());
        assertEquals(0, silent.getAnswerStreak(), "không trả lời = mất chuỗi (design §2.1)");
        assertEquals(1, out.getAnswerStreak(), "người không còn trong cuộc giữ nguyên");
    }

    @Test
    void results_carryCurrentStreak() {
        RoomPlayer an = player("u1", "An");
        an.setAnswerStreak(3);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(an));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of(answer("u1", 2, true, 160)));

        WebSocketMessage.RoundEndData data = new RoundResultBuilder(answerRepository, playerRepository, roomService)
                .build("room-1", "round-1", question);

        assertEquals(3, data.results.get(0).streak);
    }

    @Test
    void ghostAnswers_areLeftOutOfCountsAndResults() {
        RoomPlayer alive = player("u1", "An");
        RoomPlayer ghost = player("u2", "Bình");
        ghost.setPlayerStatus(RoomPlayer.PlayerStatus.ELIMINATED);
        RoomAnswer ghostAnswer = answer("u2", 2, true, 0);
        ghostAnswer.setGhost(true);
        when(playerRepository.findByRoomId("room-1")).thenReturn(List.of(alive, ghost));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of(answer("u1", 0, false, 0), ghostAnswer));

        WebSocketMessage.RoundEndData data = new RoundResultBuilder(answerRepository, playerRepository, roomService)
                .build("room-1", "round-1", question);

        assertArrayEquals(new int[]{1, 0, 0, 0}, data.answerCounts, "số người chọn chỉ đếm người còn trong cuộc");
        WebSocketMessage.RoundEndData.PlayerResult g = data.results.stream().filter(r -> r.playerId.equals("u2")).findFirst().orElseThrow();
        assertFalse(g.answered);
    }

    @Test
    void revealPause_isLongerWhenThereIsAnExplanation() {
        assertEquals(7_000, RoundResultBuilder.revealPauseMs(question));
        question.setExplanation("  ");
        assertEquals(5_000, RoundResultBuilder.revealPauseMs(question));
    }
}
