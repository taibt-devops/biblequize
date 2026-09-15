package com.biblequiz.modules.memorize.service;

import com.biblequiz.modules.bible.service.BiblePassageService;
import com.biblequiz.modules.bible.service.BiblePassageService.Passage;
import com.biblequiz.modules.bible.service.BiblePassageService.VerseText;
import com.biblequiz.modules.memorize.entity.UserMemoryVerse;
import com.biblequiz.modules.memorize.repository.UserMemoryVerseRepository;
import com.biblequiz.modules.memorize.service.MemoryVerseException.Kind;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Text là chuỗi giả — không phải câu Kinh Thánh. */
class MemoryVerseServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 15, 20, 0);

    private UserMemoryVerseRepository repository;
    private BiblePassageService passageService;
    private MemoryVerseService service;
    private User user;

    @BeforeEach
    void setUp() {
        repository = mock(UserMemoryVerseRepository.class);
        passageService = mock(BiblePassageService.class);
        service = new MemoryVerseService(repository, passageService);
        user = new User();
        user.setId("user-1");
    }

    private void passage(String book, int chapter, int from, int to) {
        List<VerseText> verses = IntStream.rangeClosed(from, to).mapToObj(v -> new VerseText(v, "f" + v)).toList();
        when(passageService.getPassage(book, chapter, from, to))
                .thenReturn(Optional.of(new Passage("BTTHD2011", book, chapter, verses)));
    }

    private static Kind kindOf(Runnable call) {
        return assertThrows(MemoryVerseException.class, call::run).getKind();
    }

    @Test
    void add_savesLevelZeroDueNow_withJoinedText() {
        passage("John", 3, 16, 17);

        MemoryVerseService.Item item = service.add(user, "John", 3, 16, 17, NOW);

        assertEquals("f16 f17", item.text());
        assertEquals(0, item.masteryLevel());
        assertTrue(item.due());
        verify(repository).saveAndFlush(argThat(v -> v.getVerseStart() == 16 && v.getVerseEnd() == 17
                && v.getNextReviewAt().equals(NOW) && v.getUser() == user));
    }

    @Test
    void add_rejectsMoreThanFiveVerses() {
        assertEquals(Kind.INVALID, kindOf(() -> service.add(user, "Psalms", 23, 1, 6, NOW)));
        verifyNoInteractions(passageService);
    }

    @Test
    void add_rejectsInvalidReference() {
        when(passageService.getPassage("Tobit", 1, 1, 1)).thenThrow(new IllegalArgumentException("bad"));
        assertEquals(Kind.INVALID, kindOf(() -> service.add(user, "Tobit", 1, 1, 1, NOW)));
    }

    @Test
    void add_rejectsWhenTextMissingOrPartial() {
        when(passageService.getPassage("John", 3, 16, 16)).thenReturn(Optional.empty());
        assertEquals(Kind.INVALID, kindOf(() -> service.add(user, "John", 3, 16, 16, NOW)));

        passage("Jude", 1, 24, 25);
        when(passageService.getPassage("Jude", 1, 24, 26)).thenReturn(Optional.of(new Passage("BTTHD2011", "Jude", 1,
                List.of(new VerseText(24, "a"), new VerseText(25, "b")))));
        assertEquals(Kind.INVALID, kindOf(() -> service.add(user, "Jude", 1, 24, 26, NOW)));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void add_duplicate_isRejected_evenOnRace() {
        passage("John", 3, 16, 16);
        when(repository.existsRef("user-1", "BTTHD2011", "John", 3, 16, 16)).thenReturn(true);
        assertEquals(Kind.DUPLICATE, kindOf(() -> service.add(user, "John", 3, 16, 16, NOW)));

        when(repository.existsRef(any(), any(), any(), anyInt(), anyInt(), anyInt())).thenReturn(false);
        when(repository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("uk_umv_ref"));
        assertEquals(Kind.DUPLICATE, kindOf(() -> service.add(user, "John", 3, 16, 16, NOW)));
    }

    @Test
    void delete_onlyOwnVerse() {
        when(repository.findOwned("v-1", "user-2")).thenReturn(Optional.empty());
        assertEquals(Kind.NOT_FOUND, kindOf(() -> service.delete("user-2", "v-1")));
        verify(repository, never()).delete(any());
    }

    @Test
    void review_appliesScheduleAndSaves() {
        UserMemoryVerse v = new UserMemoryVerse("v-1", user, "BTTHD2011", "John", 3, 16, 16, NOW.minusDays(1));
        v.setMasteryLevel(2);
        when(repository.findOwned("v-1", "user-1")).thenReturn(Optional.of(v));
        passage("John", 3, 16, 16);

        MemoryVerseService.Item item = service.review("user-1", "v-1", true, NOW);

        assertEquals(3, item.masteryLevel());
        assertEquals(NOW.plusDays(4), item.nextReviewAt());
        assertFalse(item.due());
        verify(repository).save(v);
    }

    @Test
    void due_limitsToSessionSize_andListKeepsItemsWhoseTextIsGone() {
        UserMemoryVerse v = new UserMemoryVerse("v-1", user, "BTTHD2011", "John", 3, 16, 16, NOW.minusHours(1));
        when(repository.findDue(eq("user-1"), eq(NOW), any(Pageable.class))).thenReturn(List.of(v));
        when(passageService.getPassage("John", 3, 16, 16)).thenReturn(Optional.empty());

        List<MemoryVerseService.Item> items = service.due("user-1", NOW);

        assertEquals("", items.get(0).text());
        assertTrue(items.get(0).due());
        verify(repository).findDue(eq("user-1"), eq(NOW),
                argThat(p -> p.getPageSize() == MemoryVerseService.SESSION_SIZE));
    }
}
