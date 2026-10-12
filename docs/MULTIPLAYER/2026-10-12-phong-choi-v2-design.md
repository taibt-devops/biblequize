# Phòng chơi v2 — thiết kế

> **Nguồn:** bản review game design ngày 12/10/2026. Chủ dự án duyệt làm cả 3 đợt và uỷ quyền mọi quyết định: "làm hết luôn đi, làm cho đến khi hoàn thiện, cứ làm theo ý bạn". Mọi chỗ đổi luật được ghi vào `DECISIONS.md` (ngày 12/10/2026) và `SPEC_MULTIPLAYER.md`.
>
> **Kế hoạch triển khai:** `docs/plans/2026-10-12-phong-choi-v2-dot-1.md`, `-dot-2.md`, `-dot-3.md`.
>
> **Theo dõi:** `docs/todo/active/2026-10-12-phong-choi-v2.md` (mã PCV-*).

Tài liệu dùng các tên mode tiếng Việt: Đua tốc độ (`SPEED_RACE`), Sinh tồn (`BATTLE_ROYALE`), Đội đấu đội (`TEAM_VS_TEAM`), Đấu vương (`SUDDEN_DEATH`), Chơi cùng nhau (`GROUP_LIVE_SEQUENTIAL`).

---

## Đợt 1 — Sửa lỗi

### 1.1 Máy chủ đo thời gian trả lời

Hiện máy chủ tin số `reactionTimeMs` do máy người chơi gửi lên. Cách mới:

- Lúc phát `QUESTION_START`, máy chủ ghi `roundStartMs` vào Redis (khóa riêng, không đưa vào payload gửi xuống, để đồng hồ lệch của máy người chơi không làm hỏng bộ đếm giờ trên màn).
- Lúc nhận câu trả lời: `serverElapsedMs = now − roundStartMs`.
- Thời gian dùng để chấm: `clamp(client, serverElapsedMs − 1500, serverElapsedMs)`, rồi kẹp vào `[0, timeLimitMs]`.
  - Người mạng chậm không bị thiệt (số của máy họ vẫn được dùng nếu hợp lý).
  - Người sửa gói tin chỉ gian được tối đa 1,5 giây.
- Thiếu `roundStartMs` (máy chủ vừa khởi động lại) thì kẹp số của máy vào `[0, timeLimitMs]`.

### 1.2 Đóng vòng

- Vòng có hạn chót `timeLimit + 1 giây` ân hạn cho mạng chậm. Màn hình vẫn đếm `timeLimit`, nút bị khóa khi về 0.
- Khi vòng kết thúc (hết giờ, mọi người đã trả lời, hoặc Quản trò bỏ câu), máy chủ đánh dấu vòng đã đóng **trước** khi phát `ROUND_END` / `QUESTION_REVEALED`.
- Câu trả lời tới sau khi vòng đã đóng, hoặc quá hạn chót, bị bỏ qua (không báo lỗi).

### 1.3 Không lộ đáp án giữa chừng

- `ANSWER_SUBMITTED` chỉ còn `{ playerId, username, questionIndex, answered: true }`. Bỏ `answerIndex`, `isCorrect`, `pointsEarned`, `reactionTimeMs`. Áp dụng cho mọi mode.
- Bỏ phát `SCORE_UPDATE` theo từng câu trả lời, vì điểm tăng là lộ đúng/sai. Điểm cập nhật một lần ở `ROUND_END`.
- `ROUND_END` mang thêm:
  - `explanation` và `reference` (`{ book, chapter, verseStart, verseEnd }`);
  - `answerCounts` (số người chọn từng phương án);
  - `results[]`: `{ playerId, answered, isCorrect, pointsEarned, streak }`.
- Bảng tin bên phải: lúc đang trả lời chỉ hiện "Minh đã trả lời". Lúc công bố hiện "Đúng: …" và "Sai: …".

### 1.4 Bộ luồng riêng cho trận

- Vòng chơi chạy trên executor riêng `roomGameExecutor` (core 8, max 256, queue 0), tên luồng `room-game-`. Đính chính khi làm (DECISIONS 2026-10-12): bộ mặc định không phải 8 luồng mà là `SimpleAsyncTaskExecutor` không giới hạn; executor riêng để có trần rõ ràng.
- Nếu máy chủ hết luồng thì phòng không bắt đầu: trả về lỗi "Máy chủ đang bận, thử lại sau ít phút" và phòng giữ ở LOBBY.

### 1.5 Bắt đầu phòng an toàn

