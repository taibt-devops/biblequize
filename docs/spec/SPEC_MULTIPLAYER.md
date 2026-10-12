# SPEC_MULTIPLAYER — Multiplayer & Room Lifecycle

> Last updated **2026-10-12** (Phòng chơi v2 đợt 1 — PCV-1..10, xem §0) · trước đó 2026-05-09 (Sprint 4 — Host-Organizer separation) · Replaces SPEC_USER_v3 §5.4 + `docs/MULTIPLAYER/SPEC_USER_v3_PATCH_5.4.0.md`.
> Audience: backend + frontend engineers. Verified against `main` HEAD (Sprint 1 + 2.5 + 3 + 4 merged).
> Related: SPEC_USER_v3.1 (gameplay), SPEC_GROUP_v1.2 (group quiz sets, Q-A…Q-O), BACKLOG.md (open code gaps).
> Mockup reference: `docs/MULTIPLAYER/MOCKUP_HOST_ORGANIZER_FLOW.html` (Sprint 4 approved).

---

## 0. Phòng chơi v2 — đợt 1 (2026-10-12)

> Thiết kế: `docs/MULTIPLAYER/2026-10-12-phong-choi-v2-design.md` · task `docs/todo/active/2026-10-12-phong-choi-v2.md`. Các mục bên dưới đã sửa theo; mục này là bản tóm tắt để đọc nhanh.

| # | Thay đổi | Chi tiết |
|---|---|---|
| PCV-1 | **Máy chủ đo thời gian trả lời.** | Thời gian dùng để chấm = thời gian client gửi, kẹp trong `[max(0, serverElapsed − 1 500 ms), serverElapsed]` (`serverElapsed = now − startedAtMs`), rồi kẹp vào `[0, timeLimit]`. Trả lời sau `timeLimit + 1 000 ms` (ân hạn) bị từ chối. Hết giờ, vòng lặp chờ thêm 1 giây ân hạn rồi **đóng vòng** (`room:state:closed_round:{roomId}` = roundId); câu trả lời tới sau khi đóng vòng bị từ chối. `broadcastRoundEnd`/`broadcastQuestionRevealed` luôn đóng vòng trước khi công bố đáp án. |
| PCV-2 | **Không lộ đáp án giữa vòng.** | `ANSWER_SUBMITTED` chỉ còn `{playerId, username, questionIndex, answered: true}` (không còn `answerIndex`, `isCorrect`, `pointsEarned`); không gửi `SCORE_UPDATE` theo từng câu trả lời nữa. Mọi kết quả công bố cùng lúc trong `ROUND_END` (§5.3). Nghỉ giữa hai câu: 5 giây, 7 giây nếu câu có lời giải thích. |
| PCV-3 | **Màn chơi.** | Sau mỗi câu hiện câu gốc (sách chương:câu), lời giải thích (mở sẵn khi sai/không trả lời, thu gọn khi đúng), số người chọn từng đáp án, nút lưu câu. Bảng tin chỉ báo "X đã trả lời". Đồng hồ: dùng `startedAtMs` của máy chủ nếu lệch ≤ 2 giây so với đồng hồ máy người chơi, ngược lại đếm theo đồng hồ máy. Bỏ banner combo ×1,2/×1,5 (máy chủ không có hệ số này). |
| PCV-4 | **Bắt đầu trận.** | `UPDATE rooms SET status = IN_PROGRESS WHERE id = ? AND status = LOBBY` — bấm hai lần hay hai người cùng bấm chỉ một lần thắng ("Phòng đã bắt đầu"). Vòng chơi chạy trên executor riêng `roomGameExecutor` (luồng `room-game-*`, 8 lõi, tối đa 256, không hàng đợi). Hết luồng → phòng trở lại `LOBBY`, trả `503 { code: "SERVER_BUSY" }`. |
| PCV-5 | **Số người theo mode** (`RoomModeRules`). | Tối thiểu: Đua tốc độ 2, Sinh tồn 3, Đội đấu đội 4 (mỗi đội ≥ 2, lệch ≤ 1), Đấu vương 3, Chơi cùng nhau 2 — Quản trò không tính. Tối đa 100; **Đấu vương tối đa 12** (DECISIONS 2026-10-12). Áp ở tạo phòng, Đấu nhanh và bắt đầu trận; sảnh chờ hiện cùng luật (`lobbyRules.ts`) nên nút "Bắt đầu" chỉ sáng khi máy chủ sẽ nhận. Máy chủ kẹp số câu 5–30 và thời gian 10–60 giây. |
| PCV-6 | **Hạng cuối + nhiệm vụ sau trận.** | Đua tốc độ, Chơi cùng nhau: hạng theo điểm → số câu đúng → thời gian trung bình; người chưa trả lời câu nào xếp cuối; bằng nhau thì đồng hạng (1, 1, 3). Đội đấu đội: đội thắng hạng 1, đội thua hạng 2, hoà thật thì cả phòng hạng 1. Trận kết thúc bình thường → mỗi người chơi còn trong trận **và đã trả lời ít nhất 1 câu** được tính nhiệm vụ "Chơi 1 trận Phòng chơi" + "Chơi 1 lượt"; hạng 1 **có ít nhất 1 câu đúng** được tính "Thắng 1 trận Phòng chơi" (ngồi im cả trận thì đồng hạng 1 nhưng không được tính). MVP tuần: điểm > 0, phòng ≥ 3 người. |
| PCV-7b | **Độ khó cố định.** | Phòng chọn Dễ/Trung bình/Khó trước đây kết thúc ngay khi bắt đầu (`Question.Difficulty` viết thường); đã sửa. |
| PCV-8 | **Đấu nhanh.** | Chỉ dùng kho câu đã biên tập (`source = AI_GENERATED` → `422 AI_SOURCE_DISABLED`); bỏ giới hạn 3 trận/ngày (`remainingToday` vẫn trả để client cũ không lỗi). |
| PCV-9 | **Tên + biểu tượng.** | Một tên tiếng Việt cho mỗi mode ở mọi màn: Đua tốc độ (bolt ⚡), Sinh tồn (favorite ❤️), Đội đấu đội (groups 👥), Đấu vương (swords ⚔️), Chơi cùng nhau (group 📚). Tạo phòng có hai ô "Tôi dẫn chương trình" / "Tôi chơi cùng mọi người" (mặc định dẫn chương trình). |

Phòng chơi **không cộng XP** (XP chỉ đến từ Đấu Hạng, Thử thách ngày và thưởng nhiệm vụ — DECISIONS 2026-10-12).

## 1. Mục đích

Tài liệu này tách toàn bộ phần **multiplayer realtime** (rooms, WebSocket events, lifecycle, 5 game modes, host-organizer separation) khỏi `SPEC_USER_v3.md` §5.4 — vốn đang lẫn cả gameplay solo + multiplayer trong cùng 1 chương dài. Mục tiêu:

1. Một file duy nhất chứa **mọi** quyết định canonical về multiplayer, để FE/BE engineer khi sửa room logic chỉ cần đọc 1 spec.
2. Khoá chặt **C7 Room Lifecycle R1–R5** (constraint canonical đã verify trong `docs/audit/AUDIT_CONSTRAINTS.md` §C7) — không còn rải rác giữa SPEC_USER + AUDIT + commit messages.
3. Document **5 game modes** (đã ship full): Speed Race, Battle Royale, Team vs Team, Sudden Death, Group Live Sequential.
4. Liệt kê **WebSocket event catalog** đầy đủ (client→server + server→client) để FE mock + test E2E không phải đoán payload shape.
5. Document **Host-Organizer separation (Sprint 4)** — Quản trò không chơi, chỉ điều phối; loại bỏ host advantage trong Group Quiz Set; match Kahoot pattern.
6. Là input cho `BACKLOG.md` (open issues như Q-A scoring scope, CANCELLED enum cleanup).

Phạm vi **KHÔNG** bao gồm: solo Practice/Ranked, Daily Challenge, Variety modes, Group leaderboard scoring (xem SPEC_GROUP_v1.2 Q-A), TV Host Mode (defer v1.5).

---

## 2. Room Model

### 2.1 Entity

Multiplayer state sống trên **4 JPA entity** trong package `com.biblequiz.modules.room.entity`:

| Entity | Table | Mục đích |
|---|---|---|
| `Room` | `rooms` | Metadata phòng (mã, host, mode, config, status, timestamps). |
| `RoomPlayer` | `room_room_players` | 1 row / user / room. Score, ready, team, playerStatus, answers map. |
| `RoomRound` | `room_rounds` | 1 row / câu hỏi đã phát ra. Soft FK tới `questions` HOẶC `user_questions` (xem note dưới). |
| `RoomAnswer` | `room_answers` | 1 row / player / round. answerIndex, isCorrect, responseMs, pointsEarned. |

Bonus entity (cùng package, ngoài scope spec này): `Challenge` (peer-challenge stub, không liên quan room realtime).

#### `Room` (`Room.java:13-197`)

| Field | Kiểu | Default | Note |
|---|---|---|---|
| `id` | `String(36)` | UUID v4 (hiện code gen `UUID.randomUUID()` — NOT v7, divergence với CLAUDE.md "UUID v7"; tracked trong BACKLOG) | PK. |
| `roomCode` | `String(8)` UNIQUE | 6 ký tự `[A-Z0-9]` từ `SecureRandom` (`RoomService.java:587-596`) | User nhập để join; uppercase enforce trong `RoomController.joinRoom`. |
| `roomName` | `String(100)` | "Phòng của {host.name}" nếu blank | Validate 5–60 ký tự, không cho repeat 1 ký tự (`RoomController.java:48-53`). |
| `maxPlayers` | `Integer` | 4 | 2–100 (FE slider enforce; BE chấp nhận giá trị trong body). Cap nâng từ 20→100 (2026-05-22, xem DECISIONS.md) để hỗ trợ sự kiện lớn. |
| `currentPlayers` | `Integer` | 0 | **Denormalised counter**, recompute từ `RoomPlayer` count occupied (= không tính LEFT) sau mỗi insert/delete (`RoomService.syncPlayerCount`). |
| `questionCount` | `Integer` | 10 | Số câu trong session. Không áp dụng cho SUDDEN_DEATH (king-of-the-hill chạy đến khi còn 1 người). |
| `timePerQuestion` | `Integer` | 30 (giây) | Server-authoritative timer; FE compute remaining = `timeLimit - (now - startedAtMs)` (xem `QuestionStartData.startedAtMs`). |
| `status` | `RoomStatus` enum | `LOBBY` | Xem 2.2. |
| `mode` | `RoomMode` enum | `SPEED_RACE` | Xem 2.3 + section 3. |
| `difficulty` | `RoomDifficulty` enum | `MIXED` | EASY / MEDIUM / HARD / MIXED. |
| `bookScope` | `String(100)` | `"ALL"` | Group sentinel **hoặc** 1 tên sách English (`"Genesis"`). Groups (MBV, 2026-06-20): `ALL` / `OLD_TESTAMENT` / `NEW_TESTAMENT` / `PENTATEUCH` / `HISTORY` / `WISDOM` / `PROPHETS` / `GOSPELS` / `EPISTLES`. Server expand qua `BookScopes.expand()` → `q.book IN (...)`; rỗng = no filter. Query scoped rỗng → fallback pool chung (không để phòng thiếu câu). |
| `questionSource` | `QuestionSource` enum | `DATABASE` | Xem 2.4. |
| `questionSetId` | `String(36)` nullable | — | Khi `questionSource=CUSTOM` từ Question Set của user. |
| `groupQuizSetId` | `String(36)` nullable | — | Khi room spawn từ Group Quiz Set. Dùng để derive `groupId` cho FE "Back to group" (`RoomService.getRoomDetails:484-488`). |
| `customQuestionIds` | JSON `List<String>` | — | Inline custom (AI-gen ad-hoc). |
| `isPublic` | `Boolean` | `false` | TRUE → liệt kê trong `/api/rooms/public`. |
| `startedAt` | `LocalDateTime` | null | Set khi `startRoom()` flip → IN_PROGRESS. |
| `endedAt` | `LocalDateTime` | null | Set khi `endRoom()` flip → ENDED. Cũng là cutoff cho R3 retention. |
| `host` | `User` (`@ManyToOne`) | required | Ai bấm "Bắt đầu". Có thể đổi qua R4 host promotion. |
| `hostPlaysGame` | `Boolean` | `false` (Sprint 4+) | **TRUE** = legacy mode (host chơi như player); **FALSE** = Quản trò mode (host không trả lời câu hỏi, chỉ điều phối). Rooms tạo trước Sprint 4 = TRUE; rooms mới mặc định FALSE. Xem 2.5. |
| `createdAt` / `updatedAt` | `LocalDateTime` | Hibernate `@CreationTimestamp` / `@UpdateTimestamp` | `createdAt` là input cho R2 idle check; `updatedAt` cho R3 retention. |

