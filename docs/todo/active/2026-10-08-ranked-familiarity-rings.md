# 2026-10-08 — Đấu Hạng: rút câu cả Kinh Thánh theo vòng sách quen thuộc (RFR)

> **Source**: user chốt 08/10/2026 (DECISIONS.md cùng ngày): bỏ hành trình sách tuần tự của Option C, rút câu theo độ quen thuộc của sách và theo bậc. · **Scope**: `RankedController` (chọn câu + luồng trả lời), `RankedBookPool` (mới), `QuestionRepository.countActiveByBook`, FE `Ranked.tsx`/`Quiz.tsx`, chữ Hành trình (vi/en). KHÔNG đụng chấm điểm (`calculateRanked`), nhánh Liturgical Coverage.

### Tasks
- RFR-1 Chọn câu theo vòng sách
  - Status: [x] DONE · `RankedBookPool` (3 vòng 18/22/26 sách, `ringForTier`, `varied` tối đa 3 câu/sách) · `selectRankedQuestions` bỏ `book`, rút vòng theo bậc, thiếu câu thì nới vòng · Test: `RankedBookPoolTest` 5, `RankedControllerTest` 4 test chọn câu mới (vòng bậc 1 + bỏ `book` + loại câu vừa gặp, bậc 5 cả Kinh Thánh, tối đa 3 câu/sách, vòng đủ thì không nới)
  - **Spec impact**: [x] SPEC_USER §3.2
  - **Spec strategy**: [x] (a) update inline
- RFR-2 Bỏ tự chuyển sách, sưu tầm sách cho huy hiệu Học Giả
  - Status: [x] DONE · luồng trả lời: ghi `UserBookProgress` trước khi xét huy hiệu, bỏ khối "Option C journey advance", `checkAndAward` nhận số sách đã đạt `rankedBookSampleTarget` (thay `currentBookIndex`) · `QuestionRepository.countActiveByBook` · Test: 2 test trả lời (đạt ngưỡng → đếm 1 sách, không chuyển sách; dưới ngưỡng → 0)
  - **Spec impact**: [x] SPEC_USER §3.2
  - **Spec strategy**: [x] (a) update inline
- RFR-3 Màn hình: bỏ gửi `book`, chữ Hành trình kiểu sưu tầm
  - Status: [x] DONE · `Ranked.tsx`, `Quiz.tsx` bỏ `book`; `home.lk.journeyTipStart`, `home.lk.journeyStart`, `home.journeyExtra.subUnlock` (vi/en) bỏ "Bắt đầu từ Sáng Thế Ký… mở khóa sách tiếp theo" · Test: vitest Ranked/Quiz/BibleJourneyCard/home pass
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- RFR-4 Deploy prod (cura-dev) + kiểm tra
  - Status: [x] DONE 08/10 · commit `5a550820`, image BE `sha256:471bfd55…`, FE `sha256:643967c9…`; rollback BE `sha256:1b42f406…`, FE `sha256:4d441d77…` · API khởi động 5 s, `/actuator/health` 200, forbible.org 200, chữ mới có trong `vi-*.js`
  - Số câu `vi` đang bật trên prod: vòng 1 = 2.261 câu / 18 sách (747 Dễ), vòng 2 = 1.621 / 22, vòng 3 = 1.247; 46 câu mang tên sách lạ (`Song of Solomon` 25, `Gióp` 16, `Sáng Thế Ký` 5) chỉ vào được vòng cả Kinh Thánh
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]

### Theo dõi sau deploy
- Đo tỷ lệ đúng theo bậc sau 2–4 tuần (đích ~80% bậc 1, ~60% bậc 6) và sau khi nạp bộ "Dễ cốt lõi".
- Nếu vòng 1 cạn câu chưa gặp với người chơi chăm, cân nhắc nới vòng sớm hơn thay vì lặp câu.
