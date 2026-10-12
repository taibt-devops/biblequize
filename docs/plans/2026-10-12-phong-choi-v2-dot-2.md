# Phòng chơi v2 — Đợt 2 (thiết kế lại 4 mode) — kế hoạch triển khai

> **Spec:** `docs/MULTIPLAYER/2026-10-12-phong-choi-v2-design.md` (Đợt 2, mục 2.1–2.6) · Task: `docs/todo/active/2026-10-12-phong-choi-v2.md` (PCV-11..19) · Ledger: `.superpowers/sdd/phong-choi-v2/progress.md`
> Thực thi inline (executing-plans), TDD từng task, một review cuối cho cả nhánh.

**Goal:** bốn mode Phòng chơi có luật riêng đáng chơi (chuỗi + câu chốt, mạng + hồi sinh + câu quyết định, điểm đội trung bình, Đấu vương xoay vòng + khán giả đoán), chơi lại một chạm, đổi cách chơi ngay trong sảnh.

**Architecture:** giữ khung `RoomQuizService.runStandardLoop` + `RoomModeStrategy`. Thêm hai hook: `planRound` (thời gian, hệ số, cờ vùng nguy hiểm/câu quyết định cho từng câu) và `questionsFor` (bộ câu theo mode — Sinh tồn xếp độ khó + câu dự phòng). Mọi điểm vẫn chấm trong `RoomAnswerProcessor`; trạng thái phụ (chuỗi, mạng, bóng, trận Đấu vương) là cột trên `room_room_players`.

**Tech:** Spring Boot 3.3 / Java 17, Flyway (V77), Redis (`RoomStateService`), STOMP; React + Vitest.

## Global Constraints
- Migration chỉ thêm cột (additive), có DEFAULT — chạy được trên prod đang có dữ liệu.
- Không lộ đáp án trước khi vòng đóng (PCV-2) — mọi trường mới về đúng/sai chỉ nằm trong `ROUND_END`.
- Không XP cho Phòng chơi. Không dependency mới.
- Chữ hiển thị qua `t()`, khóa có ở cả `vi.json` và `en.json`.
- Trước deploy: cả bộ test BE + web, boot jar với MySQL + Redis tạm (`boot_local.sh`), smoke STOMP mỗi mode.

## Review Focus
1. Phòng dùng **bộ câu của tôi** (UserQuestion, không nằm trong bảng `questions`) — trả lời đúng phải được tính đúng (trước đây luôn sai).
2. Sinh tồn khi **cả phòng cùng sai** — không ai mất mạng; ở câu quyết định cũng ân xá.
3. Người chơi **rời trận / mất kết nối** giữa chừng (LEFT) — không làm trận kẹt chờ, không được tính "cả đội đúng", không chặn kết thúc Đấu vương.
4. **Bóng** (người đã bị loại) trả lời — không làm vòng kết thúc sớm, không được điểm, không tính vào `answerCounts` (số người chọn chỉ đếm người còn trong cuộc).
5. Đấu vương với **3 người** và **12 người** — luôn kết thúc (ngân sách câu), ai cũng được đấu ít nhất một lần khi đủ câu.

---

### PCV-11a Khóa đáp án theo vòng (sửa lỗi bộ câu tự soạn)
- **Files:** `RoomStateService` (+`AnswerKey`, `setAnswerKey/getAnswerKey`, xoá trong `clearRoomState`), `RoomQuizService.runStandardLoop`, `SequentialStrategy.runGameLoop`, `RoomAnswerProcessor`.
- **Interfaces:** `record AnswerKey(String questionId, int correctIndex, String difficulty, String book)`; `RoomStateService.setAnswerKey(String roomId, AnswerKey)`; `Optional<AnswerKey> getAnswerKey(String roomId)`.
- Processor: lấy khóa nếu `questionId` khớp câu đang chạy; không có thì tra `questionRepository` như cũ.
- **Test:** `RoomAnswerProcessorAnswerKeyTest` — câu không có trong `questions` nhưng có khóa → chấm đúng, có điểm; khóa của câu khác → bỏ qua, tra DB.