- Chuyển phòng `LOBBY → IN_PROGRESS` bằng một lệnh cập nhật có điều kiện (`WHERE status = 'LOBBY'`). Bấm hai lần, hoặc hai người cùng bấm trong Đấu nhanh, chỉ chạy một vòng chơi.

### 1.6 Số người và cài đặt theo mode (kiểm ở máy chủ)

| Mode | Số người để bắt đầu | Tối đa | Điều kiện thêm |
| --- | --- | --- | --- |
| Đua tốc độ | 2 | 100 | |
| Sinh tồn | 3 | 100 | |
| Đội đấu đội | 4 | 100 | Mỗi đội ≥ 2 người, hai đội lệch nhau ≤ 1 |
| Đấu vương | 3 | **12** | |
| Chơi cùng nhau | 2 | 100 | Giữ nguyên |

- Số người tính các RoomPlayer chưa rời phòng, kể cả người máy (đợt 3). Phải có ít nhất 1 người thật.
- Giới hạn Đấu vương 12 người là quyết định mới. Ngoại lệ so với quyết định 22/05 "100 người cho mọi mode", vì Đấu vương đấu tay đôi lần lượt: phòng đông thì phần lớn người chơi không tới lượt.
- Số câu 5–30, thời gian mỗi câu 10–60 giây. Máy chủ kẹp mọi giá trị ngoài khoảng (form vốn đã đúng).

### 1.7 Ghi hạng cuối và tiến độ

- Mọi mode đều ghi `finalRank`:
  - **Đua tốc độ, Chơi cùng nhau:** xếp theo điểm, rồi số câu đúng, rồi thời gian trung bình. Bằng hệt nhau thì đồng hạng.
  - **Đội đấu đội:** đội thắng hạng 1, đội thua hạng 2. Hòa thật thì cả hai đội hạng 1.
  - **Sinh tồn, Đấu vương:** xem đợt 2.
- Kết thúc trận, với mỗi người thật còn trong trận (không LEFT):
  - nhiệm vụ `play_multiplayer_room`;
  - nếu `finalRank == 1`, nhiệm vụ `win_multiplayer_room`.
- **Không cộng XP cho Phòng chơi.** XP chính là điểm bảng xếp hạng. Quyết định 02/05 chỉ cho Đấu Hạng và Thử thách ngày ghi XP, nhằm chặn cày điểm. Phòng chơi với bạn bè dễ cày nên giữ nguyên quyết định này.
- Ô "MVP" ở thống kê tuần đổi thành: số trận trong tuần mà người chơi có điểm cao nhất, trong phòng có ≥ 3 người thật. Tính thẳng từ `room_room_players`, không dùng bảng thành tích (category `MULTIPLAYER_MVP` không tồn tại).

### 1.8 Nhiệm vụ ngày

Có 13 loại nhiệm vụ, nhưng máy chủ chỉ đếm 3. Sửa như sau:

- **Điểm vào chung:** `DailyMissionService.onAnswer(userId, AnswerEvent{ correct, difficulty, book, responseMs })`. Mọi luồng trả lời (Luyện Tập, Đấu Hạng, Thử thách ngày, Phòng chơi) gọi hàm này. Từ một sự kiện, hàm đẩy tiến độ cho:
  - `answer_correct`;
  - `answer_combo`;
  - `answer_correct_difficulty` (đúng độ khó trong config);
  - `answer_hard_fast` (câu Khó, đúng, ≤ `maxSec`);
  - `answer_correct_book` (đúng câu thuộc sách đang học: `config.book` nếu có, nếu không thì sách bất kỳ).
- **Sự kiện khác:**
  - `play_any_mode`: xong một lượt Luyện Tập, Đấu Hạng, Thử thách ngày, hoặc một trận Phòng chơi;
  - `ranked_score`: một lượt Đấu Hạng đạt ≥ `minScore` điểm;
  - `play_multiplayer_room`, `win_multiplayer_room`: như mục 1.7;
  - `memorize_review`: ôn một câu Học Thuộc.
- **Thay các loại không còn lối vào:**

  | Loại cũ | Thay bằng |
  | --- | --- |
  | `complete_speed_round` | `play_multiplayer_room` (1) |
  | `complete_mystery_mode` | `memorize_review` (3) |
  | `leaderboard_daily_top3` | `win_multiplayer_room` (1) |
  | `review_ai_draft` | `answer_correct_difficulty` (Khó, 5) |

  Các dòng nhiệm vụ của hôm nay mang loại cũ được đổi ngay lúc đọc, tiến độ đặt về 0.
