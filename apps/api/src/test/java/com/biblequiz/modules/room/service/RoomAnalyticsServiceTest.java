package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class RoomAnalyticsServiceTest {

    @Mock private RoomRoundRepository roundRepository;
    @Mock private RoomAnswerRepository answerRepository;
    @Mock private QuestionRepository questionRepository;

    @InjectMocks private RoomAnalyticsService service;

    private RoomRound round(int no, String questionId) {
        RoomRound r = new RoomRound();
        r.setId("round-" + no);
        r.setRoundNo(no);
        r.setQuestionId(questionId);
        r.setEndedAt(java.time.LocalDateTime.now()); // vòng đã đóng (đã công bố đáp án)
        return r;
    }

    private RoomAnswer answer(String userId, int idx, boolean correct, int responseMs, int points) {
        RoomAnswer a = new RoomAnswer();
        a.setUserId(userId);
        a.setAnswerIndex(idx);
        a.setIsCorrect(correct);
        a.setResponseMs(responseMs);
        a.setPointsEarned(points);
        return a;
    }

    private Question question(String id, int correctIdx, List<String> opts) {
        Question q = new Question();
        q.setId(id);
        q.setContent("Q content");
        q.setOptions(opts);
        q.setCorrectAnswer(List.of(correctIdx));
        return q;
    }

    @BeforeEach
    void setUp() {}

    /** Review PCV-2: mở trang phân tích ở thẻ khác giữa trận không được thấy đáp án câu đang chạy. */
    @Test
    void roundStillOpen_isNotShown() {
        RoomRound closed = round(1, "q-1");
        RoomRound open = round(2, "q-2");
        open.setEndedAt(null);
        when(roundRepository.findByRoomIdOrderByRoundNoAsc("r1")).thenReturn(List.of(closed, open));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of());
        when(questionRepository.findById("q-1")).thenReturn(Optional.of(question("q-1", 2, List.of("A", "B", "C", "D"))));

        var rounds = service.getRoomAnalytics("r1");

        assertEquals(1, rounds.size());
        verify(answerRepository, never()).findByRoundId("round-2");
        verify(questionRepository, never()).findById("q-2");
    }

    @Test
    void getRoomAnalytics_emptyRoom_returnsEmptyList() {
        when(roundRepository.findByRoomIdOrderByRoundNoAsc("r1")).thenReturn(List.of());
        assertTrue(service.getRoomAnalytics("r1").isEmpty());
    }

    @Test
    void getRoomAnalytics_aggregatesAnswerCounts_avgResponseAndDistribution() {
        RoomRound round1 = round(1, "q-1");
        when(roundRepository.findByRoomIdOrderByRoundNoAsc("r1")).thenReturn(List.of(round1));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of(
                answer("u-a", 0, false, 1000, 0),    // wrong A
                answer("u-b", 2, true,  3000, 100),  // correct C
                answer("u-c", 2, true,  5000, 80),   // correct C
                answer("u-d", 1, false, 2000, 0)));  // wrong B
        when(questionRepository.findById("q-1")).thenReturn(Optional.of(
                question("q-1", 2, List.of("A", "B", "C", "D"))));

        var rounds = service.getRoomAnalytics("r1");

        assertEquals(1, rounds.size());
        var r = rounds.get(0);
        assertEquals(1, r.roundNo);
        assertEquals(2, r.correctIndex);
        assertEquals(4, r.totalAnswers);
        assertEquals(2, r.correctCount);
        assertEquals((1000 + 3000 + 5000 + 2000) / 4, r.avgResponseMs);
        // Distribution: 1 picked A, 1 picked B, 2 picked C, 0 picked D
        assertEquals(List.of(1, 1, 2, 0), r.distribution);
        assertEquals(4, r.players.size());
    }

    @Test
    void getRoomAnalytics_missingQuestion_returnsCorrectIndexNegativeOne() {
        RoomRound r = round(1, "q-deleted");
        when(roundRepository.findByRoomIdOrderByRoundNoAsc("r1")).thenReturn(List.of(r));
        when(answerRepository.findByRoundId("round-1")).thenReturn(List.of());
        when(questionRepository.findById("q-deleted")).thenReturn(Optional.empty());

        var rounds = service.getRoomAnalytics("r1");

        assertEquals(1, rounds.size());
        assertEquals(-1, rounds.get(0).correctIndex);
        assertEquals("(Question deleted)", rounds.get(0).questionContent);
        assertEquals(0, rounds.get(0).avgResponseMs);
        assertEquals(0, rounds.get(0).totalAnswers);
    }
}