#### `RoomPlayer` (`RoomPlayer.java:13-161`)

| Field | Kiểu | Default | Note |
|---|---|---|---|
| `id` | `String(36)` | UUID | PK. |
| `room` / `user` | `@ManyToOne` | required | Composite uniqueness enforce trong service (idempotent insert). |
| `username` | `String(50)` | từ `user.name` | Snapshot tại join time (đổi tên user sau không reflect — by design). |
| `avatarUrl` | `String` | từ `user.avatarUrl` | Snapshot. |
| `isReady` | `Boolean` | `false` | Toggle qua WS `/ready`. Reset = `false` khi player bị mark LEFT. |
| `team` | `Team` enum (`A` / `B`) nullable | null | Auto-assigned cho TEAM_VS_TEAM tại insert (`RoomService.addPlayerToRoom:248-253`). |
| `playerStatus` | `PlayerStatus` enum | `ACTIVE` | `ACTIVE` / `ELIMINATED` (BR) / `SPECTATOR` (SD) / `LEFT` (mid-game disconnect, kept for rejoin). |
| `finalRank` | `Integer` nullable | null | Set khi BR loại / SD champion-loser. |
| `winningStreak` | `Integer` | 0 | SD: số trận champion đã thắng liên tiếp. |
| `score` | `Integer` | 0 | Cộng dồn theo mode-specific scoring service. |
| `totalAnswered` / `correctAnswers` | `Integer` | 0 | Stat tracking. |
| `averageReactionTime` | `Double` | 0.0 | Rolling average (ms). |
| `answers` | `Map<Integer,String>` `@ElementCollection` | `{}` | Legacy backup; primary store là `RoomAnswer` rows. |
| `joinedAt` | `LocalDateTime` | `@CreationTimestamp` | Tie-breaker cho `promoteNextHost` ("longest-tenured ACTIVE non-host"). |

#### `RoomRound` (`RoomRound.java:7-66`)

`questionId` là **plain column** (`@Column(name="question_id")`), **không phải `@ManyToOne`**, vì cần soft-reference cả `questions` (built-in) lẫn `user_questions` (CUSTOM source). Hibernate `ddl-auto=update` ở dev sẽ auto-tạo FK nếu dùng `@ManyToOne` → block insert UserQuestion ID. Đây là chủ ý, không phải tech debt — comment trong code đã cảnh báo (`RoomRound.java:22-30`).

#### `RoomAnswer` (`RoomAnswer.java:9-75`)

Append-only. 1 row / (round × user). Anti-cheat enforce qua `existsByRoundIdAndUserId` check trong `RoomWebSocketController.handleAnswerSubmission` (line 191).

### 2.2 Status enum

```java
public enum RoomStatus {
    LOBBY,         // Đang chờ players join
    IN_PROGRESS,   // Quiz đang chạy
    ENDED,         // Quiz đã kết thúc (terminal)
    CANCELLED      // ❌ DEPRECATED — defensive only
}
```

| Status | Set bởi | Transition out | Note |
|---|---|---|---|
| `LOBBY` | `createRoom()` | → IN_PROGRESS (host start) · → DELETE (R1/R2/R4) | Default sau create. |
| `IN_PROGRESS` | `startRoom()` (line 399) | → ENDED (game complete OR R5 stuck) | `startedAt` được stamp đồng thời. |
| `ENDED` | `endRoom()` (line 407–418) | → DELETE (R3 retention 24h) | Idempotent: gọi lần 2 là no-op. |
| `CANCELLED` | **không ai set** | — | Enum value vẫn defined nhưng `setStatus(CANCELLED)` có **0 hits trong code** (verified Grep). `RoomPresenceListener:140` còn check defensive `=== CANCELLED`. → Cleanup item trong BACKLOG: drop enum value, đơn giản hoá state machine về 3 trạng thái. |

**Quy tắc khoá:** mọi terminal path đi qua `ENDED → DELETE`. Không bao giờ flip thẳng LOBBY → DELETE mà skip ENDED state (trừ R1 hard-delete cho LOBBY trống — đây là exception đã document).

### 2.3 Mode enum

```java
public enum RoomMode {
    SPEED_RACE,
    BATTLE_ROYALE,
    TEAM_VS_TEAM,
    SUDDEN_DEATH,
    GROUP_LIVE_SEQUENTIAL  // V39 — Feature A "Chơi cùng nhau"
}
```

5 modes. Default `SPEED_RACE`. `GROUP_LIVE_SEQUENTIAL` được thêm sau cùng (migration V39) phục vụ Group module — chi tiết section 3.5.

### 2.4 Question Source enum

```java
public enum QuestionSource {
    DATABASE,   // Ngân hàng câu hỏi hệ thống (66 books bilingual)
    CUSTOM      // QuestionSet user / inline customQuestionIds / GroupQuizSet
}
```

> ⚠️ Spec gốc (PROMPT) đề cập 4 nguồn: `DATABASE / CUSTOM / QUESTION_SET / GROUP_QUIZ_SET`. Code chỉ có **2 enum value** (`DATABASE`, `CUSTOM`). QuestionSet và GroupQuizSet được phân biệt qua **field riêng** trên `Room`:
>
> - `questionSetId` (String) — set khi user-Question-Set
> - `groupQuizSetId` (String) — set khi GroupQuizSet (Q-O từ SPEC_GROUP)
> - `customQuestionIds` (JSON list) — inline ad-hoc (AI generator preview, etc.)
>
> Cả 3 trường hợp đều mang `questionSource = CUSTOM`. `RoomQuizService.runQuiz` (line 384) phân nhánh dựa trên `questionSource == CUSTOM` để đọc UserQuestion thay vì Question repo.
>
> **Spec quyết định:** giữ enum 2-value (DATABASE | CUSTOM) như code hiện tại; nguồn cụ thể được route qua 3 ID field. Lý do: thêm enum value bây giờ sẽ buộc viết Flyway migration + code dispatch riêng cho mỗi nguồn, nhưng business logic chỉ cần phân biệt "đọc từ Question table" vs "đọc từ UserQuestion table".

### 2.5 Host Role — Quản trò (Sprint 4)

#### Hai chế độ host

Mỗi `Room` có flag `hostPlaysGame` quyết định vai trò host trong trận:

| Mode | `hostPlaysGame` | Host là RoomPlayer? | Host trả lời câu hỏi? | Host trong leaderboard? | Min players để start |
|---|---|---|---|---|---|
| **Quản trò mode** (Sprint 4+ default) | `false` | ❌ KHÔNG (chỉ là `Room.host` FK) | ❌ KHÔNG (server reject) | ❌ KHÔNG | 2 players (không tính host) → 3 người trong phòng |
| **Legacy mode** (rooms cũ + opt-in) | `true` | ✅ CÓ | ✅ CÓ | ✅ CÓ | 2 players (tính cả host) → 2 người trong phòng |

#### Lý do thiết kế (Sprint 4)

1. **Loại bỏ host advantage** — đặc biệt khi room dùng Group Quiz Set tự tạo (host đã đọc trước câu hỏi).
2. **Match Kahoot pattern** — văn hóa giáo dục đã quen: 1 người dẫn, N người chơi.
3. **Phù hợp văn hóa hội thánh Việt** — mục sư / group leader thực sự muốn vai trò "người dẫn", không phải "đối thủ" với members.
4. **Setup cho TV Host Mode v1.5** — host-as-organizer là precondition cho TV display mode.

#### Quy tắc Quản trò mode

- Host KHÔNG nằm trong `RoomPlayer` table → `currentPlayers` không tính host.
- Host KHÔNG có `isReady` toggle (mặc định bypass ready check).
- Server reject answer từ host: `submitAnswer` throw `BadRequestException("Quản trò không trả lời câu hỏi")`.
- `ROUND_END` leaderboard chỉ chứa players (không có host).
- `QUIZ_END` rankings chỉ chứa players.
- Host vẫn nhận TẤT CẢ events qua WS subscribe `/topic/room/{roomId}` để hiển thị spectator view.
- Host có 4 control endpoints riêng (xem section 8).

#### Validation start logic

Từ 2026-10-12 (PCV-5) `RoomService.startRoom` gọi `RoomModeRules.startError(mode, players, hostPlaysGame)` — `players` là RoomPlayer của phòng (Quản trò không nằm trong đó):

| Mode | Tối thiểu | Thêm | Thông báo |
|---|---|---|---|
| Đua tốc độ, Chơi cùng nhau | 2 | — | "Cần ít nhất 2 người chơi để bắt đầu" / "… (không tính Quản trò)" |
| Sinh tồn | 3 | — | "Sinh tồn cần ít nhất 3 người chơi" (+ " (không tính Quản trò)") |
| Đội đấu đội | 4 | mỗi đội ≥ 2, hai đội lệch ≤ 1 | "Mỗi đội cần ít nhất 2 người" · "Hai đội đang lệch nhau N người — hãy đổi đội cho cân" |
| Đấu vương | 3 | tối đa 12 người | "Đấu vương cần ít nhất 3 người chơi" |

Sau khi qua luật, trạng thái đổi bằng cập nhật có điều kiện (`markInProgressIfLobby`) — 0 dòng đổi = "Phòng đã bắt đầu".

#### Naming convention

| Layer | Term |
|---|---|
| Code (Java/TypeScript) | `host` (giữ throughout) |
| UI tiếng Việt | **"Quản trò"** |
| UI English | **"Game Host"** hoặc **"Quizmaster"** |
| i18n key prefix | `room.host.*` |

#### Migration policy

- Rooms tạo trước Sprint 4 deploy: `host_plays_game = TRUE` (legacy behavior preserved).
- Rooms tạo sau Sprint 4 deploy: `host_plays_game = FALSE` (Quản trò default).
- KHÔNG migrate retroactive — let legacy rooms ENDED tự nhiên qua R3 retention 24h.
- Body `POST /api/rooms` có optional field `hostPlaysGame` để override default. **Create Room UI (2026-10-12, PCV-9)**: hai ô chọn "Tôi dẫn chương trình" (mặc định, `hostPlaysGame=false`) / "Tôi chơi cùng mọi người" (`hostPlaysGame=true`), thay cho công tắc "Tôi cũng chơi" (2026-06-23).

#### Edge cases

- **Host muốn vừa điều phối vừa chơi:** chọn "Tôi chơi cùng mọi người" ở Create Room → `hostPlaysGame=true`, host là RoomPlayer, min players = 1 non-host (host + 1 = 2 người). Default vẫn Quản trò (không chơi).
- **Host disconnect (R4):** promote next-joined ACTIVE non-host player thành host. Player đó **dừng chơi**, score đến hiện tại được giữ lại nhưng không tính ranking. Status flips sang "host-now-organizer" — không thể quay lại làm player. (Edge case "host được promote không muốn làm" — defer Sprint 5, BACKLOG MP-9.)
- **Phòng còn 1 player giữa game:** game tiếp tục solo, host có thể bấm "Kết thúc sớm" qua `/host/end-early`.
- **Tournament organizer:** **KHÔNG áp dụng** Quản trò mode. Tournament organizer vẫn chơi như cũ (architectural change scope chỉ cho Multiplayer Room).

---

## 3. Game Modes

5 sub-section dưới đây mô tả từng mode. Mỗi mode có 1 (hoặc nhiều) scoring service riêng trong `modules/room/service/`.

### 3.1 Speed Race (`SPEED_RACE`)

#### Mục đích
Kahoot-style classic — tất cả player nhận cùng 1 câu, scoring theo độ chính xác **+ tốc độ**. Phổ biến nhất, mặc định cho mọi room mới.

#### Rules
- 2–100 players (`RoomModeRules`, 2026-10-12).
- N câu hỏi (5–30, mặc định 10), `timePerQuestion` 10–60 giây / câu (máy chủ kẹp).
- Thời gian trả lời do máy chủ đo (§0 PCV-1); hạng cuối theo điểm → câu đúng → thời gian trung bình (§0 PCV-6).
- Tất cả player thấy câu cùng lúc (server emit `QUESTION_START` với `startedAtMs`).
- Mỗi player **chỉ submit 1 lần / câu** (anti-cheat: `existsByRoundIdAndUserId` check ở `RoomWebSocketController:191`).
- Sau timeout → `ROUND_END` với `correctIndex` + leaderboard.
- Sau N câu → `QUIZ_END` với final results.