- **Thưởng:** xong cả 3 nhiệm vụ thì cộng **50 XP** thật, một lần mỗi ngày, bằng cùng đường ghi XP của Thử thách ngày, rồi xóa cache bảng xếp hạng. Giao diện đã hứa "+50 XP nhận được!" nhưng trước giờ chưa cộng. Spec §13.3 ghi "mỗi nhiệm vụ +50 XP"; ta chọn 50 XP khi xong cả 3 (ghi vào DECISIONS).
- Người máy không bao giờ được tính tiến độ.

### 1.9 Giải thích và câu gốc sau mỗi câu

- `ROUND_END` mang `explanation` và `reference` (mục 1.3).
- Màn công bố hiện câu gốc cho mọi người, ví dụ "📖 Sáng Thế Ký 27:5–8". Phần giải thích mở sẵn khi trả lời sai; khi trả lời đúng thì gập lại, bấm để xem.
- Nghỉ giữa hai câu: 5 giây, có giải thích thì 7 giây (trước đây 3 giây).

### 1.10 Đấu nhanh

- Tắt nguồn câu hỏi AI cho trận trực tiếp:
  - Giao diện bỏ lựa chọn AI.
  - Máy chủ trả 422 `AI_SOURCE_DISABLED` nếu vẫn bị gọi.
  - Lý do: câu AI chưa được duyệt, đi ngược với bộ câu RVV11 đã biên tập kỹ. Hơn nữa luồng vào trận chưa bao giờ dùng các câu đó, nên mỗi lần chọn AI là tốn tiền vô ích.
- Giới hạn 3 trận/ngày chỉ còn áp cho nguồn AI, tức là không còn áp dụng. Giao diện bỏ dòng "còn N lượt".

### 1.11 Tên, biểu tượng, mô tả

`MODE_META` là nguồn duy nhất; màn tạo phòng, sảnh chờ, danh sách phòng và kết quả đều đọc từ đây.

| Mode | Icon | Số người | Mô tả một dòng |
| --- | --- | --- | --- |
| Đua tốc độ | `bolt` | 2–100 | Đúng và nhanh thì được nhiều điểm. Đúng liên tiếp được thưởng, câu cuối nhân đôi. |
| Sinh tồn | `favorite` | 3–100 | Mỗi người 2 mạng. Sai mất 1 mạng, hết mạng thì ra ngoài xem. Ai trụ lại cuối cùng thắng. |
| Đội đấu đội | `groups` | 4–100 | Chia hai đội. Điểm đội là điểm trung bình của thành viên. Cả đội cùng đúng được thưởng. |
| Đấu vương | `swords` | 3–12 | Đấu tay đôi giành ngai. Thắng giữ ngai, thua về cuối hàng. Ai thắng nhiều trận nhất là vua. |

Sảnh chờ dùng tên tiếng Việt (bỏ "Speed Race", "Battle Royale", "Team vs Team").

### 1.12 Màn tạo phòng: chủ phòng chơi hay dẫn

Giữ mặc định Quản trò (spec §2.5). Nút gạt chuyển thành lựa chọn hai ô ngay dưới tên phòng: "Tôi dẫn chương trình" / "Tôi chơi cùng mọi người".

---

## Đợt 2 — Thiết kế lại 4 mode

### 2.1 Đua tốc độ

- **Thưởng chuỗi:** đúng liên tiếp lần thứ 2 được +10, lần thứ 3 +20, từ lần thứ 4 trở đi +30. Sai hoặc không trả lời thì về 0. Lưu ở cột mới `room_room_players.answer_streak`.
- **Câu chốt:** câu cuối nhân đôi toàn bộ điểm của câu đó (gốc + tốc độ + chuỗi).
  - `QUESTION_START` mang `multiplier: 2`.
  - Màn hiện "Câu chốt · ×2" trước khi câu bắt đầu.
- **Phân hạng:** điểm → số câu đúng → thời gian trung bình.
- **Giao diện:**
  - Bỏ banner combo ×1,2/×1,5 hiện có: banner này chỉ ở giao diện, máy chủ không áp dụng.
  - Hiện "Chuỗi 3 · +20" lấy từ `results[]` của `ROUND_END`.
  - Sau câu 3, 6, 9… hiện bảng 5 người dẫn đầu kèm mũi tên lên/xuống.

### 2.2 Sinh tồn

