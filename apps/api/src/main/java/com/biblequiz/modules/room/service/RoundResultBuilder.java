package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * PCV-2 — dựng payload {@code ROUND_END} khi vòng đã đóng: đáp án, giải thích, câu gốc,
 * số người chọn từng phương án, kết quả từng người (design §1.3, §1.9). Đúng/sai và điểm
 * của từng người chỉ được công bố ở đây — {@code ANSWER_SUBMITTED} không còn mang chúng.
 */
@Component
public class RoundResultBuilder {

    static final long REVEAL_PAUSE_MS = 5_000;
    static final long REVEAL_PAUSE_WITH_EXPLANATION_MS = 7_000;

    private final RoomAnswerRepository answerRepository;
    private final RoomPlayerRepository playerRepository;
    private final RoomService roomService;

    public RoundResultBuilder(RoomAnswerRepository answerRepository,
                              RoomPlayerRepository playerRepository,
                              RoomService roomService) {
        this.answerRepository = answerRepository;
        this.playerRepository = playerRepository;
        this.roomService = roomService;
    }

    /**
     * PCV-11 — hết vòng: người còn trong cuộc (ACTIVE) mà không trả lời thì mất chuỗi đúng liên tiếp.
     * Người trả lời đã được cập nhật chuỗi lúc chấm.
     */
    public void closeRound(String roomId, String roundId) {
        java.util.Set<String> answered = new java.util.HashSet<>();
        for (RoomAnswer a : answerRepository.findByRoundId(roundId)) answered.add(a.getUserId());
        List<RoomPlayer> changed = new java.util.ArrayList<>();
        for (RoomPlayer p : playerRepository.findByRoomId(roomId)) {
            if (p.getPlayerStatus() != RoomPlayer.PlayerStatus.ACTIVE) continue;
            if (answered.contains(p.getUser().getId())) continue;
            if (p.getAnswerStreak() > 0) {
                p.setAnswerStreak(0);
                changed.add(p);
            }
        }
        if (!changed.isEmpty()) playerRepository.saveAll(changed);
    }

    public WebSocketMessage.RoundEndData build(String roomId, String roundId, Question q) {
        int correctIndex = q.getCorrectAnswer() != null && !q.getCorrectAnswer().isEmpty() ? q.getCorrectAnswer().get(0) : -1;
        WebSocketMessage.RoundEndData data =
                new WebSocketMessage.RoundEndData(correctIndex, roomService.getRoomLeaderboard(roomId));
        data.explanation = q.getExplanation() != null && !q.getExplanation().isBlank() ? q.getExplanation() : null;
        data.reference = q.getBook() != null && !q.getBook().isBlank()
                ? new WebSocketMessage.RoundEndData.Reference(q.getBook(), q.getChapter(), q.getVerseStart(), q.getVerseEnd())
                : null;

        int optionCount = q.getOptions() != null ? q.getOptions().size() : 4;
        int[] counts = new int[optionCount];
        Map<String, RoomAnswer> byUser = new HashMap<>();
        for (RoomAnswer a : answerRepository.findByRoundId(roundId)) {
            byUser.put(a.getUserId(), a);
            Integer idx = a.getAnswerIndex();
            if (idx != null && idx >= 0 && idx < optionCount) counts[idx]++;
        }
        data.answerCounts = counts;

        List<RoomPlayer> players = playerRepository.findByRoomId(roomId);
        data.results = players.stream().map(p -> {
            RoomAnswer a = byUser.get(p.getUser().getId());
            return new WebSocketMessage.RoundEndData.PlayerResult(
                    p.getUser().getId(),
                    a != null,
                    a != null && Boolean.TRUE.equals(a.getIsCorrect()),
                    a != null && a.getPointsEarned() != null ? a.getPointsEarned() : 0,
                    p.getAnswerStreak());
        }).toList();
        return data;
    }

    /** Thời gian nghỉ sau khi công bố: 5 s, có giải thích thì 7 s cho kịp đọc. */
    public static long revealPauseMs(Question q) {
        return q.getExplanation() != null && !q.getExplanation().isBlank()
                ? REVEAL_PAUSE_WITH_EXPLANATION_MS : REVEAL_PAUSE_MS;
    }
}
