package com.biblequiz.modules.reading.service;

import com.biblequiz.modules.reading.entity.ReadingLog;
import com.biblequiz.modules.reading.entity.ReadingProgress;
import com.biblequiz.modules.reading.repository.ReadingLogRepository;
import com.biblequiz.modules.reading.repository.ReadingProgressRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;

/**
 * Tiến độ của app Đọc hằng ngày (doc.forbible.org). Lịch nằm ở repo forbible-doc; ở đây chỉ kiểm khung
 * (lịch có thật, phần trong phạm vi) rồi cất cả khối. Việc gộp hai máy làm ở giao diện.
 */
@Service
public class ReadingProgressService {

    /** Số phần của từng lịch — khớp public/lich/*.json của forbible-doc. */
    public static final Map<String, Integer> PLANS = Map.of("1-nam", 365, "2-nam", 730);
    public static final int MAX_LAP = 1000;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            .withZone(ZoneOffset.UTC);

    public record Progress(String plan, int next, int lap, Instant startedAt, Instant lastReadAt, Instant updatedAt) {}

    private final ReadingProgressRepository progressRepository;
    private final ReadingLogRepository logRepository;

    public ReadingProgressService(ReadingProgressRepository progressRepository, ReadingLogRepository logRepository) {
        this.progressRepository = progressRepository;
        this.logRepository = logRepository;
    }

    @Transactional(readOnly = true)
    public Optional<Progress> get(String userId) {
        return progressRepository.findById(userId).map(ReadingProgress::toProgress);
    }

    @Transactional
    public Progress put(String userId, Progress p, Instant now) {
        validate(p);
        Optional<ReadingProgress> existing = progressRepository.findById(userId);
        boolean changed = existing.map(r -> !r.getPlanId().equals(p.plan()) || r.getNextPortion() != p.next()
                || r.getLap() != p.lap()).orElse(true);
        ReadingProgress row = existing.orElseGet(() -> ReadingProgress.of(userId, p, now));
        row.apply(p, now);
        ReadingProgress saved = progressRepository.save(row);
        if (changed) logRepository.save(new ReadingLog(userId, p.plan(), p.next(), p.lap(), now));
        return saved.toProgress();
    }

    static void validate(Progress p) {
        Integer portions = PLANS.get(p.plan());
        if (portions == null) throw new IllegalArgumentException("Lịch không có: " + p.plan());
        if (p.next() < 1 || p.next() > portions + 1) throw new IllegalArgumentException("Phần ngoài phạm vi: " + p.next());
        if (p.lap() < 0 || p.lap() > MAX_LAP) throw new IllegalArgumentException("lap ngoài phạm vi: " + p.lap());
        if (p.startedAt() == null || p.updatedAt() == null) throw new IllegalArgumentException("Thiếu startedAt/updatedAt");
    }

    /** Dạng giống Date.toISOString() của trình duyệt: luôn có mili giây, luôn 'Z'. */
    public static String iso(Instant i) {
        return i == null ? null : ISO.format(i);
    }

    /** Thân PUT → Progress; thiếu trường, sai kiểu hay giờ không đọc được đều là IllegalArgumentException. */
    public static Progress parse(Map<String, Object> body) {
        if (!(body.get("plan") instanceof String plan) || !(body.get("next") instanceof Number next)) {
            throw new IllegalArgumentException("Thiếu plan/next");
        }
        int lap = body.get("lap") instanceof Number n ? n.intValue() : 0;
        return new Progress(plan, next.intValue(), lap, instant(body.get("startedAt"), true),
                instant(body.get("lastReadAt"), false), instant(body.get("updatedAt"), true));
    }

    private static Instant instant(Object v, boolean required) {
        if (v == null) {
            if (required) throw new IllegalArgumentException("Thiếu mốc giờ");
            return null;
        }
        if (!(v instanceof String s)) throw new IllegalArgumentException("Mốc giờ phải là chuỗi ISO");
        try {
            return Instant.parse(s);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Mốc giờ không đọc được: " + s);
        }
    }
}
