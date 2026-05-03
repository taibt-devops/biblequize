package com.biblequiz.modules.userquiz.service;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.modules.userquiz.entity.QuestionSet;
import com.biblequiz.modules.userquiz.entity.QuestionSetItem;
import com.biblequiz.modules.userquiz.entity.UserQuestion;
import com.biblequiz.modules.userquiz.repository.QuestionSetItemRepository;
import com.biblequiz.modules.userquiz.repository.QuestionSetRepository;
import com.biblequiz.modules.userquiz.repository.UserQuestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class QuestionSetService {

    private static final Logger log = LoggerFactory.getLogger(QuestionSetService.class);
    private static final int MAX_SETS_PER_USER = 10;

    @Autowired private QuestionSetRepository setRepo;
    @Autowired private QuestionSetItemRepository itemRepo;
    @Autowired private UserQuestionRepository questionRepo;
    @Autowired private UserRepository userRepo;

    // ── Create ────────────────────────────────────────────────────────────────

    public QuestionSet create(User user, String name, String description) {
        long count = setRepo.countByUserId(user.getId());
        if (count >= MAX_SETS_PER_USER) {
            throw new IllegalStateException("Đã đạt giới hạn " + MAX_SETS_PER_USER + " bộ câu hỏi.");
        }
        QuestionSet set = new QuestionSet();
        set.setId(UUID.randomUUID().toString());
        set.setName(name);
        set.setDescription(description);
        set.setUser(user);
        QuestionSet saved = setRepo.save(set);
        log.info("[QuestionSet] User {} created set '{}'", user.getId(), name);
        return saved;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public List<QuestionSet> listByUser(String userId) {
        return setRepo.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    public List<QuestionSet> listPublic() {
        return setRepo.findByVisibilityOrderByUpdatedAtDesc(QuestionSet.Visibility.PUBLIC);
    }

    public QuestionSet getById(String setId) {
        return setRepo.findById(setId)
                .orElseThrow(() -> new IllegalArgumentException("Bộ câu hỏi không tồn tại"));
    }

    public List<QuestionSetItem> getItems(String setId) {
        return itemRepo.findByQuestionSetIdOrderByOrderIndexAsc(setId);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public QuestionSet update(String setId, String userId, String name, String description) {
        QuestionSet set = requireOwnerNotLocked(setId, userId);
        set.setName(name);
        set.setDescription(description);
        return setRepo.save(set);
    }

    public QuestionSet setVisibility(String setId, String userId, QuestionSet.Visibility visibility) {
        QuestionSet set = requireOwner(setId, userId);
        set.setVisibility(visibility);
        return setRepo.save(set);
    }

    // ── Question management ───────────────────────────────────────────────────

    public QuestionSetItem addQuestion(String setId, String questionId, String userId) {
        QuestionSet set = requireOwnerNotLocked(setId, userId);
        UserQuestion q = questionRepo.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Câu hỏi không tồn tại"));

        List<QuestionSetItem> existing = itemRepo.findByQuestionSetIdOrderByOrderIndexAsc(setId);
        boolean alreadyAdded = existing.stream()
                .anyMatch(i -> i.getUserQuestion().getId().equals(questionId));
        if (alreadyAdded) throw new IllegalStateException("Câu hỏi đã có trong bộ này");

        int nextOrder = existing.isEmpty() ? 0 : existing.get(existing.size() - 1).getOrderIndex() + 1;
        QuestionSetItem item = new QuestionSetItem(UUID.randomUUID().toString(), set, q, nextOrder);
        QuestionSetItem saved = itemRepo.save(item);

        set.setQuestionCount(existing.size() + 1);
        setRepo.save(set);
        return saved;
    }

    public void removeQuestion(String setId, String questionId, String userId) {
        QuestionSet set = requireOwnerNotLocked(setId, userId);
        List<QuestionSetItem> items = itemRepo.findByQuestionSetIdOrderByOrderIndexAsc(setId);
        items.stream()
                .filter(i -> i.getUserQuestion().getId().equals(questionId))
                .findFirst()
                .ifPresent(item -> {
                    itemRepo.delete(item);
                    set.setQuestionCount(Math.max(0, set.getQuestionCount() - 1));
                    setRepo.save(set);
                });
    }

    /** Replace all questions in set with ordered list (for reorder + bulk assign) */
    public void replaceItems(String setId, List<String> orderedQuestionIds, String userId) {
        QuestionSet set = requireOwnerNotLocked(setId, userId);
        itemRepo.deleteByQuestionSetId(setId);

        List<QuestionSetItem> newItems = new ArrayList<>();
        for (int i = 0; i < orderedQuestionIds.size(); i++) {
            String qId = orderedQuestionIds.get(i);
            UserQuestion q = questionRepo.findById(qId)
                    .orElseThrow(() -> new IllegalArgumentException("Câu hỏi không tồn tại: " + qId));
            newItems.add(new QuestionSetItem(UUID.randomUUID().toString(), set, q, i));
        }
        itemRepo.saveAll(newItems);
        set.setQuestionCount(newItems.size());
        setRepo.save(set);
        log.info("[QuestionSet] Set {} updated with {} questions", setId, newItems.size());
    }

    // ── Share (copy) ──────────────────────────────────────────────────────────

    /** Copy this set (and its questions) to targetUser. Returns new set owned by target. */
    public QuestionSet share(String setId, String ownerId, String targetEmail) {
        QuestionSet original = requireOwner(setId, ownerId);
        if (original.getVisibility() == QuestionSet.Visibility.PRIVATE) {
            throw new IllegalStateException("Chỉ có thể share bộ câu hỏi không phải PRIVATE");
        }
        User target = userRepo.findByEmail(targetEmail)
                .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại: " + targetEmail));

        long targetCount = setRepo.countByUserId(target.getId());
        if (targetCount >= MAX_SETS_PER_USER) {
            throw new IllegalStateException("Người nhận đã đạt giới hạn bộ câu hỏi");
        }

        // Copy set metadata
        QuestionSet copy = new QuestionSet();
        copy.setId(UUID.randomUUID().toString());
        copy.setName(original.getName() + " (copy)");
        copy.setDescription(original.getDescription());
        copy.setUser(target);
        copy.setVisibility(QuestionSet.Visibility.PRIVATE);
        QuestionSet savedCopy = setRepo.save(copy);

        // Copy questions as new UserQuestion rows owned by target
        List<QuestionSetItem> originalItems = itemRepo.findByQuestionSetIdOrderByOrderIndexAsc(setId);
        List<QuestionSetItem> copiedItems = new ArrayList<>();
        for (QuestionSetItem item : originalItems) {
            UserQuestion orig = item.getUserQuestion();
            UserQuestion qCopy = new UserQuestion();
            qCopy.setId(UUID.randomUUID().toString());
            qCopy.setUser(target);
            qCopy.setContent(orig.getContent());
            qCopy.setOptions(new ArrayList<>(orig.getOptions()));
            qCopy.setCorrectAnswer(orig.getCorrectAnswer());
            qCopy.setDifficulty(orig.getDifficulty());
            qCopy.setExplanation(orig.getExplanation());
            qCopy.setBook(orig.getBook());
            qCopy.setChapterStart(orig.getChapterStart());
            qCopy.setChapterEnd(orig.getChapterEnd());
            qCopy.setVerseStart(orig.getVerseStart());
            qCopy.setVerseEnd(orig.getVerseEnd());
            qCopy.setTheme(orig.getTheme());
            qCopy.setSource(UserQuestion.Source.MANUAL); // copied questions = manual
            qCopy.setLanguage(orig.getLanguage() != null ? orig.getLanguage() : "vi");
            UserQuestion savedQ = questionRepo.save(qCopy);
            copiedItems.add(new QuestionSetItem(UUID.randomUUID().toString(), savedCopy, savedQ, item.getOrderIndex()));
        }
        itemRepo.saveAll(copiedItems);
        savedCopy.setQuestionCount(copiedItems.size());
        setRepo.save(savedCopy);

        log.info("[QuestionSet] Set {} shared from {} to {}", setId, ownerId, targetEmail);
        return savedCopy;
    }

    /** Anyone can copy a PUBLIC set into their own library */
    public QuestionSet copyPublic(String setId, User user) {
        QuestionSet original = getById(setId);
        if (original.getVisibility() != QuestionSet.Visibility.PUBLIC) {
            throw new IllegalStateException("Bộ câu hỏi này không phải public");
        }
        if (original.getUser().getId().equals(user.getId())) {
            throw new IllegalStateException("Không thể copy bộ câu hỏi của chính mình");
        }
        long count = setRepo.countByUserId(user.getId());
        if (count >= MAX_SETS_PER_USER) {
            throw new IllegalStateException("Đã đạt giới hạn " + MAX_SETS_PER_USER + " bộ câu hỏi");
        }

        QuestionSet copy = new QuestionSet();
        copy.setId(UUID.randomUUID().toString());
        copy.setName(original.getName() + " (copy)");
        copy.setDescription(original.getDescription());
        copy.setUser(user);
        copy.setVisibility(QuestionSet.Visibility.PRIVATE);
        QuestionSet savedCopy = setRepo.save(copy);

        List<QuestionSetItem> items = itemRepo.findByQuestionSetIdOrderByOrderIndexAsc(setId);
        List<QuestionSetItem> copies = new ArrayList<>();
        for (QuestionSetItem item : items) {
            UserQuestion orig = item.getUserQuestion();
            UserQuestion qCopy = new UserQuestion();
            qCopy.setId(UUID.randomUUID().toString());
            qCopy.setUser(user);
            qCopy.setContent(orig.getContent());
            qCopy.setOptions(new ArrayList<>(orig.getOptions()));
            qCopy.setCorrectAnswer(orig.getCorrectAnswer());
            qCopy.setDifficulty(orig.getDifficulty());
            qCopy.setExplanation(orig.getExplanation());
            qCopy.setBook(orig.getBook());
            qCopy.setChapterStart(orig.getChapterStart());
            qCopy.setChapterEnd(orig.getChapterEnd());
            qCopy.setTheme(orig.getTheme());
            qCopy.setSource(UserQuestion.Source.MANUAL);
            qCopy.setLanguage(orig.getLanguage() != null ? orig.getLanguage() : "vi");
            copies.add(new QuestionSetItem(UUID.randomUUID().toString(), savedCopy, questionRepo.save(qCopy), item.getOrderIndex()));
        }
        itemRepo.saveAll(copies);
        savedCopy.setQuestionCount(copies.size());
        setRepo.save(savedCopy);
        return savedCopy;
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public void delete(String setId, String userId) {
        QuestionSet set = requireOwnerNotLocked(setId, userId);
        setRepo.delete(set);
        log.info("[QuestionSet] Set {} deleted by {}", setId, userId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public boolean isLocked(String setId) {
        return setRepo.countActiveRoomsUsingSet(setId) > 0;
    }

    private QuestionSet requireOwner(String setId, String userId) {
        QuestionSet set = getById(setId);
        if (!set.getUser().getId().equals(userId)) {
            throw new SecurityException("Không có quyền chỉnh sửa bộ câu hỏi này");
        }
        return set;
    }

    private QuestionSet requireOwnerNotLocked(String setId, String userId) {
        QuestionSet set = requireOwner(setId, userId);
        if (isLocked(setId)) {
            throw new IllegalStateException("Bộ câu hỏi đang được dùng trong phòng đang chạy, không thể chỉnh sửa");
        }
        return set;
    }
}
