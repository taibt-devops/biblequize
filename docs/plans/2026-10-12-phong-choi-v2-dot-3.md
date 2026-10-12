# Phòng chơi v2 — Đợt 3 (tính năng mới) — kế hoạch triển khai

> **Spec:** `docs/MULTIPLAYER/2026-10-12-phong-choi-v2-design.md` (Đợt 3, mục 3.1–3.4) · Task: `docs/todo/active/2026-10-12-phong-choi-v2.md` (PCV-20..25) · Ledger: `.superpowers/sdd/phong-choi-v2/progress.md`

**Goal:** chơi được khi thiếu người (người máy), Đội đấu đội có bàn bạc thật (Hội ý), rủ bạn đấu từ bảng xếp hạng (Thách đấu), và ôn phần Kinh Thánh vừa đọc cùng nhóm (nối app Đọc hằng ngày).

**Architecture:** người máy là tài khoản thật (`users.is_bot`) nên đi qua đúng đường chơi của người (RoomPlayer, `RoomAnswerProcessor`); một `RoomBotService` hẹn giờ trả lời trên một scheduler riêng sau mỗi `QUESTION_START`. Hội ý là chế độ phụ của Đội đấu đội: điểm đội tính theo đáp án đa số của đội. Thách đấu dùng lại bảng `challenges` + `ChallengeService` có sẵn (đang chưa có giao diện). Ôn phần đọc là phạm vi câu hỏi theo đoạn (`rooms.passage_scope`).

**Tech:** Spring Boot 3.3 / Java 17, Flyway V78, Redis, STOMP (`/user/queue/...` cho tin riêng của đội); React + Vitest; repo `D:\code\forbible-doc` (Vite + React) cho liên kết ôn.

## Global Constraints
- Migration chỉ thêm (cột có mặc định, bảng mới); không xóa dữ liệu người dùng.
- Người máy: không đăng nhập được (không mật khẩu, provider `bot`, email `*@bots.forbible.invalid`), không nhiệm vụ, không thống kê, không XP, không MVP, không bao giờ làm chủ phòng; phòng phải có ≥ 1 người thật.
- Không lộ đáp án giữa vòng (kể cả tin đội: chỉ phương án đồng đội chọn, không đúng/sai).
- Không dependency mới. Chữ qua `t()` (vi + en).

## Review Focus
1. **Phòng chỉ còn người máy** (người thật rời) — trận phải dừng như "không còn ai", không chạy mãi.
2. **Người máy trong Đấu vương** — chỉ trả lời khi đang đấu; khán giả máy không đoán.
3. **Hội ý khi đồng đội không chọn** — đáp án đội lấy theo những người đã chọn; không ai chọn thì đội không có đáp án (0 điểm).
4. **Thách đấu hết hạn / bị hủy** trong lúc người kia đang bấm Nhận — không tạo phòng.
5. **Ôn phần đọc với sách ít câu** — bù bằng câu cùng sách rồi câu bất kỳ, không ra phòng rỗng.

---

### PCV-20 Người máy: dữ liệu + thêm vào phòng
- **V78:** `users.is_bot BOOLEAN NOT NULL DEFAULT FALSE`; `room_room_players.bot_level VARCHAR(10) NULL`; seed 6 tài khoản Máy An/Bình/Châu/Dũng/Giang/Hà (id cố định `bot-01..06`).
- `User.isBot()`; `RoomBotService.addBot(roomId, callerId, level)` — chủ phòng (Đấu nhanh: người trong phòng), LOBBY, tối đa 5 máy, còn chỗ; chọn máy chưa có trong phòng; luôn sẵn sàng; Đội đấu đội cân đội.
- `POST /api/rooms/{id}/bots {level}`; mời ra bằng kick như người.
- Loại người máy khỏi: đẩy làm chủ phòng, đếm "không còn ai", luật "đang ở phòng khác", nhiệm vụ/MVP/thống kê (`RoomMatchOutcomeService`, `MultiplayerStatsService`), `RoomModeRules` cần ≥ 1 người thật.
- Chơi lại (PCV-17) thêm lại người máy của phòng cũ.
- **Test:** `RoomBotServiceTest`, `RoomModeRulesTest` (+người thật), `RoomMatchOutcomeServiceTest` (+máy), `RoomControllerTest` (+bots).

