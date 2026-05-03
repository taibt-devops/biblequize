package com.biblequiz.modules.userquiz.service;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.userquiz.entity.RoomQuestionSelection;
import com.biblequiz.modules.userquiz.entity.UserQuestion;
import com.biblequiz.modules.userquiz.repository.RoomQuestionSelectionRepository;
import com.biblequiz.modules.userquiz.repository.UserQuestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class UserQuestionService {

    private static final Logger log = LoggerFactory.getLogger(UserQuestionService.class);
    private static final int MAX_QUESTIONS_PER_USER = 500;

    @Autowired private UserQuestionRepository questionRepo;
    @Autowired private RoomQuestionSelectionRepository selectionRepo;
    @Autowired private RoomRepository roomRepository;
    @Autowired private QuizGeneratorPort quizGenerator;

    // ── AI generation ─────────────────────────────────────────────────────────

    public List<UserQuestion> generateAndSave(User user, QuizGeneratorPort.QuizGenerationParams params)
            throws Exception {

        enforceQuotaOrThrow(user);

        List<QuizGeneratorPort.GeneratedQuestionDTO> generated = quizGenerator.generate(params);
        if (generated.isEmpty()) {
            throw new IllegalStateException("AI không tạo được câu hỏi nào. Thử lại hoặc thay đổi tham số.");
        }

        List<UserQuestion> saved = generated.stream().map(dto -> {
            UserQuestion q = new UserQuestion();
            q.setId(UUID.randomUUID().toString());
            q.setUser(user);
            q.setContent(dto.content());
            q.setOptions(dto.options());
            q.setCorrectAnswer(dto.correctAnswer());
            q.setDifficulty(parseDifficulty(dto.difficulty()));
            q.setExplanation(dto.explanation());
            q.setBook(dto.book());
            q.setChapterStart(dto.chapter());
            q.setChapterEnd(dto.chapter());
            q.setVerseStart(dto.verseStart());
            q.setVerseEnd(dto.verseEnd());
            q.setTheme(params.theme());
            q.setSource(UserQuestion.Source.AI);
            q.setLanguage(params.language() != null ? params.language() : "vi");
            return questionRepo.save(q);
        }).toList();

        log.info("[UserQuestionService] User {} AI-generated {} questions (provider: {})",
                user.getId(), saved.size(), quizGenerator.providerName());
        return saved;
    }

    // ── Manual creation ───────────────────────────────────────────────────────

    public UserQuestion saveManual(User user, ManualQuestionRequest req) {
        enforceQuotaOrThrow(user);

        if (req.options() == null || req.options().size() != 4) {
            throw new IllegalArgumentException("Câu hỏi thủ công cần đúng 4 đáp án");
        }
        if (req.correctAnswer() < 0 || req.correctAnswer() > 3) {
            throw new IllegalArgumentException("correctAnswer phải là 0-3");
        }

        UserQuestion q = new UserQuestion();
        q.setId(UUID.randomUUID().toString());
        q.setUser(user);
        q.setContent(req.content());
        q.setOptions(req.options());
        q.setCorrectAnswer(req.correctAnswer());
        q.setDifficulty(req.difficulty() != null ? req.difficulty() : UserQuestion.Difficulty.MIXED);
        q.setExplanation(req.explanation());
        q.setBook(req.book());
        q.setChapterStart(req.chapter());
        q.setChapterEnd(req.chapter());
        q.setTheme(req.theme());
        q.setSource(UserQuestion.Source.MANUAL);
        q.setLanguage(req.language() != null ? req.language() : "vi");
        return questionRepo.save(q);
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    public List<UserQuestion> listByUser(String userId) {
        return questionRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public void delete(String questionId, String userId) {
        UserQuestion q = questionRepo.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Câu hỏi không tồn tại"));
        if (!q.getUser().getId().equals(userId)) {
            throw new SecurityException("Không có quyền xoá câu hỏi này");
        }
        questionRepo.delete(q);
    }

    // ── Room question management ──────────────────────────────────────────────

    public void assignToRoom(String roomId, List<String> questionIds, String userId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Phòng không tồn tại"));

        if (!room.getHost().getId().equals(userId)) {
            throw new SecurityException("Chỉ host mới được gán câu hỏi cho phòng");
        }
        if (room.getStatus() != Room.RoomStatus.LOBBY) {
            throw new IllegalStateException("Chỉ gán câu hỏi khi phòng đang ở lobby");
        }

        selectionRepo.deleteByRoomId(roomId);

        for (int i = 0; i < questionIds.size(); i++) {
            String qId = questionIds.get(i);
            UserQuestion q = questionRepo.findById(qId)
                    .orElseThrow(() -> new IllegalArgumentException("Câu hỏi không tồn tại: " + qId));
            selectionRepo.save(new RoomQuestionSelection(
                    UUID.randomUUID().toString(), room, q, i));
        }

        room.setQuestionSource(Room.QuestionSource.CUSTOM);
        room.setQuestionCount(questionIds.size());
        roomRepository.save(room);

        log.info("[UserQuestionService] Room {} assigned {} custom questions", roomId, questionIds.size());
    }

    public List<RoomQuestionSelection> getRoomSelections(String roomId) {
        return selectionRepo.findByRoomIdOrderByOrderIndex(roomId);
    }

    public void removeFromRoom(String roomId, String questionId, String userId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Phòng không tồn tại"));
        if (!room.getHost().getId().equals(userId)) {
            throw new SecurityException("Chỉ host mới được thay đổi câu hỏi");
        }
        selectionRepo.findByRoomIdOrderByOrderIndex(roomId).stream()
                .filter(s -> s.getUserQuestion().getId().equals(questionId))
                .findFirst()
                .ifPresent(selectionRepo::delete);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void enforceQuotaOrThrow(User user) {
        long count = questionRepo.countByUserId(user.getId());
        if (count >= MAX_QUESTIONS_PER_USER) {
            throw new IllegalStateException(
                    "Đã đạt giới hạn " + MAX_QUESTIONS_PER_USER + " câu hỏi. Xoá bớt để tạo thêm.");
        }
    }

    private UserQuestion.Difficulty parseDifficulty(String d) {
        if (d == null) return UserQuestion.Difficulty.MIXED;
        try { return UserQuestion.Difficulty.valueOf(d.toUpperCase()); }
        catch (IllegalArgumentException e) { return UserQuestion.Difficulty.MIXED; }
    }

    // ── Nested request record ─────────────────────────────────────────────────

    public record ManualQuestionRequest(
        String content,
        List<String> options,
        int correctAnswer,
        UserQuestion.Difficulty difficulty,
        String explanation,
        String book,
        Integer chapter,
        String theme,
        String language
    ) {}
}
