# Phòng chơi v2 — Đợt 1: sửa lỗi

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Chủ dự án uỷ quyền làm hết, không chờ duyệt (12/10/2026).

**Goal:** Phòng chơi công bằng (máy chủ đo giờ, đóng vòng, không lộ đáp án), không kẹt khi đông phòng, kiểm số người theo mode, ghi hạng và nhiệm vụ đúng, giải thích sau mỗi câu, tắt Đấu nhanh bằng AI, thống nhất tên mode.

**Spec:** `docs/MULTIPLAYER/2026-10-12-phong-choi-v2-design.md` (Đợt 1, mục 1.1–1.12).

**Worktree:** `D:\code\biblequize-lukhach`, nhánh `feat/ranked-whole-bible` (đẩy lên `main`).

## Global Constraints

- **Test:** mỗi task theo TDD. Phải đỏ trước rồi mới xanh.
  - BE: `cd apps/api && ./mvnw -o -q test -Dtest='…'`.
  - FE: `cd apps/web && npx vitest run <file>`.
  - Hết đợt chạy cả hai bộ đầy đủ. Mốc tối thiểu: web 1546 test, api ≥ bộ hiện có.
- **Chữ trên giao diện:** đưa vào `i18n/vi.json` và `en.json`. Chạy `npm run validate:i18n`.
- **Spec:** mỗi thay đổi hành vi sửa `docs/spec/SPEC_MULTIPLAYER.md` hoặc `SPEC_USER_v3.2.md` cùng commit. Quyết định mới ghi vào `DECISIONS.md` với ngày 2026-10-12.
- **Dependency, payload:** không thêm dependency. Không đổi shape các payload STOMP ngoài những chỗ spec nêu.
- **Commit:** message tiếng Việt kèm mã PCV-n, kết bằng dòng Co-Authored-By.

## Review Focus

1. Mạng chậm: câu trả lời gửi ở giây cuối, tới máy chủ sau hạn chót nhưng trong 1 giây ân hạn, vẫn phải được chấm (PCV-1).
2. Quản trò bấm bỏ câu khi còn người chưa trả lời: câu trả lời tới sau đó phải bị bỏ qua, kể cả ở Chơi cùng nhau (PCV-1).
3. Người vào lại giữa trận (rehydrate) vẫn thấy đúng bảng điểm, dù đã bỏ `SCORE_UPDATE` theo từng câu (PCV-2/3).
4. Đội đấu đội khi một đội có người rời phòng ở sảnh, làm hai đội lệch nhau 2 người: phải không bắt đầu được (PCV-5).
5. Nhiệm vụ hôm nay đang mang loại cũ (vd `complete_speed_round`): phải được đổi sang loại mới, và không mất phần thưởng đã nhận (PCV-7).

---

### PCV-1 Máy chủ đo giờ + đóng vòng
- **Files:**
  - `RoomAnswerProcessor`;
  - `RoomStateService` (thêm `closeCurrentRound`, `isRoundClosed`);
  - `RoomWebSocketController.broadcastRoundEnd/broadcastQuestionRevealed` (đóng vòng trước khi phát);
  - `RoomQuizService.waitForRoundEnd` (hạn chót + `ROUND_GRACE_MS = 1000`);
  - `SequentialScoringService` (thời gian chờ cộng ân hạn).
- **Hành vi:**
  - `effective = clamp(client, serverElapsed − 1500, serverElapsed)`, rồi kẹp vào `[0, timeLimitMs]`.
  - Bỏ qua câu trả lời khi `serverElapsed > timeLimitMs + 1000`, hoặc khi vòng đã đóng.
  - `serverElapsed` lấy từ `QuestionStartData.startedAtMs` trong Redis; thiếu thì kẹp số của máy vào `[0, timeLimitMs]`.
- **Test** (mới, `RoomAnswerProcessorTimingTest`):
  - `clientFasterThanPossible_isRaisedToServerFloor`
  - `slowNetwork_keepsClientValue`
  - `lateAfterGrace_isRejected`
  - `closedRound_isRejected`
  - `noStartTimestamp_clampsClientToLimit`
  - Test sẵn có trong `RoomQuizServiceWaitTest` cập nhật theo ân hạn.

### PCV-2 Không lộ đáp án + ROUND_END đầy đủ + nhịp nghỉ
- **Files:**
  - `RoomWebSocketController.handleAnswerSubmission` (chỉ phát answered, bỏ `SCORE_UPDATE` theo câu);
  - `WebSocketMessage.RoundEndData` (thêm `explanation`, `reference`, `answerCounts`, `results`);
  - `RoomQuizService` (dựng dữ liệu đó qua `RoundResultBuilder` mới; nghỉ 5 giây, có giải thích thì 7 giây).
- **Test:**
  - `RoomWebSocketControllerTest.handleAnswer_*`: payload không có `answerIndex`/`isCorrect`, không phát `SCORE_UPDATE`.
  - `RoundResultBuilderTest`: đếm đáp án, người không trả lời có `answered=false`, `reference` lấy từ câu hỏi.
  - `RoomQuizServiceDelayTest`: 5000/7000.

### PCV-3 Giao diện màn chơi theo payload mới
- **Files:**
  - `RoomQuiz.tsx` (ANSWER_SUBMITTED, ROUND_END, bỏ SCORE_UPDATE theo câu, chặn đồng hồ lệch > 2 giây);
  - `RoomQuizShell` (bảng tin, ô câu gốc + giải thích, biểu đồ chia đáp án);
  - component mới `RoundReveal.tsx`;
  - `types/room.ts`.
