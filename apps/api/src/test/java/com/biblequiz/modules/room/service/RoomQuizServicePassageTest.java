package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-24 — chọn câu cho phòng "Ôn phần đọc hôm nay": đúng đoạn trước, rồi cùng sách, rồi bất kỳ. */
@ExtendWith(MockitoExtension.class)
class RoomQuizServicePassageTest {

    @Mock private QuestionRepository questionRepository;
    @Mock private RoomRepository roomRepository;

    private RoomQuizService service;

    private static final String GENESIS_27_28 = "[{\"book\":\"Genesis\",\"fromChapter\":27,\"toChapter\":28}]";

    @BeforeEach
    void setUp() {
        service = new RoomQuizService();
        ReflectionTestUtils.setField(service, "questionRepository", questionRepository);
        ReflectionTestUtils.setField(service, "roomRepository", roomRepository);
    }

    private static Question q(String id) {
        Question q = new Question();
        q.setId(id);
        return q;
    }

    private static List<String> ids(List<Question> qs) {
        return qs.stream().map(Question::getId).toList();
    }

    private void room(Room.RoomMode mode, Room.RoomDifficulty difficulty, String passage) {
        Room r = new Room();
        r.setId("room-1");
        r.setMode(mode);
        r.setLanguage("vi");
        r.setDifficulty(difficulty);
        r.setBookScope("ALL");
        r.setQuestionSource(Room.QuestionSource.DATABASE);
        r.setPassageScope(passage);
        when(roomRepository.findById("room-1")).thenReturn(Optional.of(r));
    }

    @Test
    void passageRoom_takesTheChaptersFirst() {
        room(Room.RoomMode.SPEED_RACE, Room.RoomDifficulty.MIXED, GENESIS_27_28);
        when(questionRepository.findRandomInPassage(eq("vi"), eq("Genesis"), eq(27), eq(28), isNull(), eq(List.of()), any(Pageable.class)))
                .thenReturn(List.of(q("a"), q("b"), q("c")));

        assertEquals(List.of("a", "b", "c"), ids(service.loadQuestionsForRoom("room-1", 3, Room.RoomMode.SPEED_RACE).questions()));
        verify(questionRepository, never()).findRandomQuestionsByLanguageAndBooksExcludingIds(any(), any(), any(), any());
        verify(questionRepository, never()).findRandomQuestionsByLanguageExcludingIds(any(), any(), any());
    }

    @Test
    void shortPassage_fillsFromTheSameBook_thenFromAnywhere() {
        room(Room.RoomMode.SPEED_RACE, Room.RoomDifficulty.MIXED, GENESIS_27_28);
        when(questionRepository.findRandomInPassage(eq("vi"), eq("Genesis"), eq(27), eq(28), isNull(), eq(List.of()), any(Pageable.class)))
                .thenReturn(List.of(q("a")));
        when(questionRepository.findRandomQuestionsByLanguageAndBooksExcludingIds(eq("vi"), eq(List.of("Genesis")), eq(List.of("a")), any(Pageable.class)))
                .thenReturn(List.of(q("b")));
        when(questionRepository.findRandomQuestionsByLanguageExcludingIds(eq("vi"), eq(List.of("a", "b")), any(Pageable.class)))
                .thenReturn(List.of(q("c")));

        assertEquals(List.of("a", "b", "c"), ids(service.loadQuestionsForRoom("room-1", 3, Room.RoomMode.SPEED_RACE).questions()));
    }

    @Test
    void twoPassages_takeTurns_withoutDuplicates() {
        room(Room.RoomMode.SPEED_RACE, Room.RoomDifficulty.MIXED,
                "[{\"book\":\"Genesis\",\"fromChapter\":27,\"toChapter\":28},{\"book\":\"Psalms\",\"fromChapter\":7,\"toChapter\":7}]");
        when(questionRepository.findRandomInPassage(eq("vi"), eq("Genesis"), eq(27), eq(28), isNull(), eq(List.of()), any(Pageable.class)))
                .thenReturn(List.of(q("g1"), q("g2"), q("g3")));
        when(questionRepository.findRandomInPassage(eq("vi"), eq("Psalms"), eq(7), eq(7), isNull(), eq(List.of()), any(Pageable.class)))
                .thenReturn(List.of(q("p1"), q("g1")));

        assertEquals(List.of("g1", "p1", "g2", "g3"),
                ids(service.loadQuestionsForRoom("room-1", 4, Room.RoomMode.SPEED_RACE).questions()));
    }

    @Test
    void fixedDifficulty_isKeptAtEveryStep() {
        room(Room.RoomMode.SPEED_RACE, Room.RoomDifficulty.EASY, GENESIS_27_28);
        when(questionRepository.findRandomInPassage(eq("vi"), eq("Genesis"), eq(27), eq(28), eq(Question.Difficulty.easy), eq(List.of()), any(Pageable.class)))
                .thenReturn(List.of(q("a")));
        when(questionRepository.findRandomQuestionsByLanguageAndBooksAndDifficultyExcludingIds(eq("vi"), eq(List.of("Genesis")), eq(Question.Difficulty.easy), eq(List.of("a")), any(Pageable.class)))
                .thenReturn(List.of());
        when(questionRepository.findRandomQuestionsByLanguageAndDifficultyExcludingIds(eq("vi"), eq(Question.Difficulty.easy), eq(List.of("a")), any(Pageable.class)))
                .thenReturn(List.of(q("z")));

        assertEquals(List.of("a", "z"), ids(service.loadQuestionsForRoom("room-1", 2, Room.RoomMode.SPEED_RACE).questions()));
    }

    @Test
    void battleRoyale_asksThePassageAtEveryLevel() {
        room(Room.RoomMode.BATTLE_ROYALE, Room.RoomDifficulty.MIXED, GENESIS_27_28);
        when(questionRepository.findRandomInPassage(eq("vi"), eq("Genesis"), eq(27), eq(28), any(), anyList(), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Question.Difficulty d = inv.getArgument(4);
                    int n = ((Pageable) inv.getArgument(6)).getPageSize();
                    List<String> exclude = inv.getArgument(5);
                    return java.util.stream.IntStream.range(0, n)
                            .mapToObj(i -> q(d + "-" + (exclude.size() + i)))
                            .toList();
                });

        RoomQuizService.LoadedQuestions loaded = service.loadQuestionsForRoom("room-1", 10, Room.RoomMode.BATTLE_ROYALE);

        assertEquals(10, loaded.regularCount());
        assertEquals(15, loaded.questions().size());
        verify(questionRepository, atLeastOnce()).findRandomInPassage(any(), any(), anyInt(), anyInt(), eq(Question.Difficulty.easy), anyList(), any());
        verify(questionRepository, atLeastOnce()).findRandomInPassage(any(), any(), anyInt(), anyInt(), eq(Question.Difficulty.hard), anyList(), any());
        verify(questionRepository, never()).findRandomQuestionsByLanguageExcludingIds(any(), any(), any());
    }

    @Test
    void noPassage_keepsTheBookScopePath() {
        room(Room.RoomMode.SPEED_RACE, Room.RoomDifficulty.MIXED, null);
        when(questionRepository.findRandomQuestionsByLanguageExcludingIds(eq("vi"), eq(List.of()), any(Pageable.class)))
                .thenReturn(List.of(q("x")));

        assertEquals(List.of("x"), ids(service.loadQuestionsForRoom("room-1", 1, Room.RoomMode.SPEED_RACE).questions()));
        verify(questionRepository, never()).findRandomInPassage(any(), any(), anyInt(), anyInt(), any(), any(), any());
    }
}
