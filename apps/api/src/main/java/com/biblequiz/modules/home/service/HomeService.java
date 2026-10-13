package com.biblequiz.modules.home.service;

import com.biblequiz.infrastructure.time.GameClock;
import com.biblequiz.modules.achievement.entity.UserAchievement;
import com.biblequiz.modules.achievement.repository.UserAchievementRepository;
import com.biblequiz.modules.daily.service.DailyChallengeService;
import com.biblequiz.modules.memorize.repository.UserMemoryVerseRepository;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import com.biblequiz.modules.prayer.repository.PrayerPrayedRepository;
import com.biblequiz.modules.reading.repository.ReadingLogRepository;
import com.biblequiz.modules.reading.repository.ReadingProgressRepository;
import com.biblequiz.modules.user.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Tóm tắt cho trang chủ Làng nhỏ ở forbible.org (forbible-home docs/07-ra-mat-forbible-org.md mục 2–3).
 * Chỉ đọc bảng có sẵn và chỉ trả số: không trả nội dung lời cầu nguyện hay câu đã thuộc.
 */
@Service
public class HomeService {

    public record UserView(String displayName, String initials) {}
    public record Badge(String kind, Integer value) {}
    public record Continue(String app, String reason, String label, String line, String url) {}
    public record Journal(long verses, int badges, String recentBadge) {}
    public record Home(UserView user, Map<String, Badge> badges, Continue next,
                       boolean allDone, boolean isNew, Journal journal) {}

    private final ReadingProgressRepository readingProgress;
    private final ReadingLogRepository readingLog;
    private final PrayerItemRepository prayerItems;
    private final PrayerPrayedRepository prayerPrayed;
    private final UserMemoryVerseRepository memoryVerses;
    private final DailyChallengeService daily;
    private final UserAchievementRepository achievements;
    private final String docUrl;
    private final String quizUrl;

    public HomeService(ReadingProgressRepository readingProgress, ReadingLogRepository readingLog,
                       PrayerItemRepository prayerItems, PrayerPrayedRepository prayerPrayed,
                       UserMemoryVerseRepository memoryVerses, DailyChallengeService daily,
                       UserAchievementRepository achievements,
                       @Value("${app.doc-url:https://doc.forbible.org}") String docUrl,
                       @Value("${app.frontend-url:https://quiz.forbible.org}") String quizUrl) {
        this.readingProgress = readingProgress;
        this.readingLog = readingLog;
        this.prayerItems = prayerItems;
        this.prayerPrayed = prayerPrayed;
        this.memoryVerses = memoryVerses;
        this.daily = daily;
        this.achievements = achievements;
        this.docUrl = base(docUrl, "https://doc.forbible.org");
        this.quizUrl = base(quizUrl, "https://quiz.forbible.org");
    }

    private static String base(String url, String fallback) {
        String u = url == null || url.isBlank() ? fallback : url.trim();
        return u.endsWith("/") ? u.substring(0, u.length() - 1) : u;
    }

    @Transactional(readOnly = true)
    public Home home(User user, Instant now) {
        String id = user.getId();
        // Ngày theo giờ Việt Nam; các mốc của reading_log và prayer_prayed lưu dạng LocalDateTime UTC.
        LocalDateTime todayStartUtc = LocalDateTime.ofInstant(
                now.atZone(GameClock.GAME_ZONE).toLocalDate().atStartOfDay(GameClock.GAME_ZONE).toInstant(),
                ZoneOffset.UTC);
        boolean hasPlan = readingProgress.existsById(id);
        boolean readToday = readingLog.existsByUserIdAndLoggedAtGreaterThanEqual(id, todayStartUtc);
        long verses = memoryVerses.countOwned(id);
        // Học Thuộc so next_review_at với LocalDateTime.now() của JVM (MemoryVerseController): làm y như vậy.
        long due = memoryVerses.countDue(id, LocalDateTime.ofInstant(now, ZoneId.systemDefault()));
        boolean hasPrayer = prayerItems.existsByUserIdAndDeletedAtIsNull(id);
        boolean prayedToday = prayerPrayed.existsByUserIdAndPrayedAtGreaterThanEqual(id, todayStartUtc);
        boolean dailyDone = daily.hasCompletedToday(id);

        Map<String, Badge> badges = new LinkedHashMap<>();
        if (readToday) badges.put("doc", new Badge("done", null));
        else if (hasPlan) badges.put("doc", new Badge("new", null));
        if (prayedToday) badges.put("cau-nguyen", new Badge("done", null));
        if (due > 0) badges.put("hoc-thuoc", new Badge("count", (int) due));
        else if (verses > 0) badges.put("hoc-thuoc", new Badge("done", null));
        badges.put("bible-quiz", new Badge(dailyDone ? "done" : "new", null));

        String name = displayName(user.getName());
        boolean isNew = !hasPlan && verses == 0 && !hasPrayer;
        Continue next;
        if (isNew) {
            next = new Continue("doc", "start", "Đọc chương đầu tiên",
                    "Chào " + name + "! Mỗi ngày một phần Kinh Thánh, bắt đầu ở thư viện nhé.", docUrl);
        } else if (hasPlan && !readToday) {
            next = new Continue("doc", "today", "Đọc phần hôm nay", "Phần đọc hôm nay đã mở sẵn ở thư viện.", docUrl);
        } else if (due > 0) {
            next = new Continue("hoc-thuoc", "today", "Ôn " + due + " câu bên lửa trại",
                    "Có " + due + " câu đang chờ ôn bên lửa trại.", quizUrl + "/practice/memorize/session");
        } else if (!dailyDone) {
            next = new Continue("bible-quiz", "today", "Vào thử thách hôm nay",
                    "Thử thách hôm nay đang chờ ở đấu trường.", quizUrl + "/daily");
        } else if (!prayedToday) {
            next = new Continue("cau-nguyen", "suggest", "Ghé nhà nguyện",
                    "Hôm nay bạn đã xong việc. Còn thời gian thì ghé nhà nguyện nhé!", docUrl + "/cau-nguyen");
        } else {
            // Lò bánh không thuộc Bible Quiz: làng tự lấy địa chỉ trong danh mục nhà.
            next = new Continue("manna", "suggest", "Ghé lò bánh Manna",
                    "Hôm nay bạn đã xong việc. Còn thời gian thì ghé lò bánh nhé!", null);
        }

        List<UserAchievement> earned = achievements.findByUserId(id);
        String recent = earned.stream()
                .filter(a -> a.getEarnedAt() != null && a.getAchievement() != null)
                .max(Comparator.comparing(UserAchievement::getEarnedAt))
                .map(a -> a.getAchievement().getName())
                .orElse(null);
        return new Home(new UserView(name, initials(name)), badges, next, "suggest".equals(next.reason()), isNew,
                new Journal(verses, earned.size(), recent));
    }

    static String displayName(String raw) {
        String s = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        return s.isEmpty() ? "Bạn" : s;
    }

    /** Chữ đầu của tiếng đầu và tiếng cuối: "Minh An" → "MA", "Trương Hoàng Vũ" → "TV". */
    static String initials(String name) {
        String[] parts = name.trim().split("\\s+");
        String first = firstLetter(parts[0]);
        String last = parts.length > 1 ? firstLetter(parts[parts.length - 1]) : "";
        return (first + last).toUpperCase(Locale.forLanguageTag("vi"));
    }

    private static String firstLetter(String word) {
        return word.isEmpty() ? "" : new String(Character.toChars(word.codePointAt(0)));
    }
}