### PCV-21 Người máy trả lời + giao diện
- `BotAnswerPlanner` (thuần): xác suất đúng theo cấp × độ khó; thời gian Dễ 6–14 s, Vừa 4–10 s, Giỏi 2,5–7 s, luôn trước hạn ≥ 1 s; sai thì chọn ngẫu nhiên phương án sai.
- `RoomBotService.onQuestionStart(roomId, ...)` gọi từ vòng chơi sau `QUESTION_START`: hẹn giờ mỗi người máy đang trong cuộc (Đấu vương: chỉ khi đang đấu; Sinh tồn: cả bóng) → `RoomAnswerProcessor.process`.
- Giao diện: biểu tượng `smart_toy` + "(máy)" ở sảnh và bảng; nút "Thêm người máy" (chọn cấp) ở sảnh; Đấu nhanh "Chơi với người máy".
- **Test:** `BotAnswerPlannerTest`, `RoomBotServiceScheduleTest`; web sảnh + bảng.

### PCV-22 Hội ý (Đội đấu đội)
- V78: `rooms.team_consensus BOOLEAN NOT NULL DEFAULT FALSE`; tạo phòng/đổi cách chơi nhận `teamConsensus`.
- Khi một thành viên trả lời: gửi `TEAM_VOTE {playerId, username, answerIndex}` tới từng đồng đội qua `/user/queue/room/{id}/team`.
- Hết vòng: đáp án đội = phương án nhiều phiếu nhất (hòa → chọn sớm nhất); đúng 100, cả đội cùng chọn đúng +50; điểm đội = tổng các câu. `ROUND_END.teamAnswers {A, B}`.
- Chat đội `/app/room/{id}/team-chat {text}` → đồng đội.
- **Test:** `TeamConsensusScoringTest`, WS controller test; web: phiếu đồng đội, tab "Đội mình".

### PCV-23 Thách đấu bạn bè
- Nhận lời ⇒ tạo phòng Đua tốc độ (10 câu, 20 giây, riêng tư), người thách làm chủ phòng và chơi, người được thách được thêm vào; trả `{roomId, roomCode}`.
- `GET /api/challenges/{id}` (người thách hỏi mỗi 3 s), `POST /api/challenges/{id}/cancel`, `GET /api/challenges/pending` (mỗi 20 s khi app mở).
- Giao diện: nút "Thách đấu" ở Bảng xếp hạng (không ở dòng của mình); hộp "Đang chờ X nhận lời (4:59)" + Hủy; hộp mời toàn app "X thách bạn đấu 10 câu" [Nhận] [Để sau]; nhận ⇒ cả hai vào sảnh.
- **Test:** `ChallengeServiceTest`, `ChallengeControllerTest`; web: nút, hộp chờ, hộp mời.

### PCV-24 Ôn phần đọc hôm nay
- V78: `rooms.passage_scope TEXT NULL` (JSON `[{book, fromChapter, toChapter}]`).
- Chọn câu: theo sách + khoảng chương; thiếu thì bù câu cùng sách, rồi câu bất kỳ.
- Tạo phòng nhận `?passage=Genesis:27-28,Psalms:7`: tên "Ôn phần đọc hôm nay", hiện phạm vi.
- forbible-doc: "Ôn phần này cùng nhóm" sau "Xong phần" và trên thẻ phần đã đọc → `https://www.forbible.org/room/create?passage=…`; chưa đăng nhập thì đăng nhập rồi quay lại đúng trang.
- **Test:** `PassageScopeTest`, `RoomQuizService` chọn câu; web CreateRoom; forbible-doc vitest.

### PCV-25 Spec, DECISIONS, review cuối, deploy
- SPEC_MULTIPLAYER §0.3, SPEC_USER (Thách đấu), DECISIONS; review cả nhánh bằng một reviewer (opus); sửa Critical/Important; cả bộ test; boot + smoke; deploy BE + FE + forbible-doc.
