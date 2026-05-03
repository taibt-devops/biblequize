package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;
import com.biblequiz.modules.userquiz.entity.UserQuestion;
import com.biblequiz.modules.userquiz.repository.RoomQuestionSelectionRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Điều phối luồng quiz bất đồng bộ cho multiplayer room.
 * Hỗ trợ các game mode: Speed Race, Battle Royale (Tuần 2), Team vs Team, Sudden Death (Tuần 3).
 */
@Service
public class RoomQuizService {

    private static final Logger log = LoggerFactory.getLogger(RoomQuizService.class);

    @Autowired private QuestionRepository questionRepository;
    @Autowired private RoomRepository roomRepository;
    @Autowired private RoomQuestionSelectionRepository roomQuestionSelectionRepo;
    @Autowired private RoomWebSocketController wsController;
    @Autowired private RoomService roomService;
    @Autowired private RoomStateService roomStateService;
    @Autowired private RoomRoundRepository roomRoundRepository;
    @Autowired private RoomPlayerRepository roomPlayerRepository;
    @Autowired private SpeedRaceScoringService speedRaceScoringService;
    @Autowired private BattleRoyaleEngine battleRoyaleEngine;
    @Autowired private TeamScoringService teamScoringService;
    @Autowired private SuddenDeathMatchService suddenDeathMatchService;

    private static final int BETWEEN_QUESTION_DELAY_MS = 3000;
    private static final int GAME_STARTING_COUNTDOWN_S = 3;

    @Async
    public void runQuiz(String roomId, int questionCount, int timePerQuestion, Room.RoomMode mode) {
        log.info("Quiz bắt đầu cho phòng {} | mode={} | {} câu | {}s/câu", roomId, mode, questionCount, timePerQuestion);
        try {
            broadcastGameStarting(roomId, GAME_STARTING_COUNTDOWN_S);
            Thread.sleep(GAME_STARTING_COUNTDOWN_S * 1000L);

            switch (mode) {
                case BATTLE_ROYALE -> runBattleRoyale(roomId, questionCount, timePerQuestion);
                case TEAM_VS_TEAM -> runTeamVsTeam(roomId, questionCount, timePerQuestion);
                case SUDDEN_DEATH -> runSuddenDeath(roomId, questionCount, timePerQuestion);
                default -> runSpeedRace(roomId, questionCount, timePerQuestion);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Quiz bị ngắt cho phòng {}", roomId);
            safeEndRoom(roomId);
        } catch (Exception e) {
            log.error("Lỗi khi chạy quiz cho phòng {}: {}", roomId, e.getMessage(), e);
            safeEndRoom(roomId);
        }
    }

    // ────────────────────────────── SPEED RACE ──────────────────────────────

    private void runSpeedRace(String roomId, int questionCount, int timePerQuestion) throws InterruptedException {
        List<Question> questions = loadQuestionsForRoom(roomId, questionCount);
        if (questions.isEmpty()) {
            roomService.endRoom(roomId);
            wsController.broadcastQuizEnd(roomId, List.of());
            return;
        }

        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            RoomRound round = saveRound(roomId, new RoomRound(UUID.randomUUID().toString(), null, i, q, LocalDateTime.now()));
            roomStateService.setCurrentRoundId(roomId, round.getId());

            wsController.broadcastQuestionStart(roomId, i, questions.size(), buildQuestionDto(q), timePerQuestion);
            Thread.sleep(timePerQuestion * 1000L);

            round.setEndedAt(LocalDateTime.now());
            roomRoundRepository.save(round);
            wsController.broadcastRoundEnd(roomId, q.getCorrectAnswer().get(0));

            if (i < questions.size() - 1) Thread.sleep(BETWEEN_QUESTION_DELAY_MS);
        }

        List<RoomService.LeaderboardEntryDTO> finalResults = roomService.getRoomLeaderboard(roomId);
        roomService.endRoom(roomId);
        wsController.broadcastQuizEnd(roomId, finalResults);
        log.info("Speed Race kết thúc cho phòng {}", roomId);
    }

    // ────────────────────────────── BATTLE ROYALE ──────────────────────────────

