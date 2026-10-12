package com.biblequiz.modules.room.service.mode;

/**
 * PCV-11/12 — cách chạy một câu: thời gian, hệ số điểm và cờ hiển thị.
 *
 * @param timeLimitSeconds thời gian của câu (Sinh tồn rút ngắn ở vùng nguy hiểm)
 * @param multiplier       hệ số nhân toàn bộ điểm câu (câu chốt Đua tốc độ = 2)
 * @param dangerZone       Sinh tồn: câu ở vùng nguy hiểm (từ câu 10)
 * @param showdown         Sinh tồn: câu quyết định (sau khi hết câu chính)
 */
public record RoundPlan(int timeLimitSeconds, int multiplier, boolean dangerZone, boolean showdown) {

    public static RoundPlan standard(int timeLimitSeconds) {
        return new RoundPlan(timeLimitSeconds, 1, false, false);
    }
}
