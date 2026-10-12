package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomPlayer;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * PCV-6 — gán {@code finalRank} kiểu thi đấu (1, 1, 3): người đứng sau bằng hệt người đứng
 * trước theo {@code order} thì đồng hạng. Thống kê tuần ("thắng" = hạng 1) và nhiệm vụ
 * "Thắng 1 phòng" đọc giá trị này cho mọi mode.
 */
public final class RankAssigner {

    /** Điểm → số câu đúng → thời gian trung bình (người chưa trả lời câu nào xếp sau cùng). */
    public static final Comparator<RoomPlayer> BY_SCORE_ACCURACY_SPEED =
            Comparator.comparingInt(RoomPlayer::getScore).reversed()
                    .thenComparing(Comparator.comparingInt(RoomPlayer::getCorrectAnswers).reversed())
                    .thenComparingDouble(p -> p.getTotalAnswered() > 0 ? p.getAverageReactionTime() : Double.MAX_VALUE);

    private RankAssigner() {}

    public static void assign(List<RoomPlayer> players, Comparator<RoomPlayer> order) {
        List<RoomPlayer> sorted = new ArrayList<>(players);
        sorted.sort(order);
        for (int i = 0; i < sorted.size(); i++) {
            RoomPlayer p = sorted.get(i);
            if (i > 0 && order.compare(sorted.get(i - 1), p) == 0) {
                p.setFinalRank(sorted.get(i - 1).getFinalRank());
            } else {
                p.setFinalRank(i + 1);
            }
        }
    }
}