#### Scoring (`SpeedRaceScoringService.java`)

```
isCorrect == false  → 0 điểm
isCorrect == true   → 100 + floor((timeLimit_ms - responseMs) / timeLimit_ms × 50)
```

- Min đúng = 100 (timeout ngay sát limit nhưng kịp đúng)
- Max = 150 (trả lời tức thì)
- Sai / không trả lời = 0

#### Edge cases
- `responseMs` là thời gian đã kẹp theo đồng hồ máy chủ (§0 PCV-1), không phải số client gửi.
- Submit < `responseMs <= 0` → coerce về 100 (boundary check line 17).
- Submit sau `responseMs >= timeLimitMs` → 100 (vẫn ghi nhận đúng, không bonus).
- Player đã LEFT mid-game → `RoomWebSocketController:199-202` reject answer (status check).

### 3.2 Battle Royale (`BATTLE_ROYALE`)

#### Mục đích
Last-man-standing. Mỗi câu loại bớt người trả lời sai. Người cuối cùng thắng.

#### Rules
- 3–100 players (cap nâng 2026-05-22, xem DECISIONS.md; tối thiểu 3 áp ở máy chủ từ 2026-10-12).
- Sau mỗi `ROUND_END`: `BattleRoyaleEngine.processRoundEnd` (line 31+) chạy:
  - Lấy danh sách `ACTIVE` players + danh sách user trả lời đúng round này.
  - **Exception**: nếu **TẤT CẢ active đều sai** → không loại ai (round "ân xá").
  - Ngược lại: mọi ACTIVE không có trong `correctAnswerers` → set `playerStatus = ELIMINATED`, gán `finalRank = activeRemaining`.
- Broadcast `PLAYER_ELIMINATED` cho từng người bị loại + `BATTLE_ROYALE_UPDATE` cho counts.
- Game kết thúc khi còn ≤ 1 ACTIVE player → `QUIZ_END` với leaderboard sort by `finalRank` (`getRoomLeaderboardWithRanks`).

#### Scoring
Dùng chung `SpeedRaceScoringService` cho điểm (bonus tốc độ vẫn áp dụng), nhưng thắng/thua quyết định bởi **finalRank**, không phải tổng điểm. Leaderboard hiển thị cả `score` (tham khảo) và `finalRank` (chủ chốt).

#### Edge cases (verified 2026-05-09)
- **2 player states, 2 different semantics:**
  - `ELIMINATED` — lost a round in BR (`BattleRoyaleEngine.java:67` `p.setPlayerStatus(ELIMINATED)`). Final rank assigned, cannot rejoin BR.
  - `LEFT` — voluntary leave or disconnect-without-grace (`RoomService.java:311`, `RoomPresenceListener` cho mọi mode). User có thể rejoin (status flips ACTIVE in `RoomService.java:120-121`).
  - **Decision (Bui canonical 2026-05-09):** Accept current 2-state semantics. Disconnect mid-BR-game = LEFT (rejoinable until host/scheduler ends room), KHÔNG auto-ELIMINATED. Rationale: distinguish "lost a round" vs "lost connection"; allows reconnect-and-rejoin during 60s grace.
- Câu cuối còn 2 người, cả 2 sai → ân xá, không ai bị loại; round kế tiếp tiếp tục.
- Câu cuối còn 2 người, cả 2 đúng → cả 2 còn ACTIVE, game tiếp tục đến hết `questionCount` rồi xếp hạng survivors theo **`correctAnswers DESC → averageReactionTime ASC`** (`BattleRoyaleEngine.assignFinalRanks`). KHÔNG xếp theo score — score (công thức Speed Race) chỉ để hiển thị; canonical per DECISIONS 2026-06-12 (score không đơn điệu theo số câu đúng → tránh nghịch lý "ít đúng hơn mà xếp trên").

### 3.3 Team vs Team (`TEAM_VS_TEAM`)

#### Mục đích
Chia 2 đội A/B. Đội nào tổng điểm cao hơn thắng. Có Perfect Round bonus (cả đội đúng hết → +50 cho cả đội).

#### Rules
- 4–100 players; mỗi đội ≥ 2, hai đội lệch ≤ 1 người (máy chủ chặn bắt đầu, 2026-10-12).
- Auto-balance team khi join (`RoomService.addPlayerToRoom:249-253`): đội nào ít người hơn → join đội đó.
- Player có thể đổi đội qua `POST /api/rooms/{id}/switch-team` **khi LOBBY** (`RoomController:190-200`). IN_PROGRESS thì không.
- Mỗi câu: scoring giống Speed Race per-player.
- Sau mỗi round: `TeamScoringService.processPerfectRound`:
  - Nếu **toàn bộ team A** đều correct → +50 / từng player team A → broadcast `PERFECT_ROUND { teamAPerfect: true }`.
  - Tương tự team B.
  - Cả 2 đội perfect → cả 2 đều bonus.

#### Scoring (`TeamScoringService.java`)
- Per-question: dùng `SpeedRaceScoringService` (kế thừa speed bonus).
- Per-round: `PERFECT_ROUND_BONUS = 50` cộng cho từng player của đội perfect.
- Final: `calculateTeamScores` sum `RoomPlayer.score` theo `team`. Đội score cao hơn thắng.
- **Tie-break** khi 2 đội bằng tổng điểm (`determineWinnerWithTieBreak`, wire tại `TeamVsTeamStrategy.finishGame`): (1) tổng điểm cao hơn → (2) **số Perfect Round nhiều hơn** (đếm lũy kế per đội trong `afterRound` qua `GameLoopContext.modeState`) → (3) **tổng thời gian phản hồi nhanh hơn** → vẫn bằng thì `teamWinner = "TIE"` thật. `reason` ∈ {`SCORE`, `PERFECT_ROUNDS`, `SPEED`, `TIE`} chỉ để log, KHÔNG vào payload QUIZ_END.

#### Edge cases
- Player odd-out (5 vs 4) — chấp nhận (lệch 1); lệch ≥ 2 thì không bắt đầu được.
- Player rời khi LOBBY → đội còn lại; auto-balance KHÔNG re-trigger (chỉ chạy lúc insert).
- Player rời khi IN_PROGRESS → `LEFT`, vẫn tính team membership cho perfect round (nhưng không answer được nữa, nên team đó khó perfect).

### 3.4 Sudden Death (`SUDDEN_DEATH`) — V17

#### Mục đích
"King of the hill" 1v1. Champion ngồi ghế nóng, challenger lần lượt từ queue. Ai sai trước thua, người thắng giữ ghế.

#### Rules (`SuddenDeathMatchService.java`)
- 3–12 players (tối đa 12 từ 2026-10-12 — DECISIONS).
- Khi `startRoom`: `initializeQueue` (line 47) — sort theo `joinedAt`, set toàn bộ → `SPECTATOR`, reset `winningStreak = 0`.
- 2 player đầu queue → ACTIVE, broadcast `MATCH_START { championId, challengerId, queueRemaining }`.
- Mỗi câu:
  - Cả 2 trả lời. Chỉ kết quả của 2 ACTIVE được tính.
  - **Sai trước thua**: ai trả lời sai (hoặc timeout không trả lời) → loser; kia → winner.
  - **Cả 2 đúng** → người nhanh hơn thắng nếu chênh ≥ `CLOSE_THRESHOLD_MS = 200`; chênh < 200 ms → đấu thêm câu.
  - **Cả 2 sai** → đấu thêm câu.
  - Tối đa `MAX_CONTINUES = 3` câu đấu thêm trong một cặp; hết thì người đang giữ ngai thắng. (Spec trước 2026-10-12 ghi "cả 2 đúng → hoà" — sai so với code; đã sửa theo code.)
- Match end → `MATCH_END { winnerId, winnerStreak, loserId }`.
- Loser → `SPECTATOR`, finalRank = vị trí khi bị loại.
- Winner streak += 1, ngồi tiếp; challenger kế từ queue → ACTIVE.
- Game end khi queue rỗng + còn 1 champion.

#### Scoring
Score per-player ít quan trọng; cái quyết định là `winningStreak` + `finalRank`. Leaderboard cuối cùng sort by `finalRank` (champion = rank 1).

#### Edge cases
- Queue chỉ còn 1 người + champion → game end ngay sau câu đó.
- Tất cả tie 3 lần liên tiếp → force loss cho người có `averageReactionTime` cao hơn (current heuristic; document trong code comment).

### 3.5 Group Live Sequential (`GROUP_LIVE_SEQUENTIAL`) — V39

#### Mục đích
Chế độ "**Chơi cùng nhau**" cho nhóm tế bào / Bible study. Khác Kahoot ở chỗ:
- Không tính tốc độ (đúng = 100 điểm flat, sai = 0).
- **Chờ tất cả trả lời** mới reveal đáp án (giáo lý cần thảo luận).
- **Host bấm "Sang câu tiếp" thủ công** (Q-B từ SPEC_GROUP §7.6).

Phù hợp khi Group Leader chiếu phòng + người chơi xếp hàng trả lời, có thời gian giải thích Kinh Thánh giữa các câu.

#### Rules
- 2–20 players.
- `startRoom`: skip ready check cho non-host (line 389) — host implicitly leader, dẫn dắt session.
- Host emit `QUESTION_START` cho câu 1.
- Mỗi player submit answer:
  - Server gọi `SequentialScoringService.recordAnswer` (latch count-down).
  - Broadcast `SEQUENTIAL_PROGRESS { answered, total }` mỗi lần — FE hiện "X/Y người đã trả lời".
  - **`isCorrect` bị HIDE trong `ANSWER_SUBMITTED`** (line 268): `broadcastIsCorrect = false` cho mode này. `pointsEarned` cũng broadcast là 0 — chống spoiler trong khi người khác đang nghĩ.
- Khi `answered == total` HOẶC timeout 10 phút (`LEADER_ADVANCE_MAX_WAIT_SECONDS = 600`) → `QUESTION_REVEALED` với `correctIndex`, `explanation`, per-player answers, leaderboard.
- Host bấm "Sang câu tiếp" → client emit `/app/room/{roomId}/advance` → `handleSequentialAdvance` (line 298) gates trên `mode == GROUP_LIVE_SEQUENTIAL` + `userId == hostId`, gọi `sequentialScoringService.leaderAdvance` → release latch → next iteration trong `runQuiz`.

#### Scoring (`SequentialScoringService.java`)
```
isCorrect == true  → 100
isCorrect == false → 0
```
Không speed bonus. Không Perfect bonus. Đơn giản nhất trong 5 modes.

#### Edge cases
- Player join sau khi room IN_PROGRESS: rejoin OK (xem 6.1) — câu hiện tại được rehydrate từ Redis.
- Host disconnect: R4 grace 60s → promote next host. Nhưng nếu đang chờ host advance → next host kế thừa quyền advance.
- Player không trả lời (idle) → counted vào `total` nhưng không count-down latch → blocking. Timeout 10 phút sẽ tự release.

---

## 4. Room Lifecycle (canonical R1–R5)

> Đây là **C7 Constraint** đã verify trong audit. Nguồn truth: `docs/audit/AUDIT_CONSTRAINTS.md` §C7.
> Mọi code path ảnh hưởng status transition PHẢI tuân theo đúng 5 rules dưới đây. Không thêm rule mới mà không update spec này.

### State diagram

```
   [createRoom]
       │
       ▼
   ┌───────┐                        ┌─────────────┐
   │ LOBBY │──── startRoom ────────▶│ IN_PROGRESS │
   └───┬───┘   (host, ≥2 players,   └──────┬──────┘
       │        all non-host ready)        │
       │                                   │ runQuiz finishes (GAME_COMPLETE)
       │ R1: empty lobby (currentPlayers=0)│ R5: stuck > 90 min (STUCK_GAME)
       │ R2: idle > 30 min (IDLE_TIMEOUT)  │ R5: all DC > 60s (ALL_DISCONNECTED)
       │ R4: host gone, no successor       │
       │     (HOST_GONE)                   │
       ▼                                   ▼
   [DELETE]                            ┌───────┐
                                       │ ENDED │
                                       └───┬───┘
                                           │ R3: > 24h
                                           ▼
                                       [DELETE]
```

> CANCELLED status đã **deprecated** — không có code path nào set. Cleanup nit trong BACKLOG.