### PCV-11 Đua tốc độ: chuỗi, câu chốt, bảng dẫn đầu
- **Migration V77** (cho cả đợt 2): `room_room_players` + `answer_streak`, `lives`, `ghost_streak`, `revived`, `eliminated_round` (NULL), `matches_won`, `best_streak`, `matches_played`, `prediction_points`; `room_answers` + `ghost`.
- **Hook:** `RoundPlan planRound(GameLoopContext ctx, int index, Question q)` (mặc định: `timePerQuestion`, ×1, không cờ). `QuestionStartData` + `multiplier` (int, 1), `dangerZone`, `showdown` (boolean).
- `RoomModeStrategy.streakBonus(int streak)` mặc định 0; Đua tốc độ: 2→10, 3→20, ≥4→30.
- Processor: đúng → `answerStreak+1`, điểm = (công thức + `streakBonus`) × `multiplier`; sai → `answerStreak=0`.
- `RoundResultBuilder.closeRound(roomId, roundId)`: người ACTIVE không trả lời → `answerStreak=0`; `PlayerResult.streak` = chuỗi hiện tại.
- Đua tốc độ `planRound`: câu cuối ×2.
- **Web:** `QuestionStartData.multiplier/dangerZone/showdown`; dải "Câu chốt · ×2"; trong `RoundReveal` "Chuỗi n · +x"; `StandingsFlash` (top 5, mũi tên) sau câu 3, 6, 9… (không ở câu cuối).
- **Test:** `SpeedRaceStreakTest` (chuỗi 1..4, sai về 0, câu chốt ×2 cả phần thưởng chuỗi), `RoundResultBuilderTest` (+ reset người không trả lời, streak trong results), web `roomQuizCore`/`StandingsFlash`/`RoundReveal`.

### PCV-12 Sinh tồn: mạng, độ khó tăng dần, vùng nguy hiểm, câu quyết định
- `RoomModeStrategy.questionsFor(Room room, int questionCount, QuestionPool pool)` — mặc định như cũ. Sinh tồn + kho câu + Hỗn hợp: 30/40/30 Dễ→TB→Khó + 5 Khó dự phòng (`ctx.regularCount` = số câu chính).
- `beforeLoop`: mọi người ACTIVE `lives=2`.
- `afterRound` (câu chính): người ACTIVE sai/không trả lời mất 1 mạng (ân xá nếu tất cả cùng sai); `lives==0` → ELIMINATED, `eliminated_round=i`.
- `planRound`: câu ≥10 → `max(10, base − 2×(câu−9))`, `dangerZone=true`; câu dự phòng → `showdown=true`.
- Dừng: câu chính hết mà còn ≤1 người → dừng; còn >1 → câu quyết định (tối đa 5): sai/không trả lời → loại ngay (ân xá nếu tất cả cùng sai); còn 1 người → dừng.
- Hạng: người còn lại theo mạng → câu đúng → thời gian; người bị loại theo `eliminated_round` (muộn hơn xếp trên, cùng lượt đồng hạng).
- `PLAYER_ELIMINATED` giữ nguyên; thêm `LIVES_UPDATE { lives: {userId: n} }` sau mỗi vòng.
- **Web:** tim ♥ thay điểm ở bảng Sinh tồn, "Vùng nguy hiểm", "Câu quyết định".
- **Test:** `BattleRoyaleLivesTest`, `BattleRoyaleQuestionPlanTest`, `BattleRoyaleRanksTest`.

### PCV-13 Sinh tồn: bóng + hồi sinh
- Processor: Sinh tồn + ELIMINATED → nhận câu trả lời như "bóng": `ghost=true`, 0 điểm, không cộng câu đúng/không đổi trung bình, không nhiệm vụ.
- `RoomAnswerRepository.countByRoundIdAndGhostFalse` cho vòng kết thúc sớm.
- `afterRound`: bóng đúng → `ghost_streak+1`, sai/không → 0; đủ 3 ở câu 1–9 và chưa hồi sinh → ACTIVE, `lives=1`, `revived=true`, `eliminated_round=null`, `PLAYER_REVIVED { userId, username }`.
- `answerCounts`/`results` của ROUND_END chỉ tính người không phải bóng.
- **Web:** bóng vẫn bấm được, dòng "Đúng 3 câu liên tiếp để hồi sinh (còn N câu)", toast hồi sinh.
- **Test:** `BattleRoyaleGhostTest`.

