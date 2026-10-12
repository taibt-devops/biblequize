package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.entity.Question;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class RoomStateService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String KEY_PREFIX = "room:state:";
    private static final String KEY_ROUND_PREFIX = "room:state:current_round:";
    /** PCV-1: id của vòng đã đóng (đã/đang công bố đáp án) — câu trả lời tới sau bị bỏ qua. */
    private static final String KEY_CLOSED_ROUND_PREFIX = "room:state:closed_round:";
    private static final String KEY_SD_QUEUE_PREFIX = "room:state:sd_queue:";
    private static final String KEY_SD_CHAMPION_PREFIX = "room:state:sd_champion:";
    private static final String KEY_SD_CHALLENGER_PREFIX = "room:state:sd_challenger:";
    private static final String KEY_CHAT_PREFIX = "room:chat:";
    /** PCV-16: Đấu vương — số thứ tự trận, cửa sổ đoán đang mở, phiếu đoán theo trận. */
    private static final String KEY_SD_MATCH_NO_PREFIX = "room:state:sd_match_no:";
    private static final String KEY_SD_PREDICT_OPEN_PREFIX = "room:state:sd_predict_open:";
    private static final String KEY_SD_PREDICT_PREFIX = "room:state:sd_predict:";
    /** PCV-11a: đáp án của câu đang chạy — chỉ ở máy chủ. */
    private static final String KEY_ANSWER_PREFIX = "room:state:answer_key:";
    private static final Duration STATE_TTL = Duration.ofHours(2);
    // MPC-7: chat history outlives the in-game state (clearRoomState on QUIZ_END
    // must NOT wipe it) so the results screen + a page reload still show the
    // conversation. Bounded by size + TTL to keep Redis tidy.
    private static final Duration CHAT_TTL = Duration.ofHours(12);
    private static final long CHAT_MAX = 200;

    public RoomStateService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // ── Question state ──

    @SuppressWarnings("null")
    public void setCurrentQuestion(String roomId, WebSocketMessage.QuestionStartData data) {
        redisTemplate.opsForValue().set(getQuestionKey(roomId), data, STATE_TTL);
    }

    @SuppressWarnings("null")
    public Optional<WebSocketMessage.QuestionStartData> getCurrentQuestion(String roomId) {
        Object data = redisTemplate.opsForValue().get(getQuestionKey(roomId));
        if (data instanceof WebSocketMessage.QuestionStartData q) {
            return Optional.of(q);
        }
        return Optional.empty();
    }

    // ── Round state ──

    @SuppressWarnings("null")
    public void setCurrentRoundId(String roomId, String roundId) {
        redisTemplate.opsForValue().set(KEY_ROUND_PREFIX + roomId, roundId, STATE_TTL);
    }

    @SuppressWarnings("null")
    public Optional<String> getCurrentRoundId(String roomId) {
        Object val = redisTemplate.opsForValue().get(KEY_ROUND_PREFIX + roomId);
        return val != null ? Optional.of(val.toString()) : Optional.empty();
    }

    /**
     * PCV-1 — đóng vòng hiện tại: gọi ngay khi vòng kết thúc (hết giờ, đủ người trả lời,
     * Quản trò bỏ câu) và trước khi công bố đáp án. Không có vòng hiện tại thì bỏ qua.
     */
    @SuppressWarnings("null")
    public void closeCurrentRound(String roomId) {
        getCurrentRoundId(roomId).ifPresent(roundId ->
                redisTemplate.opsForValue().set(KEY_CLOSED_ROUND_PREFIX + roomId, roundId, STATE_TTL));
    }

    /** PCV-1 — vòng {@code roundId} đã đóng chưa. */
    @SuppressWarnings("null")
    public boolean isRoundClosed(String roomId, String roundId) {
        Object val = redisTemplate.opsForValue().get(KEY_CLOSED_ROUND_PREFIX + roomId);
        return val != null && val.toString().equals(roundId);
    }

    // ── Sudden Death: queue ──

    @SuppressWarnings("null")
    public void setSdQueue(String roomId, List<String> queue) {
        String value = String.join(",", queue);
        redisTemplate.opsForValue().set(KEY_SD_QUEUE_PREFIX + roomId, value, STATE_TTL);
    }

    @SuppressWarnings("null")
    public List<String> getSdQueue(String roomId) {
        Object val = redisTemplate.opsForValue().get(KEY_SD_QUEUE_PREFIX + roomId);
        if (val == null) return new ArrayList<>();
        String s = val.toString();
        if (s.isBlank()) return new ArrayList<>();
        return new ArrayList<>(Arrays.asList(s.split(",")));
    }

    // ── Sudden Death: champion / challenger ──

    @SuppressWarnings("null")
    public void setSdChampion(String roomId, String userId) {
        redisTemplate.opsForValue().set(KEY_SD_CHAMPION_PREFIX + roomId, userId, STATE_TTL);
    }

    @SuppressWarnings("null")
    public String getSdChampion(String roomId) {
        Object val = redisTemplate.opsForValue().get(KEY_SD_CHAMPION_PREFIX + roomId);
        return val != null ? val.toString() : null;
    }

    @SuppressWarnings("null")
    public void setSdChallenger(String roomId, String userId) {
        redisTemplate.opsForValue().set(KEY_SD_CHALLENGER_PREFIX + roomId, userId, STATE_TTL);
    }

    @SuppressWarnings("null")
    public String getSdChallenger(String roomId) {
        Object val = redisTemplate.opsForValue().get(KEY_SD_CHALLENGER_PREFIX + roomId);
        return val != null ? val.toString() : null;
    }

    @SuppressWarnings("null")
    public void clearSdChallenger(String roomId) {
        redisTemplate.delete(KEY_SD_CHALLENGER_PREFIX + roomId);
    }

    // ── Chat history (MPC-7) ──

    /** Append one chat message (user or system) to the room's bounded history. */
    @SuppressWarnings("null")
    public void appendChat(String roomId, Map<String, Object> message) {
        String key = KEY_CHAT_PREFIX + roomId;
        redisTemplate.opsForList().rightPush(key, message);
        // Keep only the most recent CHAT_MAX entries.
        redisTemplate.opsForList().trim(key, -CHAT_MAX, -1);
        redisTemplate.expire(key, CHAT_TTL);
    }

    /** Full chat history (oldest → newest); empty list if none/expired. */
    @SuppressWarnings("null")
    public List<Object> getChatHistory(String roomId) {
        List<Object> list = redisTemplate.opsForList().range(KEY_CHAT_PREFIX + roomId, 0, -1);
        return list != null ? list : new ArrayList<>();
    }

    // ── Clear all room state ──

    @SuppressWarnings("null")
    /**
     * PCV-11a — đáp án của câu đang chạy, giữ ở máy chủ (không bao giờ đi qua WebSocket), kèm id
     * câu để chấm được cả câu trong "bộ câu của tôi" — các câu này không nằm trong bảng
     * {@code questions} nên trước đây mọi câu trả lời đều bị chấm sai. Lớp không final để Redis
     * giữ kiểu ({@code @class}) như {@link WebSocketMessage.QuestionStartData}.
     */
    public static class AnswerKey {
        public String questionId;
        public int correctIndex;
        /** Tên enum {@link Question.Difficulty} (easy/medium/hard) hoặc null. */
        public String difficulty;
        public String book;

        public AnswerKey() {}

        public AnswerKey(String questionId, int correctIndex, String difficulty, String book) {
            this.questionId = questionId;
            this.correctIndex = correctIndex;
            this.difficulty = difficulty;
            this.book = book;
        }

        public static AnswerKey of(Question q) {
            int idx = q.getCorrectAnswer() != null && !q.getCorrectAnswer().isEmpty() ? q.getCorrectAnswer().get(0) : -1;
            return new AnswerKey(q.getId(), idx, q.getDifficulty() != null ? q.getDifficulty().name() : null, q.getBook());
        }

        public Question.Difficulty difficultyEnum() {
            if (difficulty == null) return null;
            try {
                return Question.Difficulty.valueOf(difficulty);
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }

    public void setAnswerKey(String roomId, AnswerKey key) {
        redisTemplate.opsForValue().set(KEY_ANSWER_PREFIX + roomId, key, STATE_TTL);
    }

    public Optional<AnswerKey> getAnswerKey(String roomId) {
        Object value = redisTemplate.opsForValue().get(KEY_ANSWER_PREFIX + roomId);
        return value instanceof AnswerKey key ? Optional.of(key) : Optional.empty();
    }

    /**
     * PCV-17 — giữ chỗ "ván mới" cho phòng {@code oldRoomId} (SETNX, 1 giờ). Trả null nếu lần này giữ được
     * (người gọi tạo phòng {@code newRoomId}); ngược lại trả id phòng đã có người tạo trước.
     */
    public String claimRematch(String oldRoomId, String newRoomId) {
        String key = "rematch:" + oldRoomId;
        Boolean claimed = redisTemplate.opsForValue().setIfAbsent(key, newRoomId, Duration.ofHours(1));
        if (Boolean.TRUE.equals(claimed)) return null;
        Object existing = redisTemplate.opsForValue().get(key);
        return existing != null ? existing.toString() : null;
    }

    /** PCV-16: số thứ tự trận Đấu vương kế tiếp (1, 2, …). */
    public int nextSdMatchNo(String roomId) {
        Long n = redisTemplate.opsForValue().increment(KEY_SD_MATCH_NO_PREFIX + roomId);
        redisTemplate.expire(KEY_SD_MATCH_NO_PREFIX + roomId, STATE_TTL);
        return n != null ? n.intValue() : 1;
    }

    /** PCV-16: số thứ tự trận Đấu vương đang/vừa đấu (0 nếu chưa có trận). */
    public int currentSdMatchNo(String roomId) {
        Object v = redisTemplate.opsForValue().get(KEY_SD_MATCH_NO_PREFIX + roomId);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException ignored) { return 0; }
        }
        return 0;
    }

    public void openSdPredictions(String roomId, int matchNo) {
        redisTemplate.opsForValue().set(KEY_SD_PREDICT_OPEN_PREFIX + roomId, matchNo, STATE_TTL);
    }

    public Integer getOpenSdPredictionMatch(String roomId) {
        Object v = redisTemplate.opsForValue().get(KEY_SD_PREDICT_OPEN_PREFIX + roomId);
        return v instanceof Number n ? n.intValue() : null;
    }

    public void closeSdPredictions(String roomId) {
        redisTemplate.delete(KEY_SD_PREDICT_OPEN_PREFIX + roomId);
    }

    public void putSdPrediction(String roomId, int matchNo, String userId, String pickUserId) {
        String key = KEY_SD_PREDICT_PREFIX + roomId + ":" + matchNo;
        redisTemplate.opsForHash().put(key, userId, pickUserId);
        redisTemplate.expire(key, STATE_TTL);
    }

    public Map<String, String> getSdPredictions(String roomId, int matchNo) {
        Map<Object, Object> raw = redisTemplate.opsForHash().entries(KEY_SD_PREDICT_PREFIX + roomId + ":" + matchNo);
        Map<String, String> out = new java.util.HashMap<>();
        raw.forEach((k, v) -> { if (k != null && v != null) out.put(k.toString(), v.toString()); });
        return out;
    }

    public void clearRoomState(String roomId) {
        redisTemplate.delete(getQuestionKey(roomId));
        redisTemplate.delete(KEY_SD_MATCH_NO_PREFIX + roomId);
        redisTemplate.delete(KEY_SD_PREDICT_OPEN_PREFIX + roomId);
        redisTemplate.delete(KEY_ANSWER_PREFIX + roomId);
        redisTemplate.delete(KEY_ROUND_PREFIX + roomId);
        redisTemplate.delete(KEY_CLOSED_ROUND_PREFIX + roomId);
        redisTemplate.delete(KEY_SD_QUEUE_PREFIX + roomId);
        redisTemplate.delete(KEY_SD_CHAMPION_PREFIX + roomId);
        redisTemplate.delete(KEY_SD_CHALLENGER_PREFIX + roomId);
    }

    private String getQuestionKey(String roomId) {
        return KEY_PREFIX + "current_question:" + roomId;
    }
}