    private void runBattleRoyale(String roomId, int questionCount, int timePerQuestion) throws InterruptedException {
        List<Question> questions = loadQuestionsForRoom(roomId, questionCount);
        if (questions.isEmpty()) {
            roomService.endRoom(roomId);
            wsController.broadcastQuizEnd(roomId, List.of());
            return;
        }

        int totalPlayers = (int) roomPlayerRepository.countByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ACTIVE);
        // Broadcast initial count
        wsController.broadcastBattleRoyaleUpdate(roomId, totalPlayers, totalPlayers);

        for (int i = 0; i < questions.size(); i++) {
            long activeCount = roomPlayerRepository.countByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ACTIVE);
            if (activeCount <= 1) break; // Game ends when ≤ 1 active player

            Question q = questions.get(i);
            RoomRound round = saveRound(roomId, new RoomRound(UUID.randomUUID().toString(), null, i, q, LocalDateTime.now()));
            roomStateService.setCurrentRoundId(roomId, round.getId());

            wsController.broadcastQuestionStart(roomId, i, questions.size(), buildQuestionDto(q), timePerQuestion);
            Thread.sleep(timePerQuestion * 1000L);

            round.setEndedAt(LocalDateTime.now());
            roomRoundRepository.save(round);

            // Broadcast đáp án đúng
            wsController.broadcastRoundEnd(roomId, q.getCorrectAnswer().get(0));

            // Xử lý elimination
            List<BattleRoyaleEngine.EliminatedPlayerInfo> eliminated = battleRoyaleEngine.processRoundEnd(roomId, round.getId());
            long remaining = roomPlayerRepository.countByRoomIdAndPlayerStatus(roomId, RoomPlayer.PlayerStatus.ACTIVE);

            // Broadcast từng người bị loại
            for (BattleRoyaleEngine.EliminatedPlayerInfo e : eliminated) {
                wsController.broadcastPlayerEliminated(roomId, e.userId, e.username, e.rank, (int) remaining);
            }

            if (!eliminated.isEmpty()) {
                wsController.broadcastBattleRoyaleUpdate(roomId, (int) remaining, totalPlayers);
            }

