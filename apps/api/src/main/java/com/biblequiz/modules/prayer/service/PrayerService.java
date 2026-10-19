package com.biblequiz.modules.prayer.service;

import com.biblequiz.modules.prayer.entity.PrayerItem;
import com.biblequiz.modules.prayer.entity.PrayerPrayed;
import com.biblequiz.modules.prayer.entity.PrayerShare;
import com.biblequiz.modules.prayer.entity.Utc;
import com.biblequiz.modules.prayer.repository.PrayerIntercessionRepository;
import com.biblequiz.modules.prayer.repository.PrayerItemRepository;
import com.biblequiz.modules.prayer.repository.PrayerPrayedRepository;
import com.biblequiz.modules.prayer.repository.PrayerShareRepository;
import com.biblequiz.modules.prayer.service.PrayerInput.Item;
import com.biblequiz.modules.prayer.service.PrayerInput.Prayed;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import com.biblequiz.modules.prayer.entity.PrayerIntercession;
import java.security.SecureRandom;

/**
 * Sổ cầu nguyện của người đã đăng nhập (forbible-doc docs/cau-nguyen/03-du-lieu-va-api.md mục 3).
 * Sổ trên máy là chính; ở đây gộp theo từng điều: updatedAt mới hơn thắng, bằng nhau thì giữ máy chủ.
 * Không ghi tiêu đề hay chi tiết vào log.
 */
@Service
public class PrayerService {

    public static final int TOMBSTONE_DAYS = 90;
    public static final int PRAYED_DAYS = 400;

    public record Me(List<Item> items, List<PrayerPrayed> prayed, List<ShareView> shares) {}

    /** Link đang mở; recent = tối đa 3 người cầu thay gần nhất (mỗi máy một dòng). */
    public record ShareView(String token, String itemId, Instant createdAt, String url, long count, Instant lastPrayedAt,
                            List<Recent> recent) {
        public ShareView(String token, String itemId, Instant createdAt, String url, long count, Instant lastPrayedAt) {
            this(token, itemId, createdAt, url, count, lastPrayedAt, List.of());
        }
    }

    public record Recent(String name, String message, Instant at) {}

    public static final int RECENT_MAX = 3;

    private final PrayerItemRepository itemRepo;
    private final PrayerPrayedRepository prayedRepo;
    private final PrayerShareRepository shareRepo;
    private final PrayerIntercessionRepository interRepo;
    private final String docUrl;

    public PrayerService(PrayerItemRepository itemRepo, PrayerPrayedRepository prayedRepo,
                         PrayerShareRepository shareRepo, PrayerIntercessionRepository interRepo,
                         @Value("${app.doc-url:https://doc.forbible.org}") String docUrl) {
        this.itemRepo = itemRepo;
        this.prayedRepo = prayedRepo;
        this.shareRepo = shareRepo;
        this.interRepo = interRepo;
        String base = docUrl == null || docUrl.isBlank() ? "https://doc.forbible.org" : docUrl;
        this.docUrl = base.replaceAll("/+$", "");
    }

    @Transactional(readOnly = true)
    public Me me(String userId, Instant now) {
        List<Item> items = visible(itemRepo.findByUserId(userId), now);
        List<PrayerPrayed> prayed = prayedRepo.findByUserIdAndPrayedAtAfter(userId,
                Utc.of(now.minus(PRAYED_DAYS, ChronoUnit.DAYS)));
        List<ShareView> shares = shareRepo.findByUserIdAndRevokedAtIsNull(userId).stream().map(this::view).toList();
        return new Me(items, prayed, shares);
    }

    @Transactional
    public List<Item> putItems(String userId, List<Item> incoming, Instant now) {
        Map<String, PrayerItem> mine = new LinkedHashMap<>();
        for (PrayerItem p : itemRepo.findByUserId(userId)) mine.put(p.getId(), p);
        for (Item in : incoming) {
            PrayerItem cur = mine.get(in.id());
            if (cur == null) {
                if (itemRepo.existsById(in.id())) continue; // id đã thuộc người khác: bỏ qua, không báo là có
                mine.put(in.id(), itemRepo.save(PrayerItem.of(userId, in, now)));
            } else if (in.updatedAt().isAfter(cur.updatedAtInstant())) {
                boolean becomesTombstone = !cur.isDeleted() && in.deleted();
                cur.apply(in, now);
                itemRepo.save(cur);
                if (becomesTombstone) revokeOpenShares(cur.getId(), now);
            }
        }
        return visible(mine.values(), now);
    }

    @Transactional
    public int addPrayed(String userId, List<Prayed> entries, Instant now) {
        Set<String> live = itemRepo.findByUserId(userId).stream()
                .filter(p -> !p.isDeleted()).map(PrayerItem::getId).collect(Collectors.toSet());
        int saved = 0;
        for (Prayed e : entries) {
            if (!live.contains(e.itemId()) || prayedRepo.existsById(e.id())) continue;
            prayedRepo.save(new PrayerPrayed(e.id(), e.itemId(), userId, e.prayedAt(), now));
            saved++;
        }
        return saved;
    }

