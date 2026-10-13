package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.entity.PrayerIntercession;
import com.biblequiz.modules.prayer.entity.PrayerItem;
import com.biblequiz.modules.prayer.entity.PrayerShare;
import com.biblequiz.modules.prayer.entity.Utc;
import com.biblequiz.modules.prayer.repository.PrayerIntercessionRepository;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import com.biblequiz.modules.prayer.repository.PrayerShareRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.NoSuchElementException;

/**
 * Trang người nhận link nhờ cầu thay (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md mục 4).
 * Chỉ lộ đúng một điều và tên hiển thị của người nhờ. Link lạ, đã thu lại hay điều đã xóa trả lời như nhau.
 */
@Service
public class PublicPrayerService {

    public static final Duration SAME_VISITOR = Duration.ofHours(12);

    public record View(String ownerName, String title, String detail, String status, long count) {}

    private final PrayerShareRepository shareRepo;
    private final PrayerItemRepository itemRepo;
    private final PrayerIntercessionRepository interRepo;
    private final UserRepository userRepo;

    public PublicPrayerService(PrayerShareRepository shareRepo, PrayerItemRepository itemRepo,
                               PrayerIntercessionRepository interRepo, UserRepository userRepo) {
        this.shareRepo = shareRepo;
        this.itemRepo = itemRepo;
        this.interRepo = interRepo;
        this.userRepo = userRepo;
    }

    @Transactional(readOnly = true)
    public View view(String token) {
        PrayerItem item = liveItem(token);
        String name = userRepo.findById(item.getUserId()).map(User::getName).orElse(null);
        return new View(name == null ? "" : name, item.getTitle(), item.getDetail(), item.getStatus(),
                interRepo.countVisitorsForItem(item.getId()));
    }

    @Transactional
    public long pray(String token, String visitorId, String name, Instant now) {
        if (!PrayerInput.isUuid(visitorId)) throw new IllegalArgumentException("visitorId phải là UUID");
        PrayerItem item = liveItem(token);
        if (item.isAnswered()) throw new IllegalStateException("Điều này đã được đáp lời");
        boolean recent = interRepo.existsByShareTokenAndVisitorIdAndPrayedAtAfter(token, visitorId,
                Utc.of(now.minus(SAME_VISITOR)));
        if (!recent) interRepo.save(new PrayerIntercession(token, visitorId, name, now));
        return interRepo.countVisitorsForItem(item.getId());
    }

    private PrayerItem liveItem(String token) {
        PrayerShare s = shareRepo.findById(token).filter(PrayerShare::isOpen)
                .orElseThrow(() -> new NoSuchElementException("Không có lời nhờ này"));
        return itemRepo.findById(s.getItemId()).filter(p -> !p.isDeleted())
                .orElseThrow(() -> new NoSuchElementException("Không có lời nhờ này"));
    }
}
