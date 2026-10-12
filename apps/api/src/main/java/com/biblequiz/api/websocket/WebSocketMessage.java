package com.biblequiz.api.websocket;

import com.biblequiz.modules.quiz.entity.Answer;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.service.RoomService;

import java.util.Map;

public class WebSocketMessage {

    /**
     * Message types for different events
     */
    public static class MessageTypes {
        // Room events
        public static final String PLAYER_JOINED = "PLAYER_JOINED";
        public static final String PLAYER_LEFT = "PLAYER_LEFT";
        public static final String PLAYER_KICKED = "PLAYER_KICKED";
        public static final String PLAYER_READY = "PLAYER_READY";
        public static final String PLAYER_UNREADY = "PLAYER_UNREADY";
        public static final String ROOM_STARTING = "ROOM_STARTING";
        public static final String ROOM_ENDED = "ROOM_ENDED";
        public static final String HOST_CHANGED = "HOST_CHANGED";
        /** Atomic snapshot of the room (status + players + config). Replaces
         *  per-event fetchRoom REST round-trips on the FE — see
         *  RoomWebSocketController.broadcastRoomState. */
        public static final String ROOM_STATE = "ROOM_STATE";

        // Quiz events
        public static final String GAME_STARTING = "GAME_STARTING";
        public static final String QUESTION_START = "QUESTION_START";
        public static final String ANSWER_SUBMITTED = "ANSWER_SUBMITTED";
        public static final String ROUND_END = "ROUND_END";
        public static final String QUESTION_END = "QUESTION_END";
        public static final String QUIZ_END = "QUIZ_END";

        // Battle Royale events
        public static final String PLAYER_ELIMINATED = "PLAYER_ELIMINATED";
        /** PCV-13: Sinh tồn — bóng hồi sinh với 1 mạng. */
        public static final String PLAYER_REVIVED = "PLAYER_REVIVED";
        /** PCV-16: Đấu vương — kết quả đoán của khán giả sau mỗi trận. */
        public static final String PREDICTION_RESULT = "PREDICTION_RESULT";
        /** PCV-17: ván mới đã mở cho nhóm của phòng cũ. */
        public static final String REMATCH_READY = "REMATCH_READY";
        public static final String BATTLE_ROYALE_UPDATE = "BATTLE_ROYALE_UPDATE";

        // Scoreboard events
        public static final String SCORE_UPDATE = "SCORE_UPDATE";
        public static final String LEADERBOARD_UPDATE = "LEADERBOARD_UPDATE";

        // Team vs Team events
        public static final String TEAM_ASSIGNMENT = "TEAM_ASSIGNMENT";
        public static final String TEAM_SCORE_UPDATE = "TEAM_SCORE_UPDATE";
        public static final String PERFECT_ROUND = "PERFECT_ROUND";

        // Sudden Death events
        public static final String MATCH_START = "MATCH_START";
        public static final String MATCH_END = "MATCH_END";
        public static final String SD_QUEUE_UPDATE = "SD_QUEUE_UPDATE";

        // Group Live Sequential events (Feature A)
        public static final String SEQUENTIAL_PROGRESS = "SEQUENTIAL_PROGRESS"; // Mỗi answer → broadcast {answered, total}
        public static final String QUESTION_REVEALED = "QUESTION_REVEALED";    // All-answered/timeout → reveal correct + per-player answers
        public static final String NEXT_QUESTION = "NEXT_QUESTION";            // Host bấm advance → trigger next iteration

        // Social events
        public static final String REACTION = "REACTION";
        public static final String CHALLENGE_RECEIVED = "CHALLENGE_RECEIVED";
        // Free-form chat broadcast inside a room. Payload: {sender, text}.
        public static final String CHAT_MESSAGE = "CHAT_MESSAGE";

        // Error events
        public static final String ERROR = "ERROR";

        // Host control events (Sprint 4 — Quản trò controls)
        public static final String GAME_PAUSED = "GAME_PAUSED";
        public static final String GAME_RESUMED = "GAME_RESUMED";
        public static final String QUESTION_SKIPPED = "QUESTION_SKIPPED";
        public static final String HOST_BROADCAST = "HOST_BROADCAST";
    }