### PCV-14 Đội đấu đội
- `TeamScoringService`: điểm đội = round(TB điểm thành viên ACTIVE; không còn ai thì TB tất cả) + 50 × số lần cả đội đúng (không cộng vào điểm cá nhân). Cả đội đúng = mọi thành viên ACTIVE đúng, ≥1 ACTIVE. Hòa: lần cả đội đúng → TB thời gian → hòa thật.
- `POST /api/rooms/{id}/shuffle-teams` (chủ phòng; Đấu nhanh: người trong phòng; LOBBY) → chia lại cân, bỏ sẵn sàng, `ROOM_STATE`.
- **Web:** nút "Xáo đội", tên đội theo mã phòng (`teamNames(roomCode)`), gợi ý cân đội nhắc lại nút Xáo đội.
- **Test:** `TeamScoringAverageTest`, `RoomServiceShuffleTeamsTest`, `RoomControllerTest` (+shuffle), web `teamNames`.

### PCV-15 Đấu vương
- `initializeQueue`: xáo ngẫu nhiên. Thua → về cuối hàng. `matches_played`/`matches_won`/`best_streak`.
- Kết thúc: (a) mọi người đã đấu ≥1 trận và chuỗi vua ≥ target (3 nếu ≤5 người, 4 nếu đông hơn); (b) hết số câu.
- Hạng: trận thắng → chuỗi dài nhất → câu đúng → thời gian. `continueCountMap` → `ConcurrentHashMap`, xoá khi hết trận.
- **Test:** `SuddenDeathRotationTest`, `SuddenDeathRanksTest`.

### PCV-16 Đấu vương: khán giả đoán
- `/app/room/{id}/predict { matchNo, pickUserId }` — chỉ SPECTATOR, chỉ người đang đấu, khóa khi câu đầu của trận bắt đầu. Redis `room:state:sd_predict:{roomId}:{matchNo}` (hash userId→pick).
- `MATCH_START` + `matchNo`; hết trận: đúng → `prediction_points+1`, `PREDICTION_RESULT { matchNo, winnerId, correctUserIds }`.
- QUIZ_END Đấu vương: `topPredictor { userId, username, points }`.
- **Web:** hai nút đoán khi đang xem; màn kết quả "Khán giả tinh mắt".
- **Test:** `SuddenDeathPredictionTest`.

### PCV-17 Chơi lại
- `POST /api/rooms/{id}/rematch` — ENDED; chủ phòng (Đấu nhanh: người đã chơi). Redis SETNX `rematch:{oldId}` TTL 1 giờ → trả phòng đã có. Chép cài đặt; AI → kho câu. Người tạo vào phòng mới (chơi cùng nếu phòng cũ chơi cùng). `REMATCH_READY { roomId, roomCode }` lên topic phòng cũ.
- **Web:** màn kết quả: "Chơi lại" (người tạo được) / "Vào ván mới" khi nhận REMATCH_READY.
- **Test:** `RoomServiceRematchTest`, `RoomControllerTest` (+rematch).

### PCV-18 Đổi cách chơi trong sảnh
- `PATCH /api/rooms/{id}/settings { mode?, questionCount?, timePerQuestion?, difficulty? }` — chủ phòng, LOBBY; kẹp theo `RoomModeRules`; sang TvT chia đội cân, rời TvT xoá đội; Đấu vương > 12 người → 400; mọi người khác bỏ sẵn sàng; `ROOM_STATE` + chat hệ thống.
- **Web:** nút "Đổi cách chơi" + hộp chọn.
- **Test:** `RoomServiceSettingsTest`, `RoomControllerTest` (+settings), web modal.

### PCV-19 Spec, DECISIONS, kiểm thử, deploy
- SPEC_MULTIPLAYER §3 viết lại 4 mode + sự kiện mới; DECISIONS nếu có ruling đổi spec.
- Cả bộ test, boot check, smoke STOMP mỗi mode, deploy khi SSH thông.