### Quick-reference table

| ID | Trigger | Action | Notification | Code path |
|----|---------|--------|--------------|-----------|
| **R1** | Player cuối rời LOBBY (`currentPlayers == 0`) | Hard-delete ngay | `ROOM_ENDED { reason: "EMPTY_LOBBY" }` | `RoomService.leaveRoom:314-320` |
| **R2** | LOBBY không activity > `idle-timeout-minutes` (default 30) | Set ENDED → broadcast → eventually purge by R3 | `ROOM_ENDED { reason: "IDLE_TIMEOUT" }` | `RoomCleanupScheduler.sweepAbandonedLobbies` (10-min tick) + `RoomService.cleanupStaleLobbyForUser` (lazy on join) |
| **R3** | Room ENDED, `updatedAt` > `ended-retention-hours` (default 24) | Hard-delete (CASCADE → players, rounds, answers) | — (silent) | `RoomCleanupScheduler.purgeExpiredEndedRooms` |
| **R4** | Host STOMP disconnect > `reconnect-grace-seconds` (default 60) | Promote longest-tenured ACTIVE non-host. Nếu không có → end room. | `HOST_CHANGED { newHostId, newHostName }` HOẶC `ROOM_ENDED { reason: "HOST_GONE" }` | `RoomPresenceListener.handleGraceEndForRoom:147-160` |
| **R5** | (a) Tất cả player disconnect > grace; (b) IN_PROGRESS > 90 min không activity | Auto-end → ENDED | `ROOM_ENDED { reason: "ALL_DISCONNECTED" \| "STUCK_GAME" }` | (a) `RoomPresenceListener:163-171` (b) `RoomAbandonmentScheduler.sweepStuckGames` (5-min tick) |

### 4.1 R1 — Empty lobby DELETE

**Trigger:** `RoomService.leaveRoom(roomId, userId)` được gọi (REST `POST /api/rooms/{id}/leave` HOẶC WS `/leave`), sau khi player row delete + `syncPlayerCount`, `currentPlayers == 0`, status còn LOBBY.

**Action:** Hard-delete row ngay (KHÔNG đi qua ENDED). Lý do: empty LOBBY là test-room rác, không cần giữ 24h cho user xem stats (chẳng có gì để xem).

**Order quan trọng (`RoomService.java:314-320`):**
1. Broadcast `ROOM_ENDED { reason: "EMPTY_LOBBY" }` **TRƯỚC** delete — race condition: nếu có straggler vừa subscribe topic `/topic/room/{id}` (FE leave + navigate), họ vẫn nhận được frame để redirect.
2. `roomRepository.delete(room)` — CASCADE xoá `room_room_players` rows.

**Edge:** Nếu room IN_PROGRESS (game đang chạy) và player cuối rời, **không trigger R1**. Code (`leaveRoom:301`): `keepForRejoin = status == IN_PROGRESS` → mark LEFT thay vì delete row → `currentPlayers` không về 0 vì `countOccupiedByRoomId` không tính LEFT … nhưng nếu mọi người LEFT cả thì `countOccupiedPlayers == 0` → trigger R5 ALL_DISCONNECTED qua `RoomPresenceListener`.

### 4.2 R2 — Idle > 30 min DELETE

**Trigger:** Hai paths chạy song song để tránh single-point-of-failure:

**Path A — Lazy per-user (`RoomService.cleanupStaleLobbyForUser:176-195`):**
- Chạy mỗi lần user `joinRoom` (mới hoặc qua REST/WS).
- Iterate tất cả LOBBY rooms user đang là member: nếu `createdAt < now - idleTimeoutMinutes` → stale.
- Nếu user là host của room stale → set ENDED + broadcast `ROOM_ENDED { IDLE_TIMEOUT }`.
- Nếu user chỉ là member → chỉ remove user khỏi room (host quyết định gì với phần còn lại).

**Path B — Global scheduler (`RoomCleanupScheduler.sweepAbandonedLobbies:53-58`):**
- `@Scheduled(fixedRate = 10 phút)`.
- Gọi `roomService.endLobbyRoomsOlderThan(now - idleTimeoutMinutes)`.
- Repository query `findStaleLobbyRooms` filter status=LOBBY + createdAt < cutoff.
- Set status=ENDED + endedAt = now, save batch, broadcast `ROOM_ENDED { IDLE_TIMEOUT }` cho từng room **sau khi save** (để rollback không leave phantom toast).

**Config:** `biblequiz.room.idle-timeout-minutes` (default 30). Cả 2 paths đọc cùng property → đồng bộ (audit G8 đã fix; trước đó `STALE_LOBBY_HOURS=1` vs `ABANDONED_LOBBY_HOURS=2` lệch nhau).

**Activity definition (Bui canonical 2026-05-09):** R2 chỉ kiểm `room.createdAt` — KHÔNG reset trên join/leave/chat. Quyết định giữ behavior hiện tại để đơn giản + chống zombie room (player join-leave spam keep-alive). SPEC patch 5.4.0 cũ yêu cầu "Activity = join/leave/chat/ready/start" được override bởi quyết định này. Trade-off chấp nhận: lobby đang chat sôi nổi vẫn die ở 30 phút từ create — user phải Start hoặc tạo room mới.

### 4.3 R3 — ENDED retention 24h

**Trigger:** `RoomCleanupScheduler.purgeExpiredEndedRooms:65-70` — `@Scheduled(fixedRate = 10 phút)`.
- Cutoff = `now - endedRetentionHours` (default 24h).
- `roomRepository.deleteExpiredRooms(cutoff)` — JPQL DELETE WHERE status=ENDED AND updated_at < cutoff.
- CASCADE wired bởi V48 migration → `room_room_players`, `room_rounds`, `room_answers` đều theo.

**Lý do retention:** cho user xem lại stats (final leaderboard, accuracy) trong 24h sau khi game end. Audit ghi nhận ban đầu không có purge → 95+ ENDED rows tích tụ trong dev DB.

**Logging:** Log unconditional kể cả deleted = 0 (audit G10) — operator verify scheduler còn sống.

**Config:** `biblequiz.room.ended-retention-hours` (default 24).

### 4.4 R4 — Host disconnect 60s grace + promote

**Trigger:** `SessionDisconnectEvent` của Spring WebSocket (STOMP DISCONNECT frame HOẶC TCP close).

**Flow (`RoomPresenceListener.java:99-171`):**
1. `onDisconnect` (line 99): tra `PresenceTracker` → set rooms user đang subscribe.
2. Schedule task chạy sau `graceSeconds` (default 60) qua `taskScheduler.schedule`.
3. **Trong grace window**, nếu user mở session mới (refresh tab, reconnect) → `presenceTracker.userHasActiveSession(email)` returns true → `handleGraceEnd` (line 115-118) no-op.
4. Hết grace, user vẫn offline → `handleGraceEndForRoom(userId, roomId)` (line 137):
   a. Skip nếu room đã ENDED/CANCELLED.
   b. `markPlayerLeft(roomId, userId)` — set `playerStatus = LEFT` (LEFT cho IN_PROGRESS, hard-delete row cho LOBBY). **Quản trò mode skip:** nếu user là host và `hostPlaysGame=false`, host không có RoomPlayer row nên không cần markLeft.
   c. **Nếu user là host** (`wasHost` line 142):
      - `promoteNextHost(roomId)` → query `findActiveNonHostsByJoinedAtAsc` → first ACTIVE non-host (oldest joinedAt).
      - Có successor → `room.setHost(newHost)` + save + broadcast `HOST_CHANGED { newHostId, newHostName }`.
      - **Quản trò mode (`hostPlaysGame=false`) specifics:** new host được "lấy ra" khỏi RoomPlayer pool — set `playerStatus = LEFT` (đánh dấu họ không còn chơi nữa). Score đến hiện tại được giữ trong row LEFT nhưng không tính vào ranking cuối. New host từ giờ chỉ điều phối, không thể quay lại làm player. Edge case "không muốn làm host" → BACKLOG MP-9 (Sprint 5).
      - Không có successor → broadcast `ROOM_ENDED { HOST_GONE }` + `endRoom(roomId)`.
   d. **Nếu user không phải host** (line 163-171):
      - `countOccupiedPlayers(roomId) == 0` → broadcast `ROOM_ENDED { ALL_DISCONNECTED }` + `endRoom`. **Quản trò mode:** `countOccupiedPlayers` exclude host (host không là RoomPlayer trong mode này) → nếu tất cả non-host disconnect → end room dù host vẫn online.
      - Có người còn lại → no-op (room tiếp tục).

**Config:** `biblequiz.room.reconnect-grace-seconds` (default 60).

**Test hook:** `handleGraceEnd` package-private để test gọi thẳng không cần đợi scheduler thật.

### 4.5 R5 — All disconnect / Stuck IN_PROGRESS > 90 min

**Phần (a) — All disconnected:** ghép vào R4 flow (last non-host disconnect → check `countOccupiedPlayers`). Xem 4.4 step (d).

**Phần (b) — Stuck game (`RoomAbandonmentScheduler.java`):**
- `@Scheduled(fixedRate = 5 phút)` — `sweepStuckGames` (line 50).
- Cutoff = `now - 90 min` (`STUCK_THRESHOLD_MINUTES = 90L`, hardcoded constant — không từ config, vì đây là safety net cho JVM crash, không phải tunable per-environment).
- `roomRepository.findStuckInProgressRooms(cutoff)` → status=IN_PROGRESS AND startedAt < cutoff.
- Cho mỗi room: `roomService.endRoom` + broadcast `ROOM_ENDED { STUCK_GAME }`.
- Try/catch quanh từng row để 1 row hỏng không poison cả sweep.

**Tại sao 90 phút?** Worst case Speed Race = 50 câu × 60s = 50 phút. + 40 phút safety (host pause, mạng chậm) = 90 phút. Mọi game hợp lệ phải xong trong 90 phút.

**Trigger điều kiện stuck:** runQuiz exception (NullPointerException, DB timeout), JVM kill -9 mid-game, network partition giữa BE và DB. Không có recovery này → row IN_PROGRESS stuck mãi → mọi player trong đó vĩnh viễn bị block bởi rule "1 active room / user".

---

## 5. WebSocket Events (STOMP)

Spring WebSocket + STOMP. Native WS tại `/ws`, SockJS fallback tại `/ws-sockjs` (`WebSocketConfig.java:50-67`).

### 5.1 Connection

**Endpoint:** `/ws` (native) hoặc `/ws-sockjs` (SockJS fallback).

**Auth:** STOMP CONNECT frame với `Authorization: Bearer {accessToken}` header. `StompAuthChannelInterceptor` parse JWT, attach `Principal` (user email) vào session. `WebSocketConfig.configureClientInboundChannel` đảm bảo interceptor chạy **trước** `WebSocketRateLimitInterceptor`.

> **Note:** Trước đây có 2 hook (legacy `useWebSocket.ts` raw WS với JWT query-param + `useStomp.ts` STOMP với header). Legacy hook đã được delete 2026-05-13 (BL-15 DONE). Hiện chỉ còn `useStomp.ts` — token gửi qua **CONNECT header** (`useStomp.ts:56-58`), KHÔNG dùng query param.

**Rate limit:** `WebSocketRateLimitInterceptor` enforce per-user budget cho mọi SEND frame (chat, reaction, ready, answer). Vượt → frame bị drop silent.

**Subscribe topic:** `/topic/room/{roomId}` — broadcast của room đó. FE subscribe ngay sau CONNECT (`useStomp.ts:66-74`).

### 5.2 Client → Server (8 handlers)

Tất cả route qua `RoomWebSocketController` với prefix `/app/`:

| Destination | Handler | Payload | Mô tả |
|---|---|---|---|
| `/app/room/{roomId}/join` | `handlePlayerJoin` | `{}` (rỗng OK) | Sau khi REST join thành công, FE emit để re-broadcast PLAYER_JOINED + rehydrate current question (line 93-97). |
| `/app/room/{roomId}/leave` | `handlePlayerLeave` | `{}` | Notify rời. Server gọi `roomService.leaveRoom` rồi broadcast `PLAYER_LEFT`. |
| `/app/room/{roomId}/ready` | `handlePlayerReady` | `{}` | Toggle isReady. Broadcast `PLAYER_READY` HOẶC `PLAYER_UNREADY`. **Quản trò mode**: host không gọi handler này (host UI không có ready toggle). |
| `/app/room/{roomId}/start` | `handleStartQuiz` | `{}` | Chỉ broadcast `ROOM_STARTING` (countdown UI). Actual start qua REST `POST /api/rooms/{id}/start`. |
| `/app/room/{roomId}/answer` | `handleAnswerSubmission` | `{ questionIndex, answerIndex, reactionTimeMs }` | Submit đáp án. Server validate, score, lưu `RoomAnswer`, broadcast `ANSWER_SUBMITTED` + `SCORE_UPDATE`. **Quản trò mode**: server reject với `BadRequestException("Quản trò không trả lời câu hỏi")` nếu sender = host. |
| `/app/room/{roomId}/advance` | `handleSequentialAdvance` | `{}` | **Chỉ GROUP_LIVE_SEQUENTIAL** + chỉ host. Release latch để chuyển câu. |
| `/app/room/{roomId}/reaction` | `handleReaction` | `ReactionData { reaction: string }` | Emoji reaction. Rate limited 3/10s. |
| `/app/room/{roomId}/chat` | `handleChat` | `{ text: string }` | Free-form chat trong room. Trim 500 chars; empty drop. **MPC (2026-06-24)**: FE giữ lịch sử chat trong `roomChatStore` (Zustand keyed theo roomId) sống xuyên Lobby→Quiz→Results; màn kết quả (QuizEndScreen / SequentialFinalView) có chat drawer (ResultsChat) để tiếp tục thảo luận với nguyên cuộc trò chuyện trước đó. Chat KHÔNG khả dụng trong lúc đang chơi (chỉ Lobby + Results). **Persist (Redis)**: `handleChat` + `broadcastSystemChat` ghi vào Redis list `room:chat:{id}` (cap 200, TTL 12h, KHÔNG bị clearRoomState xóa); `GET /api/rooms/{id}/chat` replay history. FE hydrate store qua `useRoomChatHistory` khi mount → reload / late-join KHÔNG mất chat. |

> **Note (Sprint 4):** Host control actions (pause/resume/skip/broadcast/end-early) sử dụng REST endpoints chứ KHÔNG qua WS — xem section 8. Lý do: REST cho idempotency + audit log dễ hơn STOMP. WS broadcast-out các events `GAME_PAUSED` / `GAME_RESUMED` / `QUESTION_SKIPPED` / `HOST_BROADCAST` (xem 5.3).

### 5.3 Server → Client

Topic: `/topic/room/{roomId}`. Mọi message wrap bởi `WebSocketMessage.Message { type, data, timestamp }`.

#### Room events