    /**
     * Generic message wrapper
     */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class Message {
        private String type;
        private Object data;
        private String timestamp;

        public Message() {
        }

        public Message(String type, Object data) {
            this.type = type;
            this.data = data;
            this.timestamp = String.valueOf(System.currentTimeMillis());
        }

        // Getters and Setters
        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public Object getData() {
            return data;
        }

        public void setData(Object data) {
            this.data = data;
        }

        public String getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }
    }

    /**
     * Player join event data
     */
    public static class PlayerJoinedData {
        public final String playerId;
        public final String username;
        public final String avatarUrl;
        public final RoomService.PlayerInfoDTO playerInfo;

        public PlayerJoinedData(String playerId, String username, String avatarUrl,
                RoomService.PlayerInfoDTO playerInfo) {
            this.playerId = playerId;
            this.username = username;
            this.avatarUrl = avatarUrl;
            this.playerInfo = playerInfo;
        }
    }

    /**
     * Player ready event data
     */
    public static class PlayerReadyData {
        public final String playerId;
        public final String username;
        public final Boolean isReady;

        public PlayerReadyData(String playerId, String username, Boolean isReady) {
            this.playerId = playerId;
            this.username = username;
            this.isReady = isReady;
        }
    }

    /**
     * Question event data
     */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class QuestionStartData {
        public int questionIndex;
        public int totalQuestions;
        public Object question; // Question from database
        public int timeLimit;
        /** SPEC §5.4 / Sprint 2 — server-authoritative reference for the
         *  question timer. FE computes remaining = timeLimit - (now - startedAtMs).
         *  Without this, slow-network clients drift and Speed Race scoring is
         *  unfair (audit Phase 5). Long because the field is JSON-serialised
         *  as a JS number; epoch millis fits safely in a 53-bit double. */
        public Long startedAtMs;
        /** PCV-11: hệ số điểm của câu (câu chốt Đua tốc độ = 2). Bản lưu cũ trong Redis thiếu trường → 1. */
        public int multiplier = 1;
        /** PCV-12: Sinh tồn — câu ở vùng nguy hiểm (thời gian rút ngắn). */
        public boolean dangerZone;
        /** PCV-12: Sinh tồn — câu quyết định (sai là bị loại ngay). */
        public boolean showdown;

        public QuestionStartData() {
        }

        public QuestionStartData(int questionIndex, int totalQuestions, Object question, int timeLimit) {
            this(questionIndex, totalQuestions, question, timeLimit, System.currentTimeMillis());
        }

        public QuestionStartData(int questionIndex, int totalQuestions, Object question, int timeLimit, Long startedAtMs) {
            this.questionIndex = questionIndex;
            this.totalQuestions = totalQuestions;
            this.question = question;
            this.timeLimit = timeLimit;
            this.startedAtMs = startedAtMs;
        }
    }

    /**
     * Answer submission data
     */
    public static class AnswerSubmittedData {
        public final String playerId;
        public final String username;
        public final int questionIndex;
        public final int answerIndex;
        public final long reactionTimeMs;
        public final boolean isCorrect;

        public AnswerSubmittedData(String playerId, String username, int questionIndex, int answerIndex,
                long reactionTimeMs, boolean isCorrect) {
            this.playerId = playerId;
            this.username = username;
            this.questionIndex = questionIndex;
            this.answerIndex = answerIndex;
            this.reactionTimeMs = reactionTimeMs;
            this.isCorrect = isCorrect;
        }
    }

    /**
     * Score update data
     */
    public static class ScoreUpdateData {
        public final String playerId;
        public final String username;
        public final int newScore;
        public final int correctAnswers;
        public final int totalAnswered;

        public ScoreUpdateData(String playerId, String username, int newScore, int correctAnswers, int totalAnswered) {
            this.playerId = playerId;
            this.username = username;
            this.newScore = newScore;
            this.correctAnswers = correctAnswers;
            this.totalAnswered = totalAnswered;
        }
    }

    /**
     * Round end event data (broadcast đáp án đúng + leaderboard sau mỗi câu)
     */
    public static class RoundEndData {
        public final int correctIndex;
        public final Object leaderboard;
        /** PCV-2: giải thích + câu gốc — công bố cùng đáp án (không gửi lúc phát câu). */
        public String explanation;
        public Reference reference;
        /** PCV-2: số người chọn từng phương án (index = phương án). */
        public int[] answerCounts;
        /** PCV-2: kết quả từng người — chỉ công bố khi vòng đã đóng. */
        public java.util.List<PlayerResult> results;

        public RoundEndData(int correctIndex, Object leaderboard) {
            this.correctIndex = correctIndex;
            this.leaderboard = leaderboard;
        }

        public static class Reference {
            public final String book;
            public final Integer chapter;
            public final Integer verseStart;
            public final Integer verseEnd;

            public Reference(String book, Integer chapter, Integer verseStart, Integer verseEnd) {
                this.book = book;
                this.chapter = chapter;
                this.verseStart = verseStart;
                this.verseEnd = verseEnd;
            }
        }

        public static class PlayerResult {
            public final String playerId;
            public final boolean answered;
            public final boolean isCorrect;
            public final int pointsEarned;
            /** Chuỗi đúng liên tiếp sau câu này (Đua tốc độ, đợt 2); 0 nếu mode không dùng. */
            public final int streak;

            public PlayerResult(String playerId, boolean answered, boolean isCorrect, int pointsEarned, int streak) {
                this.playerId = playerId;
                this.answered = answered;
                this.isCorrect = isCorrect;
                this.pointsEarned = pointsEarned;
                this.streak = streak;
            }
        }
    }

    /**
     * Player eliminated event (Battle Royale)
     */
    public static class PlayerEliminatedData {
        public final String userId;
        public final String username;
        public final int rank;
        public final int activeRemaining;

        public PlayerEliminatedData(String userId, String username, int rank, int activeRemaining) {
            this.userId = userId;
            this.username = username;
            this.rank = rank;
            this.activeRemaining = activeRemaining;
        }
    }

    /**
     * Battle Royale player count update
     */
    public static class BattleRoyaleUpdateData {
        public final int activeCount;
        public final int totalCount;

        public BattleRoyaleUpdateData(int activeCount, int totalCount) {
            this.activeCount = activeCount;
            this.totalCount = totalCount;
        }
    }

    /**
     * Team assignment broadcast (Team vs Team)
     */
    public static class TeamAssignmentData {
        public final java.util.List<TeamPlayerInfo> players;

        public TeamAssignmentData(java.util.List<TeamPlayerInfo> players) {
            this.players = players;
        }

        public static class TeamPlayerInfo {
            public final String userId;
            public final String username;
            public final String team;

            public TeamPlayerInfo(String userId, String username, String team) {
                this.userId = userId;
                this.username = username;
                this.team = team;
            }
        }
    }

    /**
     * Team score update (Team vs Team)
     */
    public static class TeamScoreUpdateData {
        public final int scoreA;
        public final int scoreB;

        public TeamScoreUpdateData(int scoreA, int scoreB) {
            this.scoreA = scoreA;
            this.scoreB = scoreB;
        }
    }

    /**
     * Perfect Round bonus (Team vs Team)
     */
    public static class PerfectRoundData {
        public final boolean teamAPerfect;
        public final boolean teamBPerfect;

        public PerfectRoundData(boolean teamAPerfect, boolean teamBPerfect) {
            this.teamAPerfect = teamAPerfect;
            this.teamBPerfect = teamBPerfect;
        }
    }

    /**
     * Match start (Sudden Death 1v1)
     */
    public static class MatchStartData {
        public final String championId;
        public final String championName;
        public final int championStreak;
        public final String challengerId;
        public final String challengerName;
        public final int queueRemaining;
        /** PCV-16: số thứ tự trận — khán giả gửi kèm khi đoán. */
        public int matchNo;

        public MatchStartData(String championId, String championName, int championStreak,
                              String challengerId, String challengerName, int queueRemaining) {
            this.championId = championId;
            this.championName = championName;
            this.championStreak = championStreak;
            this.challengerId = challengerId;
            this.challengerName = challengerName;
            this.queueRemaining = queueRemaining;
        }
    }

    /**
     * Match end (Sudden Death 1v1)
     */
    public static class MatchEndData {
        public final String winnerId;
        public final String winnerName;
        public final int winnerNewStreak;
        public final String loserId;
        public final String loserName;

        public MatchEndData(String winnerId, String winnerName, int winnerNewStreak,
                            String loserId, String loserName) {
            this.winnerId = winnerId;
            this.winnerName = winnerName;
            this.winnerNewStreak = winnerNewStreak;
            this.loserId = loserId;
            this.loserName = loserName;
        }
    }

    /**
     * Sequential mode progress: count players who answered this round.
     */
    public static class SequentialProgressData {
        public final int answered;
        public final int total;

        public SequentialProgressData(int answered, int total) {
            this.answered = answered;
            this.total = total;
        }
    }

    /**
     * Question revealed (Group Live Sequential) — sent after all-answered or timeout.
     * Includes correct answer, explanation, and per-player answers for the round.
     */
    public static class QuestionRevealedData {
        public final int correctIndex;
        public final String explanation;
        public final java.util.List<PerPlayerAnswer> answers;
        public final Object leaderboard;

        public QuestionRevealedData(int correctIndex, String explanation,
                                    java.util.List<PerPlayerAnswer> answers, Object leaderboard) {
            this.correctIndex = correctIndex;
            this.explanation = explanation;
            this.answers = answers;
            this.leaderboard = leaderboard;
        }

        public static class PerPlayerAnswer {
            public final String userId;
            public final String username;
            public final Integer answerIndex; // null nếu không trả lời
            public final boolean isCorrect;

            public PerPlayerAnswer(String userId, String username, Integer answerIndex, boolean isCorrect) {
                this.userId = userId;
                this.username = username;
                this.answerIndex = answerIndex;
                this.isCorrect = isCorrect;
            }
        }
    }

    /**
     * Reaction data (social fun)
     */
    public static class ReactionData {
        public String senderId;
        public String senderName;
        public String reaction;

        public ReactionData() {}
        public ReactionData(String senderId, String senderName, String reaction) {
            this.senderId = senderId;
            this.senderName = senderName;
            this.reaction = reaction;
        }

        public String getSenderId() { return senderId; }
        public void setSenderId(String senderId) { this.senderId = senderId; }
        public String getSenderName() { return senderName; }
        public void setSenderName(String senderName) { this.senderName = senderName; }
        public String getReaction() { return reaction; }
        public void setReaction(String reaction) { this.reaction = reaction; }
    }

    /**
     * SPEC §5.4.0 R1/R2/R5 — broadcast when a room is auto-ended by the
     * lifecycle rules so subscribed clients can toast + redirect instead
     * of silently losing their topic.
     */
    public static class RoomEndedData {
        public final String roomId;
        /** One of: EMPTY_LOBBY | IDLE_TIMEOUT | HOST_GONE | ALL_DISCONNECTED | STUCK_GAME | GAME_COMPLETE */
        public final String reason;

        public RoomEndedData(String roomId, String reason) {
            this.roomId = roomId;
            this.reason = reason;
        }
    }

    /**
     * SPEC §5.4.0 R4 — broadcast when the original host disconnected past
     * the grace window and a remaining player took over.
     */
    public static class HostChangedData {
        public final String roomId;
        public final String newHostId;
        public final String newHostName;

        public HostChangedData(String roomId, String newHostId, String newHostName) {
            this.roomId = roomId;
            this.newHostId = newHostId;
            this.newHostName = newHostName;
        }
    }

    /**
     * Reason codes for {@link RoomEndedData#reason}. Centralised so the FE
     * handler i18n keys (room.ended.*) stay in lock-step with the BE
     * emitters.
     */
    public static class RoomEndedReason {
        public static final String EMPTY_LOBBY = "EMPTY_LOBBY";
        public static final String IDLE_TIMEOUT = "IDLE_TIMEOUT";
        public static final String HOST_GONE = "HOST_GONE";
        public static final String ALL_DISCONNECTED = "ALL_DISCONNECTED";
        public static final String STUCK_GAME = "STUCK_GAME";
        public static final String GAME_COMPLETE = "GAME_COMPLETE";
        /** Sprint 4: Quản trò bấm "Kết thúc sớm". */
        public static final String HOST_ENDED_EARLY = "HOST_ENDED_EARLY";

        private RoomEndedReason() {}
    }

    /**
     * Error message data
     */
    public static class ErrorData {
        public final String error;
        public final String message;

        public ErrorData(String error, String message) {
            this.error = error;
            this.message = message;
        }
    }
}