            if (i < questions.size() - 1) Thread.sleep(BETWEEN_QUESTION_DELAY_MS);
        }

        // Gán rank cuối cho những người còn lại
        battleRoyaleEngine.assignFinalRanks(roomId);

        List<RoomService.LeaderboardEntryDTO> finalResults = roomService.getRoomLeaderboardWithRanks(roomId);
        roomService.endRoom(roomId);
        wsController.broadcastQuizEnd(roomId, finalResults);
        log.info("Battle Royale kết thúc cho phòng {}", roomId);
    }

    // ────────────────────────────── TEAM VS TEAM ──────────────────────────────

    private void runTeamVsTeam(String roomId, int questionCount, int timePerQuestion) throws InterruptedException {
        List<Question> questions = loadQuestionsForRoom(roomId, questionCount);
        if (questions.isEmpty()) {
            roomService.endRoom(roomId);
            wsController.broadcastQuizEnd(roomId, List.of());
            return;
        }

        // Broadcast team assignments
        List<RoomPlayer> allPlayers = roomPlayerRepository.findByRoomId(roomId);
        List<WebSocketMessage.TeamAssignmentData.TeamPlayerInfo> teamInfo = allPlayers.stream()
                .map(p -> new WebSocketMessage.TeamAssignmentData.TeamPlayerInfo(
                        p.getUser().getId(), p.getUsername(),
                        p.getTeam() != null ? p.getTeam().name() : "A"))
                .collect(Collectors.toList());
        wsController.broadcastTeamAssignment(roomId, teamInfo);

        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            RoomRound round = saveRound(roomId, new RoomRound(UUID.randomUUID().toString(), null, i, q, LocalDateTime.now()));
            roomStateService.setCurrentRoundId(roomId, round.getId());

            wsController.broadcastQuestionStart(roomId, i, questions.size(), buildQuestionDto(q), timePerQuestion);
            Thread.sleep(timePerQuestion * 1000L);

            round.setEndedAt(LocalDateTime.now());
            roomRoundRepository.save(round);
            wsController.broadcastRoundEnd(roomId, q.getCorrectAnswer().get(0));

            // Perfect Round check
            TeamScoringService.PerfectRoundResult perfect = teamScoringService.processPerfectRound(roomId, round.getId());
            if (perfect.teamAPerfect || perfect.teamBPerfect) {
                wsController.broadcastPerfectRound(roomId, perfect.teamAPerfect, perfect.teamBPerfect);
            }

            // Team score update
            TeamScoringService.TeamScores scores = teamScoringService.calculateTeamScores(roomId);
            wsController.broadcastTeamScoreUpdate(roomId, scores.teamA, scores.teamB);

            if (i < questions.size() - 1) Thread.sleep(BETWEEN_QUESTION_DELAY_MS);
        }

        TeamScoringService.TeamScores finalScores = teamScoringService.calculateTeamScores(roomId);
        String winner = teamScoringService.determineWinner(finalScores);

        List<RoomService.LeaderboardEntryDTO> finalResults = roomService.getRoomLeaderboard(roomId);
        Map<String, Object> endData = Map.of(
                "teamWinner", winner,
                "scoreA", finalScores.teamA,
                "scoreB", finalScores.teamB,
                "leaderboard", finalResults);

        roomService.endRoom(roomId);
        wsController.broadcastQuizEnd(roomId, endData);
        log.info("Team vs Team kết thúc cho phòng {} | winner=Team{}", roomId, winner);
    }

    // ────────────────────────────── SUDDEN DEATH ──────────────────────────────

    private void runSuddenDeath(String roomId, int questionCount, int timePerQuestion) throws InterruptedException {
        List<Question> questions = loadQuestionsForRoom(roomId, questionCount);
        if (questions.isEmpty()) {
            roomService.endRoom(roomId);
            wsController.broadcastQuizEnd(roomId, List.of());
            return;
        }

        // Init queue: all players to SPECTATOR, sorted by join time
        suddenDeathMatchService.initializeQueue(roomId);

        // Start first match
        SuddenDeathMatchService.MatchInfo match = suddenDeathMatchService.startNextMatch(roomId);
        if (match == null) {
            roomService.endRoom(roomId);
            wsController.broadcastQuizEnd(roomId, List.of());
            return;
        }
        wsController.broadcastMatchStart(roomId, match.championId, match.championName, match.championStreak,
                match.challengerId, match.challengerName, suddenDeathMatchService.getQueueSize(roomId));

        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            RoomRound round = saveRound(roomId, new RoomRound(UUID.randomUUID().toString(), null, i, q, LocalDateTime.now()));
            roomStateService.setCurrentRoundId(roomId, round.getId());

            wsController.broadcastQuestionStart(roomId, i, questions.size(), buildQuestionDto(q), timePerQuestion);
            Thread.sleep(timePerQuestion * 1000L);

            round.setEndedAt(LocalDateTime.now());
            roomRoundRepository.save(round);
            wsController.broadcastRoundEnd(roomId, q.getCorrectAnswer().get(0));

            // Process match outcome
            SuddenDeathMatchService.MatchResult result = suddenDeathMatchService.processRound(roomId, round.getId());
            if (result.outcome == SuddenDeathMatchService.MatchOutcome.MATCH_ENDED) {
                wsController.broadcastMatchEnd(roomId,
                        result.winner.userId, result.winner.username, result.winner.streak,
                        result.loser.userId, result.loser.username);

                Thread.sleep(2000L); // pause before next match

                // Start next match if challengers remain
                if (suddenDeathMatchService.hasNextChallenger(roomId)) {
                    match = suddenDeathMatchService.startNextMatch(roomId);
                    if (match != null) {
                        wsController.broadcastMatchStart(roomId, match.championId, match.championName, match.championStreak,
                                match.challengerId, match.challengerName, suddenDeathMatchService.getQueueSize(roomId));
                    }
                } else {
                    // No more challengers → game over
                    if (i < questions.size() - 1) Thread.sleep(BETWEEN_QUESTION_DELAY_MS);
                    break;
                }
            }

            if (i < questions.size() - 1) Thread.sleep(BETWEEN_QUESTION_DELAY_MS);
        }

        suddenDeathMatchService.assignFinalRanks(roomId);
        List<RoomService.LeaderboardEntryDTO> finalResults = roomService.getRoomLeaderboardWithRanks(roomId);
        roomService.endRoom(roomId);
        wsController.broadcastQuizEnd(roomId, finalResults);
        log.info("Sudden Death kết thúc cho phòng {}", roomId);
    }

    // ────────────────────────────── HELPERS ──────────────────────────────

    private RoomRound saveRound(String roomId, RoomRound round) {
        roomRoundRepository.findByRoomIdAndRoundNo(roomId, round.getRoundNo())
                .ifPresent(existing -> roomRoundRepository.deleteById(existing.getId()));
        Room roomRef = new Room();
        roomRef.setId(roomId);
        round.setRoom(roomRef);
        return roomRoundRepository.save(round);
    }

    /**
     * Load questions for a room.
     * - CUSTOM: dùng câu hỏi host đã tạo (AI/manual), fallback DB nếu chưa có.
     * - DATABASE (default): lấy ngẫu nhiên từ hệ thống.
     */
    private List<Question> loadQuestionsForRoom(String roomId, int questionCount) {
        Room room = roomRepository.findById(roomId).orElseThrow();

        if (room.getQuestionSource() == Room.QuestionSource.CUSTOM) {
            List<Question> custom = roomQuestionSelectionRepo
                    .findByRoomIdOrderByOrderIndex(roomId)
                    .stream()
                    .map(s -> toTransientQuestion(s.getUserQuestion()))
                    .toList();

            if (!custom.isEmpty()) {
                log.info("[RoomQuizService] Room {} dùng {} custom questions", roomId, custom.size());
                return custom;
            }
            log.warn("[RoomQuizService] Room {} questionSource=CUSTOM nhưng chưa gán câu hỏi — fallback DB", roomId);
        }

        return loadQuestionsForRoom(roomId, questionCount);
    }

    /** Chuyển UserQuestion thành Question transient (không lưu DB) để dùng trong quiz flow. */
    private Question toTransientQuestion(UserQuestion uq) {
        Question q = new Question();
        q.setId(uq.getId());
        q.setContent(uq.getContent());
        q.setOptions(uq.getOptions());
        q.setCorrectAnswer(List.of(uq.getCorrectAnswer()));
        q.setExplanation(uq.getExplanation());
        q.setBook(uq.getBook() != null ? uq.getBook() : "");
        q.setChapter(uq.getChapterStart() != null ? uq.getChapterStart() : 0);
        q.setVerseStart(uq.getVerseStart() != null ? uq.getVerseStart() : 0);
        q.setVerseEnd(uq.getVerseEnd()   != null ? uq.getVerseEnd()   : 0);
        q.setLanguage(uq.getLanguage() != null ? uq.getLanguage() : "vi");
        return q;
    }

    private Map<String, Object> buildQuestionDto(Question q) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", q.getId());
        dto.put("content", q.getContent());
        dto.put("options", q.getOptions());
        dto.put("type", q.getType() != null ? q.getType().name() : "multiple_choice_single");
        dto.put("book", q.getBook());
        dto.put("chapter", q.getChapter());
        dto.put("correctAnswer", q.getCorrectAnswer() != null && !q.getCorrectAnswer().isEmpty()
                ? q.getCorrectAnswer().get(0) : 0);
        return dto;
    }

    private Map<String, Object> buildQuestionDtoFromUserQuestion(UserQuestion q) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", q.getId());
        dto.put("content", q.getContent());
        dto.put("options", q.getOptions());
        dto.put("type", "multiple_choice_single");
        dto.put("book", q.getBook() != null ? q.getBook() : "");
        dto.put("chapter", q.getChapterStart() != null ? q.getChapterStart() : 0);
        dto.put("correctAnswer", q.getCorrectAnswer());
        return dto;
    }

    private void broadcastGameStarting(String roomId, int countdown) {
        wsController.sendToRoom(roomId, new WebSocketMessage.Message(
                WebSocketMessage.MessageTypes.GAME_STARTING,
                Map.of("countdown", countdown, "roomId", roomId)));
    }

    private void safeEndRoom(String roomId) {
        try {
            roomService.endRoom(roomId);
            wsController.broadcastQuizEnd(roomId, List.of());
        } catch (Exception ex) {
            log.error("Lỗi khi kết thúc phòng {}: {}", roomId, ex.getMessage());
        }
    }
}
