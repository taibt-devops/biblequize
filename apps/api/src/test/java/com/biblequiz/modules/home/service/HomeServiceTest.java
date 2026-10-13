package com.biblequiz.modules.home.service;

import com.biblequiz.modules.achievement.entity.Achievement;
import com.biblequiz.modules.achievement.entity.UserAchievement;
import com.biblequiz.modules.achievement.repository.UserAchievementRepository;
import com.biblequiz.modules.daily.service.DailyChallengeService;
import com.biblequiz.modules.memorize.repository.UserMemoryVerseRepository;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import com.biblequiz.modules.prayer.repository.PrayerPrayedRepository;
import com.biblequiz.modules.reading.repository.ReadingLogRepository;
import com.biblequiz.modules.reading.repository.ReadingProgressRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HomeServiceTest {

    private static final String DOC = "https://doc.forbible.org";
    private static final String QUIZ = "https://quiz.forbible.org";
    /** 01:30 sáng 14/10 ở Việt Nam, vẫn là 13/10 theo UTC. */
    private static final Instant NOW = Instant.parse("2026-10-13T18:30:00Z");
    private static final LocalDateTime TODAY_START_UTC = LocalDateTime.parse("2026-10-13T17:00:00");

    @Mock private ReadingProgressRepository readingProgress;
    @Mock private ReadingLogRepository readingLog;
    @Mock private PrayerItemRepository prayerItems;
    @Mock private PrayerPrayedRepository prayerPrayed;
    @Mock private UserMemoryVerseRepository memoryVerses;
    @Mock private DailyChallengeService daily;
    @Mock private UserAchievementRepository achievements;

    private HomeService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new HomeService(readingProgress, readingLog, prayerItems, prayerPrayed, memoryVerses, daily,
                achievements, DOC + "/", QUIZ);
        user = new User();
        user.setId("u1");
        user.setName("Minh An");
    }

    private void stub(boolean hasPlan, boolean readToday, long verses, long due,
                      boolean hasPrayer, boolean prayedToday, boolean dailyDone) {
        lenient().when(achievements.findByUserId("u1")).thenReturn(List.of());
        when(readingProgress.existsById("u1")).thenReturn(hasPlan);
        when(readingLog.existsByUserIdAndLoggedAtGreaterThanEqual(eq("u1"), any())).thenReturn(readToday);
        when(memoryVerses.countOwned("u1")).thenReturn(verses);
        when(memoryVerses.countDue(eq("u1"), any())).thenReturn(due);
        when(prayerItems.existsByUserIdAndDeletedAtIsNull("u1")).thenReturn(hasPrayer);
        when(prayerPrayed.existsByUserIdAndPrayedAtGreaterThanEqual(eq("u1"), any())).thenReturn(prayedToday);
        when(daily.hasCompletedToday("u1")).thenReturn(dailyDone);
    }

    private static Map<String, String> kinds(HomeService.Home h) {
        return h.badges().entrySet().stream().collect(java.util.stream.Collectors.toMap(
                Map.Entry::getKey, e -> e.getValue().kind()));
    }

    @Test
    void newUser_startsAtLibrary() {
        stub(false, false, 0, 0, false, false, false);
        HomeService.Home h = service.home(user, NOW);
        assertTrue(h.isNew());
        assertFalse(h.allDone());
        assertEquals(new HomeService.Continue("doc", "start", "Đọc chương đầu tiên",
                "Chào Minh An! Mỗi ngày một phần Kinh Thánh, bắt đầu ở thư viện nhé.", DOC), h.next());
        assertEquals(Map.of("bible-quiz", "new"), kinds(h));
    }

    @Test
    void planNotReadToday_continuesReading() {
        stub(true, false, 0, 0, false, false, false);
        HomeService.Home h = service.home(user, NOW);
        assertFalse(h.isNew());
        assertEquals(new HomeService.Continue("doc", "today", "Đọc phần hôm nay",
                "Phần đọc hôm nay đã mở sẵn ở thư viện.", DOC), h.next());
        assertEquals("new", kinds(h).get("doc"));
    }

    @Test
    void readToday_dueVerses_reviewAtCampfire() {
        stub(true, true, 5, 3, false, false, false);
        HomeService.Home h = service.home(user, NOW);
        assertEquals(new HomeService.Continue("hoc-thuoc", "today", "Ôn 3 câu bên lửa trại",
                "Có 3 câu đang chờ ôn bên lửa trại.", QUIZ + "/practice/memorize/session"), h.next());
        assertEquals("done", kinds(h).get("doc"));
        assertEquals(new HomeService.Badge("count", 3), h.badges().get("hoc-thuoc"));
    }

    @Test
    void noDue_dailyOpen_goesToArena() {
        stub(true, true, 5, 0, true, false, false);
        HomeService.Home h = service.home(user, NOW);
        assertEquals(new HomeService.Continue("bible-quiz", "today", "Vào thử thách hôm nay",
                "Thử thách hôm nay đang chờ ở đấu trường.", QUIZ + "/daily"), h.next());
        assertEquals("done", kinds(h).get("hoc-thuoc"));
        assertEquals("new", kinds(h).get("bible-quiz"));
        assertFalse(h.allDone());
    }

    @Test
    void allDone_notPrayedToday_suggestsChapel() {
        stub(true, true, 5, 0, true, false, true);
        HomeService.Home h = service.home(user, NOW);
        assertTrue(h.allDone());
        assertEquals(new HomeService.Continue("cau-nguyen", "suggest", "Ghé nhà nguyện",
                "Hôm nay bạn đã xong việc. Còn thời gian thì ghé nhà nguyện nhé!", DOC + "/cau-nguyen"), h.next());
        assertEquals("done", kinds(h).get("bible-quiz"));
        assertFalse(h.badges().containsKey("cau-nguyen"), "không nhắc người ta rằng họ chưa cầu nguyện");
    }

    @Test
    void allDone_prayed_suggestsBakeryWithoutUrl() {
        stub(true, true, 0, 0, true, true, true);
        HomeService.Home h = service.home(user, NOW);
        assertTrue(h.allDone());
        assertEquals(new HomeService.Continue("manna", "suggest", "Ghé lò bánh Manna",
                "Hôm nay bạn đã xong việc. Còn thời gian thì ghé lò bánh nhé!", null), h.next());
        assertEquals("done", kinds(h).get("cau-nguyen"));
        assertFalse(h.badges().containsKey("hoc-thuoc"));
    }

    @Test
    void todayStartsAtMidnightVietnam() {
        stub(true, true, 0, 0, true, true, true);
        service.home(user, NOW);
        verify(readingLog).existsByUserIdAndLoggedAtGreaterThanEqual("u1", TODAY_START_UTC);
        verify(prayerPrayed).existsByUserIdAndPrayedAtGreaterThanEqual("u1", TODAY_START_UTC);
    }

    @Test
    void journal_countsVersesAndLatestBadge() {
        stub(true, true, 7, 0, false, false, true);
        Achievement a = new Achievement();
        a.setName("Ngọn lửa");
        Achievement b = new Achievement();
        b.setName("Thuộc câu thứ 7");
        UserAchievement older = new UserAchievement();
        older.setAchievement(a);
        older.setEarnedAt(LocalDateTime.parse("2026-10-01T08:00:00"));
        UserAchievement newer = new UserAchievement();
        newer.setAchievement(b);
        newer.setEarnedAt(LocalDateTime.parse("2026-10-12T08:00:00"));
        when(achievements.findByUserId("u1")).thenReturn(List.of(newer, older));
        HomeService.Home h = service.home(user, NOW);
        assertEquals(new HomeService.Journal(7, 2, "Thuộc câu thứ 7"), h.journal());
    }

    @Test
    void names() {
        assertEquals("MA", HomeService.initials("Minh An"));
        assertEquals("TV", HomeService.initials("Trương Hoàng Vũ"));
        assertEquals("T", HomeService.initials("tài"));
        assertEquals("Bạn", HomeService.displayName("   "));
        assertEquals("Bạn", HomeService.displayName(null));
        assertEquals("Trương Hoàng Vũ", HomeService.displayName("  Trương   Hoàng Vũ "));
        assertEquals("B", HomeService.initials(HomeService.displayName("")));
    }
}