- Bỏ banner combo ×1,2/×1,5 (đợt 2 thay bằng chuỗi thật của máy chủ).
- **Test:**
  - `RoomQuiz.test.tsx`: feed "đã trả lời"; khi ROUND_END có câu gốc và giải thích, giải thích mở sẵn nếu trả lời sai.
  - `RoundReveal.test.tsx`.

### PCV-4 Bộ luồng riêng + bắt đầu nguyên tử
- **Files:**
  - `infrastructure/RoomGameExecutorConfig` (bean `roomGameExecutor`);
  - `RoomQuizService.runQuiz` dùng `@Async("roomGameExecutor")`;
  - `RoomController.start` bắt `TaskRejectedException` → 503 "Máy chủ đang bận", đưa phòng về LOBBY;
  - `RoomRepository.markInProgressIfLobby` (`@Modifying` UPDATE … WHERE status = 'LOBBY');
  - `RoomService.startRoom` dùng hàm này.
- **Test:**
  - `RoomServiceTest.startRoom_secondConcurrentStart_throws`
  - `RoomGameExecutorConfigTest`

### PCV-5 Luật số người theo mode
- **Files:**
  - `RoomModeRules` mới (min/max theo mode, kiểm đội; giới hạn số câu và thời gian);
  - `RoomService.startRoom/createRoom/createQuickMatchRoom`;
  - `RoomController` (kẹp cài đặt);
  - FE: `create-room/modeMeta.ts` (min/max), `RoomLobby.tsx` (`canStart` và dòng trạng thái theo mode), `CreateRoom.tsx` (thanh trượt theo max của mode).
- **Test:**
  - `RoomModeRulesTest`: từng mode, đội lệch, đội trống, phòng chỉ có người máy (đợt 3, để sẵn chỗ).
  - `RoomServiceTest.startRoom_*`
  - `RoomLobby.test.tsx`: không bắt đầu được khi Sinh tồn mới có 2 người.

### PCV-6 Hạng cuối + nhiệm vụ phòng + MVP
- **Files:**
  - `RankAssigner` mới (xếp hạng có đồng hạng);
  - `SpeedRaceStrategy`, `TeamVsTeamStrategy`, `SequentialStrategy.finishGame`;
  - `RoomMatchOutcomeService` mới (sau `finishGame`: nhiệm vụ `play_multiplayer_room` / `win_multiplayer_room` cho người thật chưa LEFT);
  - `MultiplayerStatsService` (đếm MVP bằng truy vấn).
- **Test:**
  - `RankAssignerTest`
  - `TeamVsTeamStrategyTest.finishGame_assignsTeamRanks`
  - `RoomMatchOutcomeServiceTest`
  - `MultiplayerStatsServiceTest.mvpCount`

### PCV-7 Nhiệm vụ ngày
- **Files:**
  - `DailyMissionService` (`onAnswer`, `onEvent`, mẫu nhiệm vụ mới, đổi loại cũ lúc đọc, thưởng 50 XP);
  - `MissionXpCredit` dùng chung với Thử thách ngày;
  - các luồng gọi: `SessionService`, `RankedController`, `DailyChallengeService`, `RoomAnswerProcessor`, `MemoryVerseService.review`, kết thúc lượt Đấu Hạng.
- **Test** (`DailyMissionServiceTest`, mới hoặc mở rộng):
  - mỗi loại nhiệm vụ đều tiến được;
  - đổi loại cũ;
  - thưởng 50 XP đúng một lần;
  - người máy (`user.isBot`, đợt 3) bị bỏ qua.

### PCV-8 Đấu nhanh không dùng AI
- **Files:**
  - `RoomController.createQuickMatch`: AI → 422 `AI_SOURCE_DISABLED`; giới hạn ngày chỉ áp cho AI;
  - FE: `QuickMatchConfigModal` (bỏ lựa chọn AI), `QuickMatchEntryCard` và `WeeklyMultiplayerStatsWidget` (bỏ "còn N lượt").
- **Test:**
  - `RoomControllerTest.quickMatch_ai_disabled`
  - `RoomControllerTest.quickMatch_database_notCapped`
  - Test FE của modal.

### PCV-9 Tên, icon, mô tả mode + lựa chọn vai trò chủ phòng
- **Files:**
  - `modeMeta.ts` (icon, số người, mô tả mới);
  - `RoomLobby.tsx` (bỏ `MODE_INFO` riêng, đọc `MODE_META` + i18n);
  - `CreateRoom.tsx` (lựa chọn hai ô "Tôi dẫn chương trình / Tôi chơi cùng");
  - `vi.json`, `en.json`.
- **Test:** `CreateRoom.test.tsx`, `RoomLobby.test.tsx` (tên tiếng Việt, icon `favorite`/`swords`).

### PCV-10 Spec, DECISIONS, deploy
- Sửa:
  - `SPEC_MULTIPLAYER` §2–§5 (timing, payload, số người, Đấu vương tối đa 12, AI);
  - `SPEC_USER` §13 (nhiệm vụ);
  - `DECISIONS.md` (Đấu vương 12 người; thưởng nhiệm vụ 50 XP khi xong cả 3; tắt AI ở Đấu nhanh; không XP cho Phòng chơi).
- Chạy cả hai bộ test.
- Build và deploy `biblequiz-be` và `biblequiz-fe`. Trước khi deploy, kiểm không có phòng IN_PROGRESS.
- Kiểm trên prod.