| `type` | `data` shape | Trigger |
|---|---|---|
| `PLAYER_JOINED` | `PlayerJoinedData { playerId, username, avatarUrl, playerInfo }` | REST join OR WS /join. |
| `PLAYER_LEFT` | `{ playerId, username }` | WS /leave OR REST /leave. |
| `PLAYER_KICKED` | (TBD — enum exists, payload chưa thấy emit) | Host kick. |
| `PLAYER_READY` | `PlayerReadyData { playerId, username, isReady=true }` | Toggle on. |
| `PLAYER_UNREADY` | `PlayerReadyData { playerId, username, isReady=false }` | Toggle off. |
| `ROOM_STARTING` | `{ roomId, timestamp }` | Host bấm start (countdown UI cue). |
| `ROOM_ENDED` | `RoomEndedData { roomId, reason }` | R1/R2/R4/R5 + GAME_COMPLETE (bình thường) + Host end-early (Sprint 4). `reason` ∈ `EMPTY_LOBBY \| IDLE_TIMEOUT \| HOST_GONE \| ALL_DISCONNECTED \| STUCK_GAME \| GAME_COMPLETE \| HOST_ENDED_EARLY`. |
| `HOST_CHANGED` | `HostChangedData { roomId, newHostId, newHostName }` | R4 promote. FE update crown badge + start button. |
| `ROOM_STATE` | Full `RoomDetailsDTO` snapshot — **pure shared room state, no per-viewer fields** (the caller's `viewerUserId` is only returned by the REST GET, never by the broadcast). FE keep viewer identity in a separate state slot so a ROOM_STATE event cannot clear it. | Sau mọi mutation (join/leave/ready/team-switch/kick). FE replace state thay vì fetchRoom (Sprint 2 S2-3). |

#### Quiz events

| `type` | `data` shape | Trigger |
|---|---|---|
| `GAME_STARTING` | (defined nhưng emit ít gặp; FE nghe ROOM_STARTING là chủ yếu) | — |
| `QUESTION_START` | `QuestionStartData { questionIndex, totalQuestions, question, timeLimit, startedAtMs }` | Mỗi câu mới. `startedAtMs` = epoch ms server, FE compute remaining = `timeLimit - (now - startedAtMs)`. Cũng cache vào Redis qua `RoomStateService.setCurrentQuestion`. **Anti-spoiler (2026-05-23 fix `fb3ecfad`)**: `question` DTO **KHÔNG chứa `correctAnswer` / `correctIndex`** — Quản trò subscribe cùng `/topic/room/{id}` nên đáp án phải đợi `ROUND_END.correctIndex` / `QUESTION_REVEALED.correctIndex`. Server-side scoring dùng `Question` entity trực tiếp, không cần leak qua WS. **DTAG (2026-06-24)**: `question` DTO thêm `difficulty` (easy/medium/hard) để FE hiển thị badge độ khó mỗi câu (đồng nhất với Luyện Tập / Daily / Đấu Hạng). |
| `ANSWER_SUBMITTED` | `{ playerId, username, questionIndex, answered: true }` | Mỗi player submit. **Từ 2026-10-12 (PCV-2) mọi mode** chỉ báo "đã trả lời" — không còn `answerIndex`/`isCorrect`/`pointsEarned`/`reactionTimeMs` giữa vòng. |
| `ROUND_END` | `RoundEndData { correctIndex, leaderboard, explanation, reference: { book, chapter, verseStart, verseEnd }, answerCounts: int[], results: [{ playerId, answered, isCorrect, pointsEarned, streak }] }` | Hết timer câu + 1 giây ân hạn, sau khi vòng đã đóng (Speed Race / BR / TvT / SD). `RoundResultBuilder` dựng; nghỉ 5 giây (7 giây nếu có `explanation`) trước câu kế. |
| `QUESTION_END` | (alias-like; defined trong enum) | — |
| `QUIZ_END` | `{ roomId, timestamp, finalResults }` | Hết câu cuối cùng. Cũng clear Redis state. |

#### Host Control events (Sprint 4)

| `type` | `data` shape | Trigger |
|---|---|---|
| `GAME_PAUSED` | `{ roomId, pausedAt: epoch_ms, hostId }` | Host bấm Pause (REST `/host/pause`). Server freeze runQuiz qua `CountDownLatch`. FE: hiện overlay full-screen "Trận đấu đã tạm dừng" cho mọi player + nút Resume cho host. |
| `GAME_RESUMED` | `{ roomId, resumedAt: epoch_ms, hostId }` | Host bấm Resume (REST `/host/resume`). Latch countDown → runQuiz tiếp tục. FE: hide overlay + countdown 3-2-1 trước khi tiếp tục câu hỏi (nếu đang giữa câu). |
| `QUESTION_SKIPPED` | `{ roomId, questionIndex, hostId }` | Host bấm Skip (REST `/host/skip-question`). Server skip current question, không tính điểm cho ai. FE: toast "Câu này đã được bỏ qua" + advance to next. |
| `HOST_BROADCAST` | `HostBroadcastData { hostId, hostName, message: string, timestamp }` | Host gửi message (REST `/host/broadcast`). FE: hiện banner gold 5s phía trên màn hình (auto-dismiss). Max 200 ký tự. |

#### Mode-specific events

| Mode | `type` | `data` |
|---|---|---|
| Battle Royale | `PLAYER_ELIMINATED` | `{ userId, username, rank, activeRemaining }` |
| Battle Royale | `BATTLE_ROYALE_UPDATE` | `{ activeCount, totalCount }` |
| Team vs Team | `TEAM_ASSIGNMENT` | `{ players: [{userId, username, team}] }` |
| Team vs Team | `TEAM_SCORE_UPDATE` | `{ scoreA, scoreB }` |
| Team vs Team | `PERFECT_ROUND` | `{ teamAPerfect, teamBPerfect }` |
| Sudden Death | `MATCH_START` | `{ championId, championName, championStreak, challengerId, challengerName, queueRemaining }` |
| Sudden Death | `MATCH_END` | `{ winnerId, winnerName, winnerNewStreak, loserId, loserName }` |
| Sudden Death | `SD_QUEUE_UPDATE` | (defined, payload TBD) |
| Group Live Seq | `SEQUENTIAL_PROGRESS` | `{ answered, total }` — mỗi answer. |
| Group Live Seq | `QUESTION_REVEALED` | `{ correctIndex, explanation, answers: [{userId, username, answerIndex, isCorrect}], leaderboard }` — sau all-answered/timeout. |
| Group Live Seq | `NEXT_QUESTION` | (defined; trigger trong runQuiz advance loop) |

#### Score & social

| `type` | `data` |
|---|---|
| `SCORE_UPDATE` | `{ playerId, username, newScore, correctAnswers, totalAnswered }` — **không gửi theo từng câu trả lời nữa** (2026-10-12, PCV-2); điểm cập nhật qua `ROUND_END.leaderboard`. |
| `LEADERBOARD_UPDATE` | List<LeaderboardEntryDTO> |
| `REACTION` | `{ senderId, senderName, reaction }` |
| `CHALLENGE_RECEIVED` | (peer-challenge stub) |
| `CHAT_MESSAGE` | `{ sender, senderId, text }` |
| `ERROR` | `{ error, message }` |

---

## 6. Reconnect & Replay

### 6.1 Mid-game rejoin (commit `0e65bd9`)

**Use case:** Player A đang chơi, mạng rớt 30s, reconnect. Phải thấy đúng câu hiện tại với timer còn lại đúng — không đợi `QUESTION_START` của câu kế.

**Flow:**

1. **Browser detect disconnect** (WS `onWebSocketClose` → `useStomp` set `reconnecting=true`).
2. **STOMP auto-reconnect** sau 2s (`reconnectDelay: 2000`).
3. **CONNECT thành công** → re-subscribe `/topic/room/{roomId}` (line 66-74).
4. **FE phát WS `/app/room/{roomId}/join`** → `handlePlayerJoin` (line 70-102):
   - Re-broadcast `PLAYER_JOINED` cho cả room.
   - **Quan trọng (line 93-97):** `roomStateService.getCurrentQuestion(roomId).ifPresent(current -> ...)` — nếu có cached question trong Redis → re-emit `QUESTION_START` với cùng `startedAtMs` gốc. FE compute `remaining = timeLimit - (now - startedAtMs)` — đúng phần còn lại.
5. **Hoặc fallback REST**: `GET /api/rooms/{id}/current-question` (`RoomController:230-235`) — trả `QuestionStartData` hoặc 204. Dùng khi WS chưa kịp reconnect.

**State source:** Redis (key TTL 2 giờ) qua `RoomStateService`. Cleared khi `QUIZ_END`.

**Player row:** Status được restore từ `LEFT` → `ACTIVE` qua `joinRoom` REST handler (`RoomService.java:120-125`) — phục vụ user rời mid-game rồi quay lại qua `/multiplayer` page.

### 6.2 Disconnect handling per role

| Role | Disconnect | Trong grace 60s | Hết grace |
|---|---|---|---|
| Host (LOBBY) | STOMP close | Reconnect bình thường | R4: promote + HOST_CHANGED. Nếu LOBBY trống ACTIVE → R1 EMPTY_LOBBY. |
| Host (IN_PROGRESS) | STOMP close | Game pause? **Không** — game tiếp tục, host chỉ là người bấm start, không drive câu hỏi (trừ Sequential). | R4: promote next host. Nếu là Sequential → host kế tiếp kế thừa quyền `/advance`. |
| Player (LOBBY) | STOMP close | Reconnect bình thường | Mark LEFT (LOBBY hard-delete row). Nếu là last → R1. |
| Player (IN_PROGRESS) | STOMP close | Reconnect → restore ACTIVE | Mark LEFT. Game tiếp tục cho người còn lại. Nếu cuối cùng → R5 ALL_DISCONNECTED. |
| Player (Battle Royale, IN_PROGRESS) | STOMP close | Reconnect tiếp tục | Mark LEFT (TODO: SPEC §5.4.5 yêu cầu ELIMINATED — audit G9, BACKLOG). |
| Player (Sudden Death ACTIVE) | STOMP close | Reconnect đỡ trong câu nếu kịp | Mark LEFT → coi như sai → loser → next challenger từ queue. |

---

## 7. UI Screens

5 màn hình FE chính trong `apps/web/src/pages/`. Tất cả dùng `useStomp` hook để wire WS.

### 7.1 Multiplayer (`apps/web/src/pages/Multiplayer.tsx`) — redesigned 2026-05-15

Landing page chế độ multiplayer. Layout v2 (MLR + MPP patch):

1. **Top header** — kicker "CHẾ ĐỘ ĐA NGƯỜI CHƠI" gold uppercase + animated green live-dot + live count ("N phòng đang sống") + H1 "Phòng Chơi" + "Bộ câu hỏi" button on the right (mobile-hidden via `hidden md:flex`).
2. **JoinByCodeBar** — thin 56px gold-tinted bar above the hero: label + 6 inputs (36×36) + "Vào phòng" button. `apps/web/src/pages/multiplayer/JoinByCodeBar.tsx`.
3. **Hero row 50/50:**
   - LEFT `Tạo phòng` (gold) — "Bạn sẽ là Quản trò" chip + feature tags (2–20 người · 4 chế độ · Realtime) + "Tạo Phòng" CTA → `/room/create`.
   - RIGHT `SoloArenaEntryCard` (indigo `#6366f1` → `#818cf8`) — "MỚI" shimmer badge + "1 người chơi" kicker + descrip + 2 source tags + "Bắt đầu Solo" CTA → `/solo-arena` placeholder. Full Solo Arena tracked as BL-MP-SOLO.
4. **Mode showcase** — 4 cards using canonical palette from `apps/web/src/pages/create-room/modeMeta.ts` (speed=#38bdf8, battle=#ef4444, team=#a855f7, sudden=#fbbf24 AMBER + `target` icon). GROUP_LIVE_SEQUENTIAL excluded (chỉ tạo từ Group context, §3.5).
5. **Active rooms section** — filter chips (All + 4 modes + sort newest/filling) + 2 states:
   - **EmptyState** — friendly "Hãy là phòng đầu tiên hôm nay!" + 4 mode quick-create + **Solo Arena soft-link** ("Không có ai online? Thử Solo Arena").
   - **Populated** — grid 2-col `RoomCard` với mode icon box + status pill + host crown + avatar stack + meta footer + gold CTA ("Tham gia" / "Vào hàng đợi" / "Chọn đội").
6. **Sidebar widget** — `WeeklyMultiplayerStatsWidget` shown only on `/multiplayer*` routes (AppLayout conditional). Wired to `GET /api/me/multiplayer-stats?period=weekly` (SPEC_USER §27.2).

**Deferred (Phase 2):** "Tìm trận nhanh" matchmaking (BL-MP-QM), live activity ticker (Sprint 6), mini 2-team display per Team Room card.

### 7.2 CreateRoom (`pages/CreateRoom.tsx`)

**Sprint 4 hint banner** (top of form):
> 👑 **Bạn sẽ là Quản trò** — Quản trò điều phối trận đấu (bắt đầu, tạm dừng, bỏ câu, nhắn). Bạn không trả lời câu hỏi để đảm bảo công bằng cho người chơi.

Form tạo room. Fields:
- Room name (5–60 ký tự).
- Mode (5 options, icon).
- Max players (slider 2–20, mode-aware default). **Quản trò mode**: max+1 (host slot riêng, không tính vào max).
- Question count (slider 5–50).
- Time per question (slider 10–60s).
- Difficulty (Easy/Medium/Hard/Mixed).
- Book scope (single `<select>`: 9 nhóm chủ đề `ALL`/OT/NT/Ngũ Kinh/Lịch Sử/Thi Ca/Tiên Tri/Phúc Âm/Thư Tín + 66 sách riêng lẻ, optgroup OT/NT). Shared component `BookScopeOptions` dùng chung CreateRoom + QuickMatch (MBV-4).
- Question source (DATABASE / CUSTOM Question Set / Group Quiz Set).
- isPublic toggle.

Submit button text: "Tạo phòng & bắt đầu điều phối" (Quản trò mode) hoặc "Tạo phòng" (legacy mode).

Submit → `POST /api/rooms` (default `hostPlaysGame=false` Sprint 4+) → navigate `/room/:id/lobby`.

**Pre-fill support (Sprint 4):** Khi user click "🔄 Tổ chức trận mới" từ host end screen, navigate với `location.state.prefill = { mode, questionCount, timePerQuestion, difficulty, bookScope, questionSetId, invitePlayerIds }` → CreateRoom đọc và pre-fill form.

### 7.3 JoinRoom (`pages/JoinRoom.tsx`)

Single-input "Nhập mã 6 ký tự". Submit → `POST /api/rooms/join` → navigate `/room/:id/lobby`.

Error handling:
- `ALREADY_IN_ANOTHER_ROOM` (HTTP 422) → toast + button "Rời phòng kia trước".
- "Phòng không tồn tại" / "Phòng đã đầy" / "Phòng đã bắt đầu" / "Phòng đã kết thúc" → inline error.

### 7.4 RoomLobby (`pages/RoomLobby.tsx`) — mode-aware + role-aware

Lobby trước khi start. **5 mode variants × 2 role variants = 10 visual states**.

#### Role variants (Sprint 4)

| Role | Detection | Lobby UI difference |
|---|---|---|
| **Quản trò** (host + `hostPlaysGame=false`) | `room.hostId === currentUser.id && !room.hostPlaysGame` | Banner "👑 Bạn là Quản trò" + helper text. KHÔNG có Ready toggle. Player list with kick buttons. Bottom: "BẮT ĐẦU TRẬN ĐẤU" button (gold gradient), disabled khi <2 player ready. |
| **Player** | `room.hostId !== currentUser.id` | HostInfoCard riêng ("👑 Quản trò: {hostName} · Không chơi"). Player list highlight self with "(BẠN)". Bottom: Ready toggle + hint "Quản trò sẽ bắt đầu khi tất cả sẵn sàng". |
| **Legacy host** (host + `hostPlaysGame=true`) | `room.hostId === currentUser.id && room.hostPlaysGame` | Cả Ready toggle AND Start button (giống pre-Sprint 4). Cho rooms cũ. |

#### Mode quirks (vẫn giữ pre-Sprint 4)

| Mode | Lobby UI quirks |
|---|---|
| SPEED_RACE | Standard player list. |
| BATTLE_ROYALE | Same + warning "Trả lời sai bị loại". |
| TEAM_VS_TEAM | Player list **chia 2 cột Team A / Team B** + nút "Đổi đội". Quản trò mode: Start enable chỉ khi cả 2 đội ≥ 1 player (host KHÔNG tính). |
| SUDDEN_DEATH | Player list theo order joinedAt (= queue order khi start). |
| GROUP_LIVE_SEQUENTIAL | Bỏ Ready toggle (host implicit lead). Hiển thị badge "Chế độ Chơi cùng nhau — host dẫn dắt". Quản trò mode đặc biệt phù hợp với mode này. |

#### Common features

- WS subscribe `/topic/room/{id}` → handle PLAYER_*, ROOM_STATE, ROOM_STARTING, ROOM_ENDED, HOST_CHANGED.
- Chat panel (CHAT_MESSAGE) — Quản trò mode: host vẫn có thể chat (không chỉ broadcast).
- Kick button (host only, LOBBY only).
- Reaction tray (REACTION).
- ROOM_ENDED handler → toast theo `reason` + redirect `/multiplayer`.
- HOST_CHANGED handler → update crown + toast "X đã trở thành host mới". **Quản trò mode**: nếu user là người được promote → toast "Bạn đã trở thành Quản trò mới" + UI switch sang host view, score được giữ nhưng bị remove khỏi ranking.

### 7.5 RoomQuiz — split routes (Sprint 4)

In-game UI. **2 routes riêng biệt** dựa trên role:

| Route | Component | Audience |
|---|---|---|
| `/room/:id/quiz` | `RoomQuiz.tsx` (player view) | Players + legacy host (`hostPlaysGame=true`) |
| `/room/:id/host` | `RoomQuizHost.tsx` (spectator + controls) | Quản trò only (`hostPlaysGame=false`) |

`RoomLobby` on `GAME_STARTING` event navigates dựa vào:
```typescript
if (room.hostId === currentUser.id && !room.hostPlaysGame) {
  navigate(`/room/${roomId}/host`);
} else {
  navigate(`/room/${roomId}/quiz`);
}
```

#### 7.5.1 Player view (`pages/RoomQuiz.tsx`)

- **Header**: question N/M + timer (server-authoritative startedAtMs).
- **Question + 4 answer buttons** (color A/B/C/D theo C5).
- **Per-mode HUD**:
  - Speed Race: live leaderboard side panel (KHÔNG có host trong list).
  - Battle Royale: ACTIVE counter + "Bạn đang sống" / "Bạn đã bị loại" badge.
  - Team vs Team: 2 thanh điểm A vs B + perfect-round flash.
  - Sudden Death: 2 avatar champion vs challenger + queue list.
  - Group Live Sequential: progress "X/Y người đã trả lời" + reveal panel sau all-answered + nút "Sang câu tiếp" (host only — Quản trò mode).
- **Footer**: chat + reaction.
- **Quản trò mode bonus**: hint pinned bottom "👑 Quản trò {hostName} đang theo dõi".
- **HOST_BROADCAST handler**: hiện banner gold 5s phía trên màn hình khi nhận event.
- **GAME_PAUSED handler**: full-screen overlay "Quản trò đã tạm dừng — vui lòng đợi".
- **QUESTION_SKIPPED handler**: toast "Câu này đã được bỏ qua".

Mid-game disconnect → STOMP reconnect (xem 6.1) → fetch `/current-question` REST fallback nếu WS chậm.

QUIZ_END → navigate `/room/:id/results` (color code, share button, replay).

#### 7.5.2 Host spectator view (`pages/RoomQuizHost.tsx`) — Sprint 4

Layout hoàn toàn khác `RoomQuiz.tsx`. Match mockup `MOCKUP_HOST_ORGANIZER_FLOW.html` state ② host panel:

- **Header (compact)**: badge "👑 Quản trò" + "Câu N/M" + timer.
- **Question display section**: scriptureRef + question text (smaller font) + options grid 2×2 với **đáp án đúng highlighted ngay** (host được biết để dẫn dắt).
- **Live Answer Status section**: per-player rows hiển thị real-time:
  - "✓ ĐÚNG · 2.4s" (emerald) — khi `ANSWER_SUBMITTED { isCorrect: true }`
  - "✗ SAI · 3.1s" (red) — khi isCorrect: false
  - "Đang chọn..." với spinner (yellow) — khi chưa nhận event cho player đó
  - Counter "X / Y đã trả lời"
- **Live Scoreboard**: compact ranking real-time, KHÔNG có host trong list.
- **Bottom: HostControls panel (4 buttons grid)**:
  - ⏸️ **Tạm dừng** / ▶️ **Tiếp tục** (toggle) — POST `/host/pause` hoặc `/host/resume`
  - ⏭️ **Bỏ câu** — POST `/host/skip-question`, confirm modal
  - 💬 **Nhắn cả phòng** — modal input (max 200 ký tự) → POST `/host/broadcast`
  - 🛑 **Kết thúc sớm** — confirm modal → POST `/host/end-early`

QUIZ_END → navigate `/room/:id/results-host` (different end screen — xem 7.6).

### 7.6 Results screen — split (Sprint 4)

| Route | Component | Audience |
|---|---|---|
| `/room/:id/results` | `QuizEndPlayer` | Players |
| `/room/:id/results-host` | `QuizEndHost` | Quản trò |

#### Player end screen
- Personal hero card: "Hạng X!" + score + 3 stats (Đúng / Chính xác / Combo cao)
- Mini podium (top 3, không có host)
- Full rankings list (không có host)
- Actions: 📤 Chia sẻ kết quả (primary) · ⚔️ Phòng mới · 🏠 Trang chủ
- Hint bottom: "Đợi Quản trò tổ chức trận mới..."

#### Host end screen (Sprint 4)
- Title "🎉 Cảm ơn Quản trò!" thay vì "Vinh quang!"
- Winner card (player thắng + score + crown)
- Match stats grid 2×2: Tổng câu hỏi · Thời lượng · Người chơi · Tỷ lệ đúng TB
- Compact rankings list tất cả players
- Actions: 🔄 **Tổ chức trận mới với cùng nhóm** (primary, navigate CreateRoom với pre-fill) · 📊 Phân tích · 📤 Xuất CSV · 🚪 Đóng

---

## 8. API Endpoints

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/rooms` | Bearer | Create room. Body: `{ roomName, mode, maxPlayers, questionCount, timePerQuestion, difficulty, bookScope, isPublic, questionSource, questionSetId }`. Returns `{ success, room: RoomDetailsDTO, viewerUserId }`. |
| POST | `/api/rooms/quick-match` | Bearer | **Đấu Nhanh** — server-orchestrated quick match (no Quản trò). Body: `{ mode, bookScope, questionCount (5-20), timePerQuestion (10-60), maxPlayers? (2-100, default 10; clamp), source (DATABASE\|AI_GENERATED), language, chapterFrom?, chapterTo?, verseFrom?, verseTo? }`. Out-of-range count/time coerced to defaults (10/30). All 4 modes supported (SPEED_RACE / BATTLE_ROYALE / TEAM_VS_TEAM / SUDDEN_DEATH). Returns `{ success, room, viewerUserId, quickMatch: true, remainingToday }` (200) hoặc `{ success: false, error, message, ... }` (422) với `error = AI_SOURCE_DISABLED` khi `source = AI_GENERATED`. Soft-host: `hostPlaysGame=true`, Quản trò controls reject. **Từ 2026-10-12 (PCV-8):** chỉ dùng kho câu đã biên tập (`DATABASE`), không còn giới hạn 3 trận/ngày; `remainingToday` giữ cho client cũ. Số người tối thiểu/tối đa theo §2.5. |
| GET | `/api/rooms/public` | Optional | List public LOBBY+IN_PROGRESS rooms. Viewer-aware `joinable` field. Returns `{ success, rooms: PublicRoomDTO[] }`. |
| GET | `/api/rooms/{id}` | Optional | Room details. Returns `{ success, room: RoomDetailsDTO, viewerUserId }`. `viewerUserId` is the caller's id (null if unauthenticated) and lives **outside** the room DTO so the same DTO can be safely multicast as a `ROOM_STATE` WS event. The DTO itself carries `groupId` (nullable) but no per-viewer field. |
| POST | `/api/rooms/join` | Bearer | Join by code. Body: `{ roomCode }`. Returns `{ success, room, viewerUserId }`. 422 với code `ALREADY_IN_ANOTHER_ROOM` nếu user đang trong room khác. |
| POST | `/api/rooms/{id}/start` | Bearer (host) | Flip → IN_PROGRESS. Validate ≥2 players + (non-Sequential) all non-host ready. |
| POST | `/api/rooms/{id}/leave` | Bearer | Rời room. Mid-game → mark LEFT. LOBBY → delete row. |
| POST | `/api/rooms/{id}/switch-team` | Bearer | TEAM_VS_TEAM, LOBBY only. Toggle A↔B. |
| POST | `/api/rooms/{id}/kick` | Bearer (host) | Kick player. Body: `{ userId }`. LOBBY only. |
| GET | `/api/rooms/{id}/current-question` | Optional | Rehydrate câu hiện tại (từ Redis cache). 204 nếu không có. |
| GET | `/api/rooms/{id}/leaderboard` | Optional | Final/live leaderboard. **Quản trò mode**: response loại bỏ host khỏi rankings. |
| POST | `/api/rooms/{id}/host/pause` | Bearer (host) | **Sprint 4** — Quản trò mode only. Pause game qua `CountDownLatch` (max 5 phút). Broadcast `GAME_PAUSED`. |
| POST | `/api/rooms/{id}/host/resume` | Bearer (host) | **Sprint 4** — Resume paused game (countDown latch). Broadcast `GAME_RESUMED`. |
| POST | `/api/rooms/{id}/host/skip-question` | Bearer (host) | **Sprint 4** — Skip current question (no points awarded). Broadcast `QUESTION_SKIPPED`. Advance to next. |
| POST | `/api/rooms/{id}/host/broadcast` | Bearer (host) | **Sprint 4** — Body: `{ message: string }` (max 200 chars). Broadcast `HOST_BROADCAST` cho cả phòng. |
| POST | `/api/rooms/{id}/host/end-early` | Bearer (host) | **Sprint 4** — End game ngay với rankings hiện tại. Broadcast `ROOM_ENDED { reason: HOST_ENDED_EARLY }`. |
| WS | `/ws` (STOMP) | Bearer (CONNECT header) | WebSocket endpoint. Subscribe `/topic/room/{id}`. |
| WS | `/ws-sockjs` | Bearer | SockJS fallback (corporate proxy). |

---

## 9. Configuration keys

Tất cả đọc qua Spring `@Value`. Override qua `application.yml` HOẶC env var (Spring relaxed binding).

| Key | Default | Mô tả | File:line |
|---|---|---|---|
| `biblequiz.room.idle-timeout-minutes` | `30` | R2 — LOBBY idle threshold. Cả `RoomService.cleanupStaleLobbyForUser` (lazy) và `RoomCleanupScheduler.sweepAbandonedLobbies` (scheduler) đều đọc. | `RoomService.java:51`, `RoomCleanupScheduler.java:41` |
| `biblequiz.room.ended-retention-hours` | `24` | R3 — bao lâu giữ ENDED rooms trước khi hard-delete. | `RoomCleanupScheduler.java:44` |
| `biblequiz.room.reconnect-grace-seconds` | `60` | R4 — STOMP disconnect grace window trước khi mark LEFT / promote / end. | `RoomPresenceListener.java:61` |
| `biblequiz.room.host-pause-max-minutes` | `5` | **Sprint 4** — Maximum pause duration. Host bấm Pause → CountDownLatch await với timeout này. Hết timeout auto-resume để tránh stuck game forever. | `RoomQuizService.java` (pauseLatch await) |
| `RoomAbandonmentScheduler.STUCK_THRESHOLD_MINUTES` | `90` (hardcoded) | R5(b) — IN_PROGRESS stuck cutoff. **Không** từ config — safety net constant. | `RoomAbandonmentScheduler.java:36` |
| `cors.allowed-origins` | `http://localhost:5173` | WS endpoint `setAllowedOrigins`. | `WebSocketConfig.java:20` |

**Scheduler ticks (hardcoded fixedRate):**

| Scheduler | Tick | Method |
|---|---|---|
| `RoomCleanupScheduler.sweepAbandonedLobbies` | 10 phút | `@Scheduled(fixedRate = 10*60*1000)` |
| `RoomCleanupScheduler.purgeExpiredEndedRooms` | 10 phút | `@Scheduled(fixedRate = 10*60*1000)` |
| `RoomAbandonmentScheduler.sweepStuckGames` | 5 phút | `@Scheduled(fixedRate = 5*60*1000)` |

**Sequential mode hardcoded:**

| Constant | Value | File |
|---|---|---|
| `LEADER_ADVANCE_MAX_WAIT_SECONDS` | `600` (10 phút) | `SequentialScoringService.java:27` |

**Sudden Death hardcoded:**

| Constant | Value | File |
|---|---|---|
| `MAX_CONTINUES` | `3` | `SuddenDeathMatchService.java:26` |
| `CLOSE_THRESHOLD_MS` | `200` | `SuddenDeathMatchService.java:27` |

**Team vs Team hardcoded:**

| Constant | Value | File |
|---|---|---|
| `PERFECT_ROUND_BONUS` | `50` | `TeamScoringService.java:30` |

---

## 10. Known Issues

Cross-reference `BACKLOG.md` (root) — multiplayer-related items:

| ID | Item | Impact | Source |
|---|---|---|---|
| MP-1 | Drop `RoomStatus.CANCELLED` enum value (no setter exists, defensive checks waste lines) | Cosmetic / cleanup nit | Audit C7, `Room.java:93` |
| MP-2 | ~~BR absence-elimination~~ → **RESOLVED 2026-05-09**: 2-state semantics intentional. ELIMINATED = lost round, LEFT = disconnect/voluntary. NOT a bug. | — | `BattleRoyaleEngine.java:67`, `RoomService.java:311` |
| MP-3 | ~~R2 activity definition~~ → **RESOLVED 2026-05-09**: `createdAt`-only is canonical. Override SPEC patch 5.4.0 wording. | — | See §4.2 |
| MP-4 | Group leaderboard scoring scope (Q-A from SPEC_GROUP) — applies cross-spec | Solo + group scores currently mixed in group leaderboard. Bui locked Q2 = group-play-only (2026-05-09). | `ChurchGroupService.getLeaderboard:86-127` — see [BACKLOG.md](BACKLOG.md) BL-2 |
| MP-5 | UUID v7 (CLAUDE.md rule) — Room/RoomPlayer dùng `UUID.randomUUID()` (v4) | Defer (low ROI). | `RoomService.java:63` |
| MP-6 | Sequential mode: host "Skip idle player" button | UX — Sprint 3 work. | `SequentialScoringService.java:27` — see [BACKLOG.md](BACKLOG.md) BL-14 |
| MP-7 | ~~Deprecate `useWebSocket.ts` legacy hook~~ | DONE 2026-05-13 — file deleted, all callers already on `useStomp.ts`. | [BACKLOG.md](BACKLOG.md) BL-15 DONE |
| MP-8 | Migration retroactive cho legacy rooms (`hostPlaysGame=true` → `false`) | Rooms cũ vẫn có host chơi như player. Defer — let R3 retention cleanup tự nhiên trong 24h. | Sprint 4 decision |
| MP-9 | "Promote không muốn làm Quản trò" edge case | Sau R4 promote, new host có thể không muốn vai trò mới. Hiện tại không có "Trao quyền" action — defer Sprint 5. | Sprint 4 BACKLOG |
| MP-10 | TV Host Mode v1.5 — two-screen Kahoot pattern | Quản trò mode (Sprint 4) là precondition. v1.5 sẽ thêm route `/room/:id/tv` cho projector display. | Sprint 4 setup |

---

## 11. Cross-references

- **SPEC_USER_v3.1** — solo modes (Practice, Ranked, Daily Challenge, Variety), tier system, energy, lifelines. §5.4 cũ chuyển hoàn toàn sang spec này.
- **SPEC_GROUP_v1.2** — Church Groups, GroupQuizSet (Q-O), Q-A leaderboard scoping (locked group-play-only), Q-B sequential manual advance (locked), Q-N route `/live-rooms`. Group module spawn rooms với `groupQuizSetId`.
- **SPEC_ADMIN_v3.1** — admin config bảng `app_config`: rows `ROOM_IDLE_TIMEOUT_MIN`, `ROOM_ENDED_RETENTION_HOURS`, `RECONNECT_GRACE_SECONDS` cần exist (verify). Admin UI chưa wire 3 keys này (BACKLOG-ADMIN).
- **SPEC_ROADMAP** — TV Host Mode (v1.5), peer Challenge / Friend system (v2.5) — defer per C9.
- **BACKLOG.md** — track 7 multiplayer items ở section 10.
- **PLAYWRIGHT_CODE_CONVENTIONS.md** — E2E gate cho mọi multiplayer change. TC IDs cho rooms thuộc module W-M05 (cần verify trong `tests/e2e/INDEX.md`).
- **Audit sources:** `docs/audit/AUDIT_SUMMARY.md`, `docs/audit/AUDIT_CONSTRAINTS.md` §C7, `docs/MULTIPLAYER/MULTIPLAYER_AUDIT_REPORT.md`, `docs/MULTIPLAYER/ROOM_LIFECYCLE_AUDIT_REPORT.md`.
- **Sprint 4 mockup:** `docs/MULTIPLAYER/MOCKUP_HOST_ORGANIZER_FLOW.html` — 6 panels (3 states × 2 roles) approved 2026-05-09.

---

## Appendix A — Diff so với SPEC_USER_v3 §5.4 (cũ)

| Chủ đề | SPEC_USER_v3 §5.4 cũ | Spec này |
|---|---|---|
| Lifecycle | "State: DB entities + Redis (TTL 2 giờ)" — 1 dòng mơ hồ | R1–R5 đầy đủ với code path + config keys (section 4) |
| Game modes | 4 modes (Speed/BR/TvT/SD) | 5 modes (+ GROUP_LIVE_SEQUENTIAL — V39) |
| WS events | Liệt kê rời rạc trong §16.3 | Catalog đầy đủ section 5 (8 client handlers, ~20 server events) |
| Reconnect | Chưa document | Section 6 — Redis rehydrate + LEFT→ACTIVE restore |
| Question source | Chỉ đề cập `DATABASE` | DATABASE + CUSTOM (3 ID fields phân biệt sub-types) |
| CANCELLED status | Document như terminal state | Marked deprecated (cleanup BACKLOG MP-1) |
| **Host role (Sprint 4)** | Host luôn chơi như player | `hostPlaysGame` flag — default false (Quản trò mode), legacy true cho rooms cũ. Section 2.5 + 7.5 + 8 host endpoints. |
| **Host controls (Sprint 4)** | Chỉ có Start + Kick | Thêm 4 controls: Pause / Resume / Skip / Broadcast / End-early. WS events GAME_PAUSED, GAME_RESUMED, QUESTION_SKIPPED, HOST_BROADCAST. |
| **Routes (Sprint 4)** | Single `/room/:id/quiz` | Split: `/room/:id/quiz` (player) + `/room/:id/host` (Quản trò spectator + controls). Plus `/results` vs `/results-host`. |

## Appendix C — Migration history (Flyway, multiplayer-relevant)

| Version | Mô tả | Liên quan |
|---|---|---|
| V17 | `room_room_players` thêm `team` (A/B), `player_status`, `final_rank`, `winning_streak` | TEAM_VS_TEAM + SUDDEN_DEATH |
| V35–V37 | `group_quiz_sets` table + `questionIds` JSON | Q-O / Group Quiz Set |
| V39 | `Room.mode` enum thêm `GROUP_LIVE_SEQUENTIAL` + `Room.group_quiz_set_id` FK | Feature A "Chơi cùng nhau" |
| V45 | Drop `Room.players` `@ElementCollection` (denormalised state drift fix) | Source of truth = RoomPlayer rows |
| V48 | CASCADE wired cho rooms → room_room_players, room_rounds, room_answers | R3 retention purge |
| V49 | `Room.host_plays_game` BOOLEAN NOT NULL DEFAULT TRUE | **Sprint 4** — Host-Organizer separation. Existing rooms: TRUE (legacy). New rooms: FALSE (Quản trò mode). |

## Appendix D — Sample WebSocket frames

Frame envelope: `WebSocketMessage.Message { type, data, timestamp }`. JSON shapes dưới đây minh hoạ — không phải fixture chính thức (tham khảo `WebSocketMessage.java` cho field exact).

### `PLAYER_JOINED`
```json
{
  "type": "PLAYER_JOINED",
  "timestamp": "1715251200000",
  "data": {
    "playerId": "u_abc",
    "username": "Tài",
    "avatarUrl": "https://...",
    "playerInfo": {
      "id": "rp_xyz", "userId": "u_abc", "username": "Tài",
      "avatarUrl": "https://...", "isReady": false, "score": 0,
      "team": null, "playerStatus": "ACTIVE"
    }
  }
}
```

### `QUESTION_START`
```json
{
  "type": "QUESTION_START",
  "timestamp": "1715251260000",
  "data": {
    "questionIndex": 2,
    "totalQuestions": 10,
    "question": {
      "id": "q_001",
      "content": "Ai là vua đầu tiên của Israel?",
      "options": ["Saul", "David", "Solomon", "Samuel"],
      "difficulty": "medium",
      "language": "vi"
    },
    "timeLimit": 30,
    "startedAtMs": 1715251260000
  }
}
```

### `ANSWER_SUBMITTED` (Speed Race)
```json
{
  "type": "ANSWER_SUBMITTED",
  "data": {
    "playerId": "u_abc", "username": "Tài",
    "questionIndex": 2, "answerIndex": 0,
    "reactionTimeMs": 4200,
    "isCorrect": true, "pointsEarned": 143
  }
}
```

### `ANSWER_SUBMITTED` (Group Live Sequential — masked)
```json
{
  "type": "ANSWER_SUBMITTED",
  "data": {
    "playerId": "u_abc", "username": "Tài",
    "questionIndex": 2, "answerIndex": 0,
    "reactionTimeMs": 8200,
    "isCorrect": false,    // ALWAYS false in payload (anti-spoiler)
    "pointsEarned": 0      // ALWAYS 0
  }
}
```

### `ROOM_ENDED`
```json
{
  "type": "ROOM_ENDED",
  "data": {
    "roomId": "r_xyz",
    "reason": "IDLE_TIMEOUT"  // or EMPTY_LOBBY | HOST_GONE | ALL_DISCONNECTED | STUCK_GAME | GAME_COMPLETE
  }
}
```

### `HOST_CHANGED`
```json
{
  "type": "HOST_CHANGED",
  "data": {
    "roomId": "r_xyz",
    "newHostId": "u_def",
    "newHostName": "An"
  }
}
```

### `QUESTION_REVEALED` (Sequential)
```json
{
  "type": "QUESTION_REVEALED",
  "data": {
    "correctIndex": 0,
    "explanation": "1 Sa-mu-ên 9:17 — Đức Chúa Trời chỉ định Sau-lơ làm vua đầu tiên...",
    "answers": [
      {"userId": "u_abc", "username": "Tài", "answerIndex": 0, "isCorrect": true},
      {"userId": "u_def", "username": "An",  "answerIndex": 1, "isCorrect": false},
      {"userId": "u_ghi", "username": "Bình", "answerIndex": null, "isCorrect": false}
    ],
    "leaderboard": [ /* List<LeaderboardEntryDTO> */ ]
  }
}
```

### `MATCH_START` (Sudden Death)
```json
{
  "type": "MATCH_START",
  "data": {
    "championId": "u_abc", "championName": "Tài", "championStreak": 2,
    "challengerId": "u_def", "challengerName": "An",
    "queueRemaining": 3
  }
}
```

### `PERFECT_ROUND` (Team vs Team)
```json
{
  "type": "PERFECT_ROUND",
  "data": { "teamAPerfect": true, "teamBPerfect": false }
}
```

### `GAME_PAUSED` (Sprint 4 — Host control)
```json
{
  "type": "GAME_PAUSED",
  "data": {
    "roomId": "r_xyz",
    "pausedAt": 1715251800000,
    "hostId": "u_host"
  }
}
```

### `GAME_RESUMED` (Sprint 4 — Host control)
```json
{
  "type": "GAME_RESUMED",
  "data": {
    "roomId": "r_xyz",
    "resumedAt": 1715251830000,
    "hostId": "u_host"
  }
}
```

### `QUESTION_SKIPPED` (Sprint 4 — Host control)
```json
{
  "type": "QUESTION_SKIPPED",
  "data": {
    "roomId": "r_xyz",
    "questionIndex": 5,
    "hostId": "u_host"
  }
}
```

### `HOST_BROADCAST` (Sprint 4 — Host control)
```json
{
  "type": "HOST_BROADCAST",
  "data": {
    "hostId": "u_host",
    "hostName": "Bui",
    "message": "Câu này quan trọng, đọc kỹ Sáng Thế Ký 1 nhé!",
    "timestamp": 1715251890000
  }
}
```

## Appendix E — Test surface

E2E TC IDs cần exist trong `tests/e2e/INDEX.md` (verify khi viết Phase 2 deliverable):

| Module | Scope | TC range gợi ý |
|---|---|---|
| W-M05-Speed | Speed Race happy path: create → join 2 players → start → answer → results | W-M05-L1-001…010 (smoke), W-M05-L2-001…010 (happy) |
| W-M05-BR | Battle Royale: 4 players, eliminate per round, last wins | W-M05-BR-* |
| W-M05-TvT | Team vs Team: switch team, perfect round trigger | W-M05-TvT-* |
| W-M05-SD | Sudden Death: queue, champion streak, match end | W-M05-SD-* |
| W-M05-Seq | Group Live Sequential: host advance, mask isCorrect, reveal | W-M05-Seq-* |
| W-M05-Lifecycle | R1–R5: empty lobby delete, idle timeout, host promote, all-disconnect, stuck game | W-M05-Life-001…005 |
| **W-M05-Host** | **Sprint 4** — Quản trò flow: create room → host can't answer → start with min 2 players → 4 controls (pause/skip/broadcast/end) → host end screen | W-M05-Host-001…010 |

Backend test classes (verify exist trong `apps/api/src/test/`):

- `RoomServiceTest` — createRoom (default `hostPlaysGame=false`), joinRoom (idempotent + ALREADY_IN_ANOTHER_ROOM), leaveRoom (R1), startRoom validation (min 2 players excluding host).
- `RoomCleanupSchedulerTest` — sweepAbandonedLobbies, purgeExpiredEndedRooms.
- `RoomAbandonmentSchedulerTest` — sweepStuckGames at 90 min.
- `RoomPresenceListenerTest` — onDisconnect → handleGraceEnd, host promote (Quản trò mode + legacy mode), all-disconnect end.
- `BattleRoyaleEngineTest` — processRoundEnd (normal + all-wrong amnesty).
- `TeamScoringServiceTest` — perfect round bonus.
- `SuddenDeathMatchServiceTest` — initializeQueue, match flow, close-call tie-break.
- `SequentialScoringServiceTest` — beginRound, recordAnswer latch, leaderAdvance signal.
- **`RoomQuizServiceHostControlTest`** — **Sprint 4** — pauseGame + resumeGame (latch behavior), skipQuestion (no points), broadcastHostMessage (max 200 chars), endGameEarly. Verify host-only authorization.
- **`RoomServiceHostOrganizerTest`** — **Sprint 4** — createRoom với `hostPlaysGame=false` (host KHÔNG là RoomPlayer), startRoom validation (min 2 excluding host), submitAnswer reject from host, leaderboard exclude host.

## Appendix B — Resolved questions (2026-05-09)

| # | Question | Resolution |
|---|---|---|
| MP-2 | BR absence-elimination | **Accept 2-state semantics.** ELIMINATED ≠ LEFT. Disconnect = LEFT (rejoinable). Wrong-answer = ELIMINATED (final). |
| MP-3 | R2 activity definition | **Accept `createdAt`-only.** Simpler, prevents zombie rooms via chat keep-alive. Override SPEC patch 5.4.0. |
| MP-6 | Sequential idle player skip | **Add Sprint 3.** Host "Skip" button → BACKLOG BL-14. |
| MP-7 | useWebSocket vs useStomp | **DONE 2026-05-13.** `useWebSocket.ts` deleted, `useStomp.ts` sole hook. BL-15 closed. |
| QuestionSource enum (4 vs 2) | **2 values canonical** (DATABASE/CUSTOM). Sub-routing via `questionSetId`/`groupQuizSetId`/`customQuestionIds` fields. Spec §2.4 correct. |
| MP-5 | UUID v4 vs v7 | **Defer.** Low ROI; no bug. |

### Sprint 4 decisions (Host-Organizer separation)

| # | Question | Resolution |
|---|---|---|
| S4-Q1 | Apply scope: tất cả phòng hay chỉ Group Quiz Set? | **Tất cả phòng multiplayer** (Option A). Đơn giản, không loophole. Tournament organizer không thay đổi. |
| S4-Q2 | Min players bao nhiêu khi host không chơi? | **2 players** không tính host → tổng 3 người trong phòng. |
| S4-Q3 | Host UI mode: Spectator vs TV display? | **Spectator view** với 4 controls (Sprint 4). TV mode defer v1.5 (BACKLOG MP-10). |
| S4-Q4 | Host controls cần những gì? | **Pause + Skip + Broadcast + End early.** 4 buttons grid trong RoomQuizHost. Pause max 5 phút auto-resume. |
| S4-Q5 | Tournament organizer cũng không chơi? | **KHÔNG** — tournament giữ nguyên (organizer vẫn chơi). Sprint 4 chỉ apply Multiplayer Room. |
| S4-Q6 | Tên gọi tiếng Việt cho host? | **"Quản trò"** (game-show feel, phù hợp văn hóa Việt — như Đường Lên Đỉnh Olympia). EN: "Game Host". |
| S4-Q7 | Migration data cũ? | **Giữ nguyên rooms cũ** (`hostPlaysGame=true`). Không retroactive migrate — let R3 retention cleanup tự nhiên trong 24h. |
| S4-Q8 | Host được promote không muốn làm? | **Defer Sprint 5** (BACKLOG MP-9). |
| S4-Q9 | Host thấy đáp án ngay khi câu hiện ra? | **Có** — host cần biết để dẫn dắt buổi học. TV mode v1.5 sẽ có option ẩn nếu cần. |
| S4-Q10 | "Tổ chức trận mới" sau game end? | **Navigate CreateRoom với pre-fill** thay vì endpoint mới. Đơn giản, reuse existing flow. |