- **Mạng:** mỗi người 2 mạng (cột mới `lives`). Sai hoặc không trả lời mất 1 mạng; hết mạng thì `ELIMINATED`.
  - Nếu tất cả người còn trong cuộc cùng sai thì không ai mất mạng (giữ luật ân xá cũ).
- **Độ khó tăng dần:** khi nguồn là kho câu hỏi và độ khó "Hỗn hợp", lấy 30% Dễ / 40% Trung bình / 30% Khó, xếp theo thứ tự Dễ → Trung bình → Khó. Lấy thêm 5 câu Khó dự phòng cho phần quyết định. Bộ câu tự soạn giữ nguyên thứ tự.
- **Vùng nguy hiểm:** từ câu thứ 10, thời gian = `max(10, base − 2×(câu − 9))`.
  - `QUESTION_START` mang `dangerZone: true`.
- **Hồi sinh:**
  - Người đã bị loại vẫn trả lời được dưới dạng "bóng": không được điểm, không tính câu đúng, không làm vòng kết thúc sớm.
  - Đúng 3 câu liên tiếp khi đang là bóng, trước vùng nguy hiểm (câu 1–9), thì được hồi sinh với 1 mạng. Mỗi người tối đa 1 lần.
  - Phát `PLAYER_REVIVED`.
  - Cột mới: `ghost_streak`, `revived`; `room_answers.ghost`.
- **Phần quyết định:** hết số câu mà còn > 1 người thì chơi tối đa 5 "Câu quyết định".
  - Sai hoặc không trả lời là bị loại ngay (vẫn ân xá nếu tất cả cùng sai).
  - Dừng khi chỉ còn 1 người.
  - `QUESTION_START` mang `showdown: true`.
- **Xếp hạng:**
  - Người bị loại xếp theo lượt bị loại (cùng lượt thì đồng hạng).
  - Người còn lại khi hết trận xếp theo mạng còn lại → số câu đúng → thời gian trung bình.
- **Giao diện:** hiện tim ♥ và số người còn lại thay cho điểm. Bóng có dòng "Đúng 3 câu liên tiếp để hồi sinh (còn N câu)".

### 2.3 Đội đấu đội

- **Điểm đội** = trung bình điểm cá nhân của thành viên còn trong trận (ACTIVE), làm tròn, cộng 50 × số lần cả đội đúng.
  - Nếu cả đội đã rời trận thì lấy trung bình của tất cả thành viên.
- **Cả đội đúng:** mọi thành viên ACTIVE đều đúng (cần ≥ 1 người ACTIVE). Thưởng +50 cho đội, một lần, không cộng vào điểm cá nhân.
- **Hòa:** so số lần cả đội đúng → thời gian trung bình của đội → hòa thật.
- **Sảnh chờ:**
  - Không cho bắt đầu khi lệch đội (mục 1.6).
  - Nút "Xáo đội" cho chủ phòng (Đấu nhanh: ai cũng bấm được). API `POST /api/rooms/{id}/shuffle-teams`.
- **Tên đội:** chọn theo mã phòng từ các cặp: Giô-suê / Ca-lép, Phi-e-rơ / Giăng, Đa-vít / Giô-na-than, Ru-tơ / Na-ô-mi, Ê-li / Ê-li-sê, Mô-se / A-rôn. Giao diện tự tính; mọi máy ra cùng một cặp.

### 2.4 Đấu vương

- **Hàng chờ:** xáo ngẫu nhiên lúc bắt đầu. Hai người đầu hàng đấu trước.
- **Mỗi câu:**
  - một đúng một sai → phân thắng thua;
  - cả hai đúng → ai nhanh hơn ≥ 0,2 giây thắng (dùng thời gian máy chủ đã kẹp);
  - cả hai sai, hoặc chênh < 0,2 giây → đấu tiếp;
  - hòa 3 lần → vua giữ ngai.
- **Xoay vòng:**
  - người thua về cuối hàng (`SPECTATOR`);
  - người thắng giữ hoặc giành ngai (`ACTIVE`).
- **Kết thúc** khi một trong hai điều sau xảy ra:
  - (a) mọi người đã đấu ít nhất 1 trận, và vua đang có chuỗi ≥ `target` (3 nếu ≤ 5 người, 4 nếu đông hơn);
  - (b) đã dùng hết số câu (`questionCount` là ngân sách số vòng).
