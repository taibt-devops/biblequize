package com.biblequiz.modules.memorize.service;

import com.biblequiz.modules.bible.entity.BibleVerse;
import com.biblequiz.modules.bible.service.BiblePassageService;
import com.biblequiz.modules.bible.service.BiblePassageService.VerseText;
import com.biblequiz.modules.memorize.entity.UserMemoryVerse;
import com.biblequiz.modules.memorize.repository.UserMemoryVerseRepository;
import com.biblequiz.modules.user.entity.User;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static com.biblequiz.modules.memorize.service.MemoryVerseException.Kind.*;

/** Danh sách câu gốc + phiên ôn (SPEC_USER §5.1.1). */
@Service
public class MemoryVerseService {

    /** Đoạn tối đa 5 câu liền nhau. */
    public static final int MAX_VERSES = 5;
    public static final int SESSION_SIZE = 10;

    public record Item(String id, String book, int chapter, int verseStart, int verseEnd, String text,
                       int masteryLevel, LocalDateTime nextReviewAt, boolean due) {}

    private final UserMemoryVerseRepository repository;
    private final BiblePassageService passageService;

    public MemoryVerseService(UserMemoryVerseRepository repository, BiblePassageService passageService) {
        this.repository = repository;
        this.passageService = passageService;
    }

    /** Danh sách của tôi. Mỗi item 1 truy vấn chữ — chấp nhận ở Đợt 1 (danh sách cá nhân nhỏ). */
    @Transactional(readOnly = true)
    public List<Item> list(String userId, LocalDateTime now) {
        return repository.findAllByUserId(userId).stream().map(v -> toItem(v, now)).toList();
    }

    @Transactional(readOnly = true)
    public List<Item> due(String userId, LocalDateTime now) {
        return repository.findDue(userId, now, PageRequest.of(0, SESSION_SIZE)).stream()
                .map(v -> toItem(v, now)).toList();
    }

    public long dueCount(String userId, LocalDateTime now) {
        return repository.countDue(userId, now);
    }

    @Transactional
    public Item add(User user, String book, int chapter, int verseStart, int verseEnd, LocalDateTime now) {
        if (verseEnd - verseStart + 1 > MAX_VERSES) {
            throw new MemoryVerseException(INVALID, "Tối đa " + MAX_VERSES + " câu liền nhau");
        }
        String text = passageText(book, chapter, verseStart, verseEnd);
        if (repository.existsRef(user.getId(), BibleVerse.ACTIVE_VERSION, book, chapter, verseStart, verseEnd)) {
            throw new MemoryVerseException(DUPLICATE, "Đoạn này đã có trong danh sách");
        }
        UserMemoryVerse verse = new UserMemoryVerse(UUID.randomUUID().toString(), user, BibleVerse.ACTIVE_VERSION,
                book, chapter, verseStart, verseEnd, now);
        try {
            repository.saveAndFlush(verse);
        } catch (DataIntegrityViolationException e) {
            // Hai request thêm cùng lúc: unique key uk_umv_ref chặn bản thứ hai.
            throw new MemoryVerseException(DUPLICATE, "Đoạn này đã có trong danh sách");
        }
        return new Item(verse.getId(), book, chapter, verseStart, verseEnd, text, 0, now, true);
    }

    @Transactional
    public void delete(String userId, String id) {
        repository.delete(owned(userId, id));
    }

    /** Ghi kết quả 1 lần ôn. {@code passed} do client chấm (không có phần thưởng để gian lận). */
    @Transactional
    public Item review(String userId, String id, boolean passed, LocalDateTime now) {
        UserMemoryVerse verse = owned(userId, id);
        MemorySchedule.applyReview(verse, passed, now);
        repository.save(verse);
        return toItem(verse, now);
    }

    private UserMemoryVerse owned(String userId, String id) {
        return repository.findOwned(id, userId)
                .orElseThrow(() -> new MemoryVerseException(NOT_FOUND, "Không tìm thấy câu trong danh sách"));
    }

    private Item toItem(UserMemoryVerse v, LocalDateTime now) {
        String text;
        try {
            text = passageText(v.getBook(), v.getChapter(), v.getVerseStart(), v.getVerseEnd());
        } catch (MemoryVerseException e) {
            text = ""; // chữ bị gỡ/chưa import lại: vẫn hiện item để user xoá được
        }
        return new Item(v.getId(), v.getBook(), v.getChapter(), v.getVerseStart(), v.getVerseEnd(), text,
                v.getMasteryLevel(), v.getNextReviewAt(), v.isDue(now));
    }

    private String passageText(String book, int chapter, int verseStart, int verseEnd) {
        List<VerseText> verses;
        try {
            verses = passageService.getPassage(book, chapter, verseStart, verseEnd)
                    .map(BiblePassageService.Passage::verses).orElse(List.of());
        } catch (IllegalArgumentException e) {
            throw new MemoryVerseException(INVALID, e.getMessage());
        }
        if (verses.size() != verseEnd - verseStart + 1) {
            throw new MemoryVerseException(INVALID, "Chưa có nội dung cho đoạn này");
        }
        return verses.stream().map(VerseText::text).collect(Collectors.joining(" "));
    }
}
