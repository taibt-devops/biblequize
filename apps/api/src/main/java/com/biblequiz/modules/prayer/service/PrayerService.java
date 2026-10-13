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

    public record ShareView(String token, String itemId, Instant createdAt, String url, long count, Instant lastPrayedAt) {}

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
        return new ShareView(s.getToken(), s.getItemId(), s.createdAtInstant(), docUrl + "/cn/" + s.getToken(),
                interRepo.countVisitorsForItem(s.getItemId()), Utc.instant(interRepo.lastPrayedForItem(s.getItemId())));
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
}
