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

import com.biblequiz.modules.prayer.service.PrayerInput.Update;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

/**
 * Trang người nhận link nhờ cầu thay (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md mục 4).
 * Chỉ lộ đúng một điều và tên hiển thị của người nhờ. Link lạ, đã thu lại hay điều đã xóa trả lời như nhau.
 */
@Service
public class PublicPrayerService {

    public static final Duration SAME_VISITOR = Duration.ofHours(12);
    public static final int PUBLIC_UPDATES = 5;

    /** Trang người nhận. testimony chỉ có khi đã nhậm lời và người nhờ cho người cầu thay đọc. */
    public record View(String ownerName, String title, String detail, String status, long count,
                       String topic, List<Update> updates, Instant answeredAt, String testimony) {
        public View(String ownerName, String title, String detail, String status, long count) {
            this(ownerName, title, detail, status, count, null, List.of(), null, null);
        }
    }

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
        List<Update> newest = item.updates().stream()
                .sorted(Comparator.comparing(Update::at).reversed()).limit(PUBLIC_UPDATES).toList();
        String testimony = item.isAnswered() && item.isShareTestimony() ? item.getTestimony() : null;
        return new View(name == null ? "" : name, item.getTitle(), item.getDetail(), item.getStatus(),
                interRepo.countVisitorsForItem(item.getId()), item.getTopic(), newest,
                item.isAnswered() ? item.answeredAtInstant() : null, testimony);
    }

    @Transactional
    public long pray(String token, String visitorId, String name, Instant now) {
        return pray(token, visitorId, name, null, now);
    }

    /**
     * Một lần cầu thay. Cùng máy đã bấm trong 12 giờ qua thì không thêm lần mới; tên và lời nhắn gửi kèm
     * (khác null) được gắn vào lần đã ghi, vì người nhận gửi lời nhắn sau khi bấm A-men.
     */
    @Transactional
    public long pray(String token, String visitorId, String name, String message, Instant now) {
        if (!PrayerInput.isUuid(visitorId)) throw new IllegalArgumentException("visitorId phải là UUID");
        PrayerItem item = liveItem(token);
        if (item.isAnswered()) throw new IllegalStateException("Điều này đã được đáp lời");
        if (!item.isActive()) throw new IllegalStateException("Lời nhờ này đã khép lại");
        Optional<PrayerIntercession> recent = interRepo.findFirstByShareTokenAndVisitorIdAndPrayedAtAfterOrderByPrayedAtDesc(
                token, visitorId, Utc.of(now.minus(SAME_VISITOR)));
        if (recent.isEmpty()) {
            interRepo.save(new PrayerIntercession(token, visitorId, name, message, now));
        } else if (name != null || message != null) {
            recent.get().update(name, message);
            interRepo.save(recent.get());
        }
        return interRepo.countVisitorsForItem(item.getId());
    }

    private PrayerItem liveItem(String token) {
        PrayerShare s = shareRepo.findById(token).filter(PrayerShare::isOpen)
                .orElseThrow(() -> new NoSuchElementException("Không có lời nhờ này"));
        return itemRepo.findById(s.getItemId()).filter(p -> !p.isDeleted())
                .orElseThrow(() -> new NoSuchElementException("Không có lời nhờ này"));
    }
}
