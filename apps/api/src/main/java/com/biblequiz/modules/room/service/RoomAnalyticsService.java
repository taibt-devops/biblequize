package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.QuestionRepository;
import com.biblequiz.modules.room.entity.RoomAnswer;
import com.biblequiz.modules.room.entity.RoomRound;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomRoundRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Per-question analytics aggregation for a finished room. Reads the
 * {@code room_rounds} + {@code room_answers} tables (already populated
 * by RoomQuizService during the live game) and joins with
 * {@code questions} so the FE analytics page can show the question
 * text, the correct answer, the answer distribution, and the avg
 * response time per round.
 */
@Service
public class RoomAnalyticsService {

    @Autowired private RoomRoundRepository roundRepository;
    @Autowired private RoomAnswerRepository answerRepository;
    @Autowired private QuestionRepository questionRepository;

    public List<RoundAnalyticsDTO> getRoomAnalytics(String roomId) {
        List<RoomRound> rounds = roundRepository.findByRoomIdOrderByRoundNoAsc(roomId);
        List<RoundAnalyticsDTO> out = new ArrayList<>(rounds.size());

        for (RoomRound round : rounds) {
            // Chỉ vòng đã đóng (đã công bố đáp án): mở trang này ở thẻ khác giữa trận không được
            // thấy đáp án / lựa chọn của mọi người ở câu đang chạy.
            if (round.getEndedAt() == null) continue;
            List<RoomAnswer> answers = answerRepository.findByRoundId(round.getId());
            Optional<Question> qOpt = questionRepository.findById(round.getQuestionId());

            String content = qOpt.map(Question::getContent).orElse("(Question deleted)");
            List<String> options = qOpt.map(Question::getOptions).orElse(List.of());
            // Single-answer Speed Race: take the first index. Fall back to -1
            // if the question got deleted between play and analytics view.
            Integer correctIndex = qOpt
                    .flatMap(q -> {
                        List<Integer> ca = q.getCorrectAnswer();
                        return ca != null && !ca.isEmpty() ? Optional.of(ca.get(0)) : Optional.empty();
                    })
                    .orElse(-1);

            int totalAnswers = answers.size();
            int correctCount = (int) answers.stream().filter(a -> Boolean.TRUE.equals(a.getIsCorrect())).count();
            long sumMs = answers.stream().mapToLong(a -> a.getResponseMs() == null ? 0 : a.getResponseMs()).sum();
            int avgMs = totalAnswers > 0 ? (int) (sumMs / totalAnswers) : 0;

            // Per-option distribution: 4 buckets for A/B/C/D (or however
            // many options the question carries).
            int[] perOption = new int[Math.max(options.size(), 4)];
            for (RoomAnswer a : answers) {
                int idx = a.getAnswerIndex() == null ? -1 : a.getAnswerIndex();
                if (idx >= 0 && idx < perOption.length) perOption[idx]++;
            }
            List<Integer> distribution = new ArrayList<>(perOption.length);
            for (int n : perOption) distribution.add(n);

            // Per-player breakdown so the FE can render the full grid.
            List<PlayerAnswerDTO> players = new ArrayList<>(answers.size());
            for (RoomAnswer a : answers) {
                players.add(new PlayerAnswerDTO(
                        a.getUserId(),
                        a.getAnswerIndex(),
                        Boolean.TRUE.equals(a.getIsCorrect()),
                        a.getResponseMs() == null ? 0 : a.getResponseMs(),
                        a.getPointsEarned() == null ? 0 : a.getPointsEarned()));
            }

            out.add(new RoundAnalyticsDTO(
                    round.getRoundNo(),
                    round.getQuestionId(),
                    content,
                    options,
                    correctIndex,
                    totalAnswers,
                    correctCount,
                    avgMs,
                    distribution,
                    players));
        }
        return out;
    }

    public static class RoundAnalyticsDTO {
        public final int roundNo;
        public final String questionId;
        public final String questionContent;
        public final List<String> options;
        public final int correctIndex;
        public final int totalAnswers;
        public final int correctCount;
        public final int avgResponseMs;
        public final List<Integer> distribution;     // count per option index
        public final List<PlayerAnswerDTO> players;

        public RoundAnalyticsDTO(int roundNo, String questionId, String questionContent,
                                 List<String> options, int correctIndex, int totalAnswers,
                                 int correctCount, int avgResponseMs, List<Integer> distribution,
                                 List<PlayerAnswerDTO> players) {
            this.roundNo = roundNo;
            this.questionId = questionId;
            this.questionContent = questionContent;
            this.options = options;
            this.correctIndex = correctIndex;
            this.totalAnswers = totalAnswers;
            this.correctCount = correctCount;
            this.avgResponseMs = avgResponseMs;
            this.distribution = distribution;
            this.players = players;
        }
    }

    public static class PlayerAnswerDTO {
        public final String userId;
        public final Integer answerIndex;
        public final boolean isCorrect;
        public final int responseMs;
        public final int pointsEarned;

        public PlayerAnswerDTO(String userId, Integer answerIndex, boolean isCorrect,
                               int responseMs, int pointsEarned) {
            this.userId = userId;
            this.answerIndex = answerIndex;
            this.isCorrect = isCorrect;
            this.responseMs = responseMs;
            this.pointsEarned = pointsEarned;
        }
    }
}