- **Thống kê mỗi người** (cột mới): `matches_won`, `best_streak`, `matches_played`.
- **Xếp hạng:** số trận thắng → chuỗi dài nhất → số câu đúng → thời gian trung bình.
- **Khán giả đoán:**
  - Khi `MATCH_START`, khán giả gửi `/app/room/{id}/predict { matchNo, pickUserId }`, đổi được tới khi câu đầu tiên của trận bắt đầu.
  - Đoán đúng +1 `prediction_points` (cột mới).
  - Cuối trận phát `PREDICTION_RESULT { matchNo, winnerId, correctUserIds }`.
  - Màn kết quả ghi thêm "Khán giả tinh mắt: X (N lần đoán đúng)".

### 2.5 Chơi lại với nhóm này

- `POST /api/rooms/{id}/rematch`:
  - Phòng phải đã ENDED.
  - Người gọi phải là chủ phòng (Đấu nhanh: bất kỳ người chơi nào).
  - Gọi lại không tạo phòng thứ hai: khóa Redis `rematch:{oldId}` (SETNX, TTL 1 giờ) trả về phòng đã tạo.
- Phòng mới chép mọi cài đặt (mode, số câu, thời gian, độ khó, phạm vi sách, ngôn ngữ, công khai, Quản trò/chơi cùng, Đấu nhanh, bộ câu tự soạn hay của nhóm). Nguồn AI chuyển thành kho câu hỏi.
- Người máy của phòng cũ được thêm lại tự động.
- Phát `REMATCH_READY { roomId, roomCode }` lên topic phòng cũ. Màn kết quả của mọi người hiện "Vào ván mới" (gọi join bằng mã phòng); người tạo vào sảnh luôn.

### 2.6 Đổi cài đặt ngay trong sảnh chờ

- `PATCH /api/rooms/{id}/settings` (chủ phòng, khi LOBBY): `{ mode?, questionCount?, timePerQuestion?, difficulty? }`.
  - Kiểm theo mục 1.6.
  - Đổi sang Đội đấu đội thì chia đội cân; đổi khỏi Đội đấu đội thì xóa đội.
  - Mọi người chơi khác về trạng thái "chưa sẵn sàng".
  - Phát `ROOM_STATE` và một dòng chat hệ thống "Chủ phòng đổi sang Sinh tồn · 15 câu · 20 giây".
- Sảnh chờ: chủ phòng có nút "Đổi cách chơi", mở hộp chọn 4 mode cùng số câu và thời gian.

---

## Đợt 3 — Tính năng mới

### 3.1 Người máy

- **Dữ liệu:**
  - Migration thêm `users.is_bot` (mặc định false).
  - Seed 6 tài khoản máy: Máy An, Máy Bình, Máy Châu, Máy Dũng, Máy Giang, Máy Hà. Provider `bot`, không có mật khẩu, email `*@bots.forbible.invalid`, nên không đăng nhập được.
- **Thêm vào phòng:**
  - `POST /api/rooms/{id}/bots { level: EASY|MEDIUM|HARD }` (chủ phòng; Đấu nhanh: mọi người chơi). Tối đa 5 người máy mỗi phòng; phải còn chỗ.
  - Người máy luôn "sẵn sàng". Bỏ ra bằng nút "Mời ra" (kick) như người thật.
  - Cột mới `room_room_players.bot_level`.
- **Cách người máy trả lời:**
  - Sau mỗi `QUESTION_START`, máy chủ hẹn giờ trả lời cho mỗi người máy đang trong cuộc (Đấu vương: chỉ khi đang đấu).
  - Câu trả lời đi qua đúng `RoomAnswerProcessor`.
  - Xác suất đúng theo cấp và độ khó câu:

    | Cấp | Dễ | Trung bình | Khó |
    | --- | --- | --- | --- |
    | Dễ | 0,55 | 0,40 | 0,25 |
    | Vừa | 0,80 | 0,65 | 0,45 |
    | Giỏi | 0,95 | 0,85 | 0,70 |

  - Thời gian trả lời: Dễ 6–14 giây, Vừa 4–10 giây, Giỏi 2,5–7 giây, luôn trước hạn 1 giây. Trả lời sai thì chọn ngẫu nhiên một phương án sai.
- **Những gì loại người máy ra:**
  - Không bao giờ được đẩy lên làm chủ phòng.
  - Không được tính khi xét "không còn ai trong phòng".
  - Không chịu luật "đang ở phòng khác".
  - Không có nhiệm vụ, thống kê hay XP.
  - Bảng điểm có biểu tượng `smart_toy` và chữ "(máy)".
