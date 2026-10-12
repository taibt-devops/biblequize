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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class QuestionSetService {

    private static final Logger log = LoggerFactory.getLogger(QuestionSetService.class);
    private static final int MAX_SETS_PER_USER = 10;
    public static final int MIN_QUESTIONS_TO_PUBLISH = 5;
    public static final int MIN_NAME_LENGTH = 3;

    @Autowired private QuestionSetRepository setRepo;
    @Autowired private QuestionSetItemRepository itemRepo;
    @Autowired private UserQuestionRepository questionRepo;
    @Autowired private UserRepository userRepo;

    // ── Create ────────────────────────────────────────────────────────────────

    public QuestionSet create(User user, String name, String description) {
        return create(user, name, description, null);
    }

    public QuestionSet create(User user, String name, String description, Map<String, Object> metadata) {
        long count = setRepo.countByUserId(user.getId());
        if (count >= MAX_SETS_PER_USER) {
            throw new IllegalStateException("Đã đạt giới hạn " + MAX_SETS_PER_USER + " bộ câu hỏi.");
        }
        QuestionSet set = new QuestionSet();
        set.setId(UUID.randomUUID().toString());
        set.setName(name);
        set.setDescription(description);
        set.setUser(user);
        applyMetadata(set, metadata);
        QuestionSet saved = setRepo.save(set);
        log.info("[QuestionSet] User {} created set '{}'", user.getId(), name);
        return saved;
    }

    /** PATCH metadata + name/description partial update. Locked sets cannot be edited. */
    public QuestionSet patchMetadata(String setId, String userId, Map<String, Object> patch) {
        QuestionSet set = requireOwnerNotLocked(setId, userId);
        if (patch == null) return set;
        if (patch.containsKey("name")) {
            Object v = patch.get("name");
            if (v instanceof String s && !s.isBlank()) set.setName(s);
        }
        if (patch.containsKey("description")) {
            Object v = patch.get("description");
            set.setDescription(v instanceof String s ? s : null);
        }
        applyMetadata(set, patch);
        return setRepo.save(set);
    }

    @SuppressWarnings("unchecked")
    private void applyMetadata(QuestionSet set, Map<String, Object> m) {
        if (m == null) return;
        if (m.containsKey("coverImageUrl")) set.setCoverImageUrl((String) m.get("coverImageUrl"));
        if (m.containsKey("tags") && m.get("tags") instanceof List<?> tagList) {
            List<String> stringTags = tagList.stream()
                    .filter(java.util.Objects::nonNull)
                    .map(Object::toString)
                    .toList();
            set.setTags(stringTags.size() > 5
                    ? new ArrayList<>(stringTags.subList(0, 5))
                    : new ArrayList<>(stringTags));
        }
        if (m.containsKey("coverScripture")) set.setCoverScripture((String) m.get("coverScripture"));
        if (m.containsKey("authorNote")) set.setAuthorNote((String) m.get("authorNote"));
        if (m.containsKey("suggestedMode")) set.setSuggestedMode((String) m.get("suggestedMode"));
        if (m.containsKey("language")) {
            Object v = m.get("language");
            if (v instanceof String s && !s.isBlank()) set.setLanguage(s.toUpperCase());
        }
        if (m.containsKey("difficulty")) {
            Object d = m.get("difficulty");
            if (d == null) set.setDifficulty(null);
            else if (d instanceof String s && !s.isBlank()) {
                try { set.setDifficulty(QuestionSet.Difficulty.valueOf(s.toUpperCase())); }
                catch (IllegalArgumentException ignored) { /* skip invalid */ }
            }
        }
        if (m.containsKey("estimatedDurationMin")) {
            Object v = m.get("estimatedDurationMin");
            if (v == null) set.setEstimatedDurationMin(null);
            else if (v instanceof Number n) set.setEstimatedDurationMin(n.intValue());
        }
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

    /** DRAFT → PUBLISHED transition. Validates name length + question count. */
    public QuestionSet publish(String setId, String userId) {
        QuestionSet set = requireOwner(setId, userId);
        if (set.getPublishStatus() != QuestionSet.PublishStatus.DRAFT) {
            throw new IllegalStateException("Chỉ bộ DRAFT mới publish được (hiện: " + set.getPublishStatus() + ")");
        }
        if (set.getName() == null || set.getName().trim().length() < MIN_NAME_LENGTH) {
            throw new IllegalStateException("Tên bộ phải có ≥" + MIN_NAME_LENGTH + " ký tự");
        }
        if (set.getQuestionCount() < MIN_QUESTIONS_TO_PUBLISH) {
            throw new IllegalStateException("Cần tối thiểu " + MIN_QUESTIONS_TO_PUBLISH + " câu hỏi để publish");
        }
        set.setPublishStatus(QuestionSet.PublishStatus.PUBLISHED);
        set.setPublishedAt(LocalDateTime.now());
        log.info("[QuestionSet] Set {} published by user {}", setId, userId);
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
