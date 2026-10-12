package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.entity.Question;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * PCV-12 — bộ câu cho Sinh tồn khi lấy từ kho câu hỏi ở độ khó "Hỗn hợp" (design §2.2):
 * 30% Dễ → 40% Trung bình → 30% Khó, xếp theo thứ tự đó để trận nóng dần, rồi thêm
 * {@link #SHOWDOWN_RESERVE} câu Khó dự phòng cho phần "Câu quyết định".
 * Thiếu câu ở một mức thì bù bằng câu mức khác (vẫn xếp Dễ → Khó); thiếu câu Khó dự phòng thì
 * bù bằng câu bất kỳ.
 */
public final class BattleRoyaleQuestionPlan {

    public static final int SHOWDOWN_RESERVE = 5;

    private BattleRoyaleQuestionPlan() {}

    /** Lấy ngẫu nhiên tối đa {@code count} câu ở {@code difficulty} (null = mọi mức), trừ các id đã dùng. */
    @FunctionalInterface
    public interface Fetcher {
        List<Question> fetch(Question.Difficulty difficulty, int count, List<String> excludeIds);
    }

    /** @param regularCount số câu chính; các câu sau đó là câu dự phòng cho phần quyết định. */
    public record Result(List<Question> questions, int regularCount) {}

    public static Result build(int questionCount, Fetcher fetcher) {
        int easy = (int) Math.round(questionCount * 0.3);
        int hard = (int) Math.round(questionCount * 0.3);
        int medium = Math.max(0, questionCount - easy - hard);

        List<Question> regular = new ArrayList<>();
        Set<String> used = new LinkedHashSet<>();
        take(regular, used, fetcher, Question.Difficulty.easy, easy);
        take(regular, used, fetcher, Question.Difficulty.medium, medium);
        take(regular, used, fetcher, Question.Difficulty.hard, hard);
        if (regular.size() < questionCount) {
            take(regular, used, fetcher, null, questionCount - regular.size());
            regular.sort(Comparator.comparingInt(BattleRoyaleQuestionPlan::level)); // ổn định: giữ thứ tự ngẫu nhiên trong cùng mức
        }

        List<Question> reserve = new ArrayList<>();
        take(reserve, used, fetcher, Question.Difficulty.hard, SHOWDOWN_RESERVE);
        if (reserve.size() < SHOWDOWN_RESERVE) {
            take(reserve, used, fetcher, null, SHOWDOWN_RESERVE - reserve.size());
        }

        List<Question> all = new ArrayList<>(regular);
        all.addAll(reserve);
        return new Result(all, regular.size());
    }

    private static void take(List<Question> into, Set<String> used, Fetcher fetcher,
                             Question.Difficulty difficulty, int count) {
        if (count <= 0) return;
        int added = 0;
        for (Question q : fetcher.fetch(difficulty, count, new ArrayList<>(used))) {
            if (q == null || q.getId() == null || used.contains(q.getId())) continue;
            into.add(q);
            used.add(q.getId());
            if (++added >= count) break;
        }
    }

    private static int level(Question q) {
        Question.Difficulty d = q.getDifficulty();
        if (d == Question.Difficulty.easy) return 0;
        if (d == Question.Difficulty.hard) return 2;
        return 1;
    }
}