- **Đấu nhanh:** thêm nút "Chơi với người máy" để bắt đầu luôn mà không phải chờ ai.

### 3.2 Hội ý (Đội đấu đội)

- **Cài đặt:** Đội đấu đội có thêm lựa chọn "Hội ý" (cột mới `rooms.team_consensus`).
- **Mỗi câu:**
  - Mỗi thành viên chọn một lần, như hiện nay.
  - Đồng đội thấy ngay ai chọn gì: tin `TEAM_VOTE` gửi riêng tới từng đồng đội qua `/user/queue/room/{id}/team`, đội kia không nhận được.
  - Đáp án của đội là phương án nhiều phiếu nhất. Hòa phiếu thì lấy phương án được chọn sớm nhất trong số các phương án hòa.
- **Điểm đội mỗi câu:** đáp án đội đúng được 100. Cả đội cùng chọn đúng phương án thì +50. Điểm đội ở chế độ này là tổng các câu, không lấy trung bình. Điểm cá nhân vẫn tính như thường cho bảng cá nhân.
- **Chat đội:** `/app/room/{id}/team-chat { text }`. Máy chủ gửi tới từng đồng đội; giao diện có tab "Đội mình".
- **ROUND_END** mang `teamAnswers: { A: idx|null, B: idx|null }`.

### 3.3 Thách đấu bạn bè

- **Nhận lời:** tạo luôn phòng Đua tốc độ (10 câu, 20 giây, riêng tư). Người thách làm chủ phòng và cùng chơi; người được thách được thêm vào phòng. Trả về `{ roomId, roomCode }`.
- **Báo kết quả:** không cần WebSocket toàn cục.
  - Người được thách hỏi `GET /api/challenges/pending` mỗi 20 giây trong lúc app đang mở.
  - Người thách hỏi `GET /api/challenges/{id}` mỗi 3 giây trong lúc chờ.
- **Giao diện:**
  - Nút "Thách đấu" ở các dòng Bảng xếp hạng (không có ở dòng của mình).
  - Hộp "Đang chờ Minh nhận lời (4:59)", có nút Huỷ (`POST /api/challenges/{id}/cancel`).
  - Hộp mời toàn app: "Minh thách bạn đấu 10 câu" [Nhận] [Để sau].
  - Nhận lời thì cả hai vào sảnh chờ.

### 3.4 Ôn phần đọc hôm nay

- **Phạm vi theo đoạn:** phòng mới có `passage_scope` (JSON `[{ book, fromChapter, toChapter }]`).
  - Chọn câu theo sách và khoảng chương.
  - Không đủ số câu thì bù bằng các câu khác trong cùng sách, rồi tới câu bất kỳ.
- **Màn tạo phòng:** nhận tham số URL `?passage=Genesis:27-28,Psalms:7`, điền sẵn tên phòng "Ôn phần đọc hôm nay" và hiện phạm vi đã chọn.
- **App Đọc hằng ngày** (repo forbible-doc):
  - Sau "Xong phần", và trên thẻ phần đã đọc, có liên kết "Ôn phần này cùng nhóm".
  - Liên kết mở `https://www.forbible.org/room/create?passage=…`.
  - Nếu chưa đăng nhập Bible Quiz thì đi qua bước đăng nhập rồi quay lại đúng trang.

---

## Không làm, và lý do

- **Đấu với lượt chơi đã ghi ("bóng ma"):** người máy (3.1) giải được cùng bài toán thiếu người, đơn giản hơn, rõ ràng hơn với người chơi, và dùng được ở mọi mode.
- **Thời gian theo độ dài câu:** chủ phòng đã tự chọn thời gian mỗi câu. Thêm luật tự co giãn chỉ làm luật khó hiểu.
- **XP cho Phòng chơi:** xem mục 1.7.
- **Gỡ các mode Mystery, Speed Round, Weekly Quiz:** nằm ngoài Phòng chơi. Đợt này chỉ thay các nhiệm vụ trỏ tới chúng.

## Kiểm thử

- **Máy chủ:** mỗi luật mới có test JUnit ở tầng service hoặc strategy (Mockito, cùng kiểu với các test sẵn có). Controller mới có `@WebMvcTest`. Chạy cả bộ trước mỗi lần deploy.
- **Giao diện:** Vitest cho hook và component mới. Sửa các test phòng chơi hiện có theo payload mới.
- **Trên prod:** sau mỗi đợt, chơi thử ít nhất một trận mỗi mode bằng người máy (đợt 3) hoặc bằng hai tài khoản thử.