    ShareView view(PrayerShare s) {
        List<Recent> recent = people(s.getItemId()).stream().limit(RECENT_MAX)
                .map(p -> new Recent(p.name(), p.message(), p.lastPrayedAt())).toList();
        return new ShareView(s.getToken(), s.getItemId(), s.createdAtInstant(), docUrl + "/cn/" + s.getToken(),
                interRepo.countVisitorsForItem(s.getItemId()), Utc.instant(interRepo.lastPrayedForItem(s.getItemId())),
                recent);
    }

    private void revokeOpenShares(String itemId, Instant now) {
        for (PrayerShare s : shareRepo.findByItemIdAndRevokedAtIsNull(itemId)) {
            s.revoke(now);
            shareRepo.save(s);
        }
    }

    private static List<Item> visible(Collection<PrayerItem> rows, Instant now) {
        Instant cutoff = now.minus(TOMBSTONE_DAYS, ChronoUnit.DAYS);
        return rows.stream()
                .filter(p -> !p.isDeleted() || p.deletedAtInstant().isAfter(cutoff))
                .sorted(Comparator.comparing(PrayerItem::createdAtInstant))
                .map(PrayerItem::toItem)
                .toList();
    }

    public static final int SHARES_MAX = 100;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Một máy người nhận: tên và lời nhắn là bản khác null gần nhất của máy đó. */
    public record Person(String name, int count, Instant lastPrayedAt, String message, Instant messageAt) {
        public Person(String name, int count, Instant lastPrayedAt) {
            this(name, count, lastPrayedAt, null, null);
        }
    }

    public record Intercessions(int total, List<Person> people) {}

    @Transactional
    public ShareView share(String userId, String itemId, Instant now) {
        PrayerItem item = ownedLive(userId, itemId);
        if (item.isAnswered()) throw new IllegalStateException("Điều này đã được đáp lời");
        if (!item.isActive()) throw new IllegalStateException("Điều này đã cất");
        // Lời nhờ của người khác: muốn nhờ thêm người thì gửi lại đúng link của người nhờ (họ vẫn thu lại được).
        if (item.getSourceToken() != null) throw new IllegalStateException("Đây là lời nhờ của người khác");
        Optional<PrayerShare> open = shareRepo.findFirstByItemIdAndRevokedAtIsNull(itemId);
        if (open.isPresent()) return view(open.get());
        if (shareRepo.countByUserIdAndRevokedAtIsNull(userId) >= SHARES_MAX) {
            throw new IllegalStateException("Tối đa " + SHARES_MAX + " link đang mở");
        }
        return view(shareRepo.save(new PrayerShare(newToken(), itemId, userId, now)));
    }

    @Transactional
    public void revoke(String userId, String token, Instant now) {
        PrayerShare s = shareRepo.findById(token).filter(x -> x.getUserId().equals(userId))
                .orElseThrow(() -> new NoSuchElementException("Không có link này"));
        if (s.isOpen()) {
            s.revoke(now);
            shareRepo.save(s);
        }
    }

    @Transactional(readOnly = true)
    public Intercessions intercessions(String userId, String itemId) {
        ownedLive(userId, itemId);
        List<Person> people = people(itemId);
        return new Intercessions(people.size(), people);
    }

    /** Gộp các lần cầu thay của một điều theo máy người nhận, mới nhất trước. */
    private List<Person> people(String itemId) {
        Map<String, List<PrayerIntercession>> byVisitor = interRepo.findForItem(itemId).stream()
                .collect(Collectors.groupingBy(PrayerIntercession::getVisitorId, LinkedHashMap::new, Collectors.toList()));
        return byVisitor.values().stream().map(rows -> {
            String name = null;
            String message = null;
            Instant messageAt = null;
            Instant last = null;
            for (PrayerIntercession r : rows) { // đã xếp theo giờ tăng dần
                if (r.getVisitorName() != null) name = r.getVisitorName();
                if (r.getMessage() != null) {
                    message = r.getMessage();
                    messageAt = r.prayedAtInstant();
                }
                last = r.prayedAtInstant();
            }
            return new Person(name, rows.size(), last, message, messageAt);
        }).sorted(Comparator.comparing(Person::lastPrayedAt).reversed()).toList();
    }

    /** Token 16 byte ngẫu nhiên, base64url không đệm: 22 ký tự. */
    static String newToken() {
        byte[] b = new byte[16];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private PrayerItem ownedLive(String userId, String itemId) {
        return itemRepo.findById(itemId).filter(p -> p.getUserId().equals(userId) && !p.isDeleted())
                .orElseThrow(() -> new NoSuchElementException("Không có điều này"));
    }
}
