# Bug Report — Multiplayer Lobby (`/multiplayer`)

> **Source:** Visual review screenshot 2026-04-30
> **Reporter:** UX/Design audit
> **Page:** `apps/web/src/pages/Multiplayer.tsx` (web), `apps/mobile/src/screens/quiz/MultiplayerScreen.tsx` (mobile)
> **Implementation rate:** ~70% (functional nhưng card data shallow, có test data leak)
> **Severity overview:** 3× P0 (data quality), 6× P1 (UX), 6× P2 (improvements), 3× P3 (polish)

---

## 🎯 Tóm tắt Implementation Status

Multiplayer Lobby là entry point cho 4 game modes (Speed Race / Battle Royale / Team vs Team / Sudden Death) — quan trọng vì **multiplayer là differentiator** của BibleQuiz so với apps competitor.

**Implementation level:** ~70% — functional nhưng có data quality issues + card content shallow.

**Gì đã làm tốt:**
- Layout 3-section logical (Tham gia bằng mã / Đề xuất / Phòng đang chờ)
- 6 ô digit input format đẹp cho mã phòng
- CTA "+ Tạo Phòng" prominent gold filled, top-right
- Toolbar 3 icons (refresh / filter / search) cho power users
- "LIVE 4" badge đếm số phòng active
- Border-left gold trên card "Tham gia bằng mã" → focal point
- Featured event card "Đề xuất hôm nay"

**Cần fix:**
- 4 phòng có tên test data (WS Test Room / E2E Test Room) lộ ra production
- 4 phòng giống hệt nhau (cùng tên + mode + slot count) → confusing
- Cards thiếu Bible-specific context (sách / difficulty / topic)

**So sánh:**

| Trang | Implementation | Issues |
|---|---|---|
| Home | 80-85% | 17 |
| Leaderboard | ~70% | 14 |
| Ranked | ~75% | 16 |
| Quiz | ~75% | 13 |
| Practice | ~90% | 13 |
| Groups | (visual bugs) | 5 critical + roadmap |
| **Multiplayer** | **~70%** | **18** |

---

## 🔴 P0 — Critical (data quality / production safety)

### MP-P0-1: Test data lộ ra production lobby
**Severity:** Critical · **Type:** Data quality · **Effort:** 1-2h backend + 30min frontend

**Triệu chứng:**
4 phòng visible đều có tên test data:
- "WS Test Room" (×2) — WebSocket testing
- "E2E Test Room" (×2) — End-to-end testing

Đây là rooms tạo bởi **automated tests** đang chạy production environment, không phải user-facing rooms.

**Vấn đề:**
- User mới mở Multiplayer page thấy rooms với tên kỳ lạ → bad first impression
- Nếu user join "WS Test Room" → có thể trigger test code paths gây side effects
- Test rooms không cleanup → tích tụ lâu dài, lobby toàn test
- Bias metrics: "live rooms count" inflated bởi test data

**Investigation:**

```bash
# Verify backend có cơ chế filter test rooms chưa
grep -rn "isTest\|testRoom\|cleanup.*room" apps/api/src/main/java --include="*.java" | head -10

# Check active rooms in DB
psql -d biblequiz -c "SELECT id, name, host_id, status, created_at FROM rooms WHERE status IN ('lobby', 'in_progress') ORDER BY created_at DESC LIMIT 20;"

# Check if tests cleanup rooms after run
grep -rn "afterEach\|afterAll.*room\|deleteRoom" apps/api/src/test --include="*.java" | head -10
```

**Fix strategies:**

**Strategy 1 — Backend filter (recommend):**
```java
// RoomService.java
@Service
public class RoomService {
  private static final List<String> TEST_PREFIXES = List.of("WS Test", "E2E Test", "[TEST]");

  public List<Room> getPublicLobbies() {
    return roomRepository.findByStatus("lobby")
      .stream()
      .filter(room -> !isTestRoom(room))
      .filter(room -> isAllowedInPublicLobby(room))
      .toList();
  }

  private boolean isTestRoom(Room room) {
    return TEST_PREFIXES.stream().anyMatch(prefix -> room.getName().startsWith(prefix))
      || room.getMetadata().contains("isTest=true");
  }
}
```

**Strategy 2 — Database flag:**
- Add column `is_test_room boolean default false` to `rooms` table
- Test code sets `isTestRoom = true` khi create
- Public API filter `WHERE is_test_room = false`

**Strategy 3 — Auto-cleanup:**
```java
// Scheduled task — cleanup test rooms older than 1 hour
@Scheduled(fixedRate = 600000) // every 10 min
public void cleanupTestRooms() {
  Instant threshold = Instant.now().minus(1, ChronoUnit.HOURS);
  roomRepository.deleteByNameStartingWithAndCreatedAtBefore(
    List.of("WS Test", "E2E Test"),
    threshold
  );
}
```

**Strategy 4 — Frontend defensive (immediate quick fix):**
```tsx
// Multiplayer.tsx
const TEST_ROOM_PREFIXES = ['WS Test', 'E2E Test', '[TEST]'];

const visibleRooms = rooms.filter(room =>
  !TEST_ROOM_PREFIXES.some(prefix => room.name.startsWith(prefix))
);
```

**Recommend approach:** Combination — Strategy 4 immediate (frontend) + Strategy 1 long-term (backend) + Strategy 3 (cleanup scheduler).

**Files affected:**
- `apps/api/src/main/java/com/biblequiz/modules/room/RoomService.java`
- `apps/api/src/main/java/com/biblequiz/modules/room/RoomRepository.java`
- Migration SQL nếu thêm `is_test_room` column
- `apps/web/src/pages/Multiplayer.tsx` (defensive filter immediate)

**Acceptance:**
- [ ] Test rooms KHÔNG xuất hiện trong public lobby
- [ ] Test code setup proper test room markers
- [ ] Auto-cleanup scheduler run định kỳ
- [ ] Live count chỉ count user-facing rooms
- [ ] Backend tests verify filter logic
- [ ] Frontend defensive filter làm safety net
- [ ] Commit: `fix(rooms): filter test rooms from public lobby (MP-P0-1)`

---

### MP-P0-2: 4 phòng giống hệt nhau → user confused
**Severity:** Critical · **Type:** UX · **Effort:** 1h

**Triệu chứng:**
Visible 4 cards với:
- "WS Test Room" (×2) — cùng mode Speed Race, cùng 1/4
- "E2E Test Room" (×2) — cùng mode Speed Race, cùng 1/4

Nếu user thấy 4 phòng identical:
- Phòng nào "thật"?
- Mặc định join phòng nào?
- Có phải bug duplicate?

**Vấn đề kép:**
- Sau khi fix MP-P0-1 (filter test data), vấn đề "duplicate rooms" có thể vẫn tồn tại với real rooms
- Real rooms cùng tên + cùng mode (vd 2 leaders cùng tạo "Bài học Genesis Chương 1") cũng confusing

**Fix strategies:**

**Strategy 1 — Auto-disambiguate by host:**
```tsx
function RoomCard({ room }) {
  // Show host name nếu có rooms trùng tên trong lobby
  return (
    <div>
      <div className="font-medium">{room.name}</div>
      <div className="text-xs text-on-surface/55">
        bởi {room.host.name} · {formatRelativeTime(room.createdAt)}
      </div>
    </div>
  );
}
```

**Strategy 2 — Aggregate identical rooms:**
```tsx
function RoomsList({ rooms }) {
  const grouped = groupBy(rooms, room => `${room.name}::${room.mode}`);

  return Object.entries(grouped).map(([key, groupedRooms]) => {
    if (groupedRooms.length === 1) {
      return <RoomCard room={groupedRooms[0]} />;
    }
    return <RoomGroup key={key} rooms={groupedRooms} />;
  });
}

function RoomGroup({ rooms }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="room-group">
      <div onClick={() => setExpanded(!expanded)}>
        {rooms[0].name} ({rooms.length} phòng)
      </div>
      {expanded && rooms.map(room => <RoomCard key={room.id} room={room} compact />)}
    </div>
  );
}
```

**Strategy 3 — Auto-suffix:**
- Nếu 2 rooms cùng tên: append number "Bài học Genesis Chương 1 #2"
- Backend hoặc frontend auto-generate

**Recommend Strategy 1** — show host info + created time là cách standard (Discord, Slack, etc.). Khi 2 rooms trùng tên, host info đủ để phân biệt.

**Files affected:**
- `apps/web/src/components/multiplayer/RoomCard.tsx`
- `apps/web/src/types/room.ts` (đảm bảo có host info)

**Acceptance:**
- [ ] Mỗi room card có host name + created time
- [ ] User scan 2 rooms cùng tên có thể phân biệt
- [ ] Sau fix MP-P0-1, không còn duplicate test rooms
- [ ] Tests
- [ ] Commit: `fix(multiplayer): disambiguate rooms với host info (MP-P0-2)`

---

### MP-P0-3: Cards thiếu Bible-specific context
**Severity:** Critical · **Type:** Content · **Effort:** 1-2h

**Triệu chứng:**
Card hiện tại chỉ có:
- Tên phòng (không cho biết content)
- Mode "Speed Race"
- "1/4" players
- "ĐANG CHỜ" status

**Thiếu hoàn toàn Bible-specific info:**
- Sách nào? (Genesis / Matthew / All)
- Difficulty? (Easy / Medium / Hard / Mixed)
- Số câu? (10 / 15 / 20)
- Topic theme? (Creation / Miracles / Parables)
- Time limit? (15s / 20s / 30s/câu)

→ User chỉ thấy "phòng tên X mode Speed Race" → tap mò, không biết phòng đó chơi gì.

**Vấn đề:**
- BibleQuiz là **Bible learning app**, không phải generic trivia
- Bible scope là deciding factor lớn — user muốn ôn Genesis, không muốn random
- User skill khác nhau (Tân Tín Hữu vs Sứ Đồ) → cần biết difficulty
- Không có info → user join blindly, có thể quit nửa chừng

**Fix:**

**1. Backend trả đầy đủ room metadata:**
```java
// RoomDto.java
public record RoomDto(
  String id,
  String name,
  RoomMode mode,
  Host host,
  int currentPlayers,
  int maxPlayers,
  String status,
  // Bible-specific fields
  String bookScope,        // "Genesis" or "All Old Testament" or "Mixed"
  String difficulty,        // "Easy" | "Medium" | "Hard" | "Mixed"
  int questionCount,
  int timeLimitSeconds,
  String language,          // "vi" | "en"
  String themeName,         // optional
  Instant createdAt
) {}
```

**2. Frontend render rich card:**

```tsx
function RoomCard({ room }) {
  return (
    <div className="room-card">
      {/* Mode badge */}
      <ModeBadge mode={room.mode} />

      {/* Title + host */}
      <div className="room-title">{room.name}</div>
      <div className="room-host">bởi {room.host.name}</div>

      {/* Bible context row */}
      <div className="bible-context">
        <span>📖 {formatBookScope(room.bookScope)}</span>
        <DifficultyBadge difficulty={room.difficulty} />
      </div>

      {/* Game settings row */}
      <div className="game-settings">
        <span>📝 {room.questionCount} câu</span>
        <span>⏱ {room.timeLimitSeconds}s/câu</span>
      </div>

      {/* Slots visualization */}
      <SlotsVisualization current={room.currentPlayers} max={room.maxPlayers} />

      {/* Action */}
      <Button>Vào phòng →</Button>
    </div>
  );
}
```

**3. Format helpers:**
```ts
function formatBookScope(scope: string): string {
  const SCOPE_MAP = {
    'all': 'Tất cả 66 sách',
    'old_testament': 'Cựu Ước (39 sách)',
    'new_testament': 'Tân Ước (27 sách)',
    'gospels': '4 Phúc Âm',
    'epistles': '21 Thư Tín',
    // Specific book
    'Genesis': 'Sáng Thế Ký',
    'Matthew': 'Ma-thi-ơ',
    // ...
  };
  return SCOPE_MAP[scope] ?? scope;
}
```

**Files affected:**
- Backend: `RoomDto.java`, `RoomRepository.java`, `RoomController.java`
- Frontend: `apps/web/src/components/multiplayer/RoomCard.tsx`
- Types: `apps/web/src/types/room.ts`

**Acceptance:**
- [ ] Backend response trả đầy đủ Bible metadata fields
- [ ] Card hiển thị: book scope + difficulty + question count + time limit
- [ ] User scan card biết "phòng này chơi gì" trong 2 giây
- [ ] Fallback graceful nếu backend chưa có data
- [ ] Tests
- [ ] Commit: `feat(multiplayer): rich room cards với Bible context (MP-P0-3)`

---

## 🟠 P1 — UX Issues

### MP-P1-1: Cards thiếu host info + created time
**Severity:** High · **Type:** Content · **Effort:** 30min

**Đã được resolve một phần qua MP-P0-2 (disambiguation).** Tuy nhiên cần đảm bảo info luôn hiển thị, không chỉ khi có duplicate.

**Required info trong mỗi card:**
- 👤 Host avatar + name
- ⏱ Created time relative ("2 phút trước", "Vừa tạo")
- 🌐 Public/Private badge
- 🌐 Language flag (VI / EN)

**Acceptance:**
- [ ] Mọi room card hiển thị host + time
- [ ] Public/Private badge visible
- [ ] Language flag visible cho EN rooms
- [ ] Commit: `feat(multiplayer): show host info trên mọi room card`

---

### MP-P1-2: Icons trên cards inconsistent + không có meaning
**Severity:** Medium · **Type:** Visual · **Effort:** 30min

**Triệu chứng:**
4 cards có 4 icons khác nhau (📖 / 📚 / 🧠 / 🏆) — nhưng tất cả đều là "Speed Race" mode. **Icons không có meaning rõ.**

**Fix options:**

**Option A — Icons theo mode (recommend):**
```tsx
const MODE_ICONS = {
  'speed_race': '⚡',
  'battle_royale': '❤️',
  'team_vs_team': '👥',
  'sudden_death': '👑',
};
```

**Option B — Icons theo Bible scope:**
- 📜 Old Testament rooms
- ✝️ New Testament rooms
- 🌍 Mixed/All

**Option C — Bỏ icons, dùng colored mode badge to:**
```tsx
<div className="mode-badge bg-secondary text-on-secondary">
  ⚡ Speed Race
</div>
```

**Recommend Option A + Option C combined** — icon ngắn gọn cho mode + badge text rõ ràng.

**Acceptance:**
- [ ] 4 icons theo 4 modes nhất quán
- [ ] User scan biết mode ngay không cần đọc text
- [ ] Tests
- [ ] Commit: `fix(multiplayer): consistent mode icons (MP-P1-2)`

---

### MP-P1-3: Button "Vào Phòng" quá dominant
**Severity:** Medium · **Type:** Visual hierarchy · **Effort:** 30min

**Triệu chứng:**
Button "Vào Phòng" full-width, padding lớn → chiếm ~30% chiều cao card. **Quá dominant** — user attention bị kéo về CTA thay vì đọc info phòng.

**Fix:**

**Option A (recommend) — Cả card clickable, button làm sub-element:**
```tsx
<div
  className="room-card cursor-pointer hover:border-secondary/50"
  onClick={() => joinRoom(room.id)}
>
  {/* All info */}
  <div className="card-content">...</div>

  {/* Compact CTA arrow */}
  <div className="absolute bottom-3 right-3 text-secondary">
    Vào phòng →
  </div>
</div>
```

**Option B — Button compact:**
```tsx
<Button size="sm" variant="outline" className="w-auto">
  Vào phòng →
</Button>
```

**Option C — Icon-only button:**
```tsx
<button aria-label="Vào phòng">→</button>
```

**Recommend Option A** — cả card clickable là pattern chuẩn cho list items, button thừa.

**Files affected:**
- `apps/web/src/components/multiplayer/RoomCard.tsx`

**Acceptance:**
- [ ] Cả card clickable
- [ ] Button hoặc CTA arrow compact
- [ ] Hover state visible (border highlight)
- [ ] Tests
- [ ] Commit: `fix(multiplayer): card clickable + compact CTA (MP-P1-3)`

---

### MP-P1-4: Mode badge hơi mờ, position bottom
**Severity:** Low · **Type:** Visual · **Effort:** 15min

**Triệu chứng:**
Badge "🎮 Speed Race" có background subtle, position ở dưới — user phải scroll mắt xuống để biết mode.

**Fix:**
- Move mode badge **lên top card** (gần icon hoặc title)
- Background prominent hơn (gold subtle thay vì gray)
- Hoặc dùng colored badge theo mode:
  - Speed Race: gold
  - Battle Royale: red
  - Team vs Team: blue
  - Sudden Death: purple

**Acceptance:**
- [ ] Mode badge visible từ first scan
- [ ] Color theo mode để fast recognition
- [ ] Commit: `fix(multiplayer): mode badge prominent placement`

---

### MP-P1-5: "ĐANG CHỜ" text quá to + ALL CAPS noisy
**Severity:** Low · **Type:** Visual · **Effort:** 10min

**Triệu chứng:**
"ĐANG CHỜ" (2 từ) viết ALL CAPS, font-size không hợp với hierarchy.

**Fix:**

**Option A — Colored dot + lowercase:**
```tsx
<div className="status">
  <span className="dot bg-success" />
  <span>Đang chờ</span>
</div>
```

**Option B — Status icon:**
```tsx
🟢 Đang chờ    // waiting
🟡 Sắp đầy     // 3/4 or 4/4 with grace
🔴 Đang chơi   // in progress
⚫ Đã đầy      // full
```

**Recommend Option B** — status icon + text bình thường, semantic clear.

**Acceptance:**
- [ ] Status không ALL CAPS
- [ ] Color dot/icon đúng state
- [ ] Multiple states: chờ / sắp đầy / chơi / đầy
- [ ] Commit: `fix(multiplayer): status indicator polish`

---

### MP-P1-6: "1/4" player count thiếu context
**Severity:** Medium · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
"1/4" — user phải hiểu "1 player out of max 4 slots". Nhưng:
- Min players để bắt đầu là bao nhiêu?
- Còn cần bao nhiêu nữa để start?
- Có tự động start khi đủ?

**Fix options:**

**Option A — Slot avatars (recommend):**
```tsx
<div className="slots">
  <Avatar src={player1.avatar} />
  <EmptySlot />
  <EmptySlot />
  <EmptySlot />
</div>
<div className="text-xs text-on-surface/55">
  Cần thêm 3 người nữa để bắt đầu
</div>
```

**Option B — Progress bar:**
```tsx
<div className="player-count">
  <div>👤 1/4 người chơi</div>
  <ProgressBar value={1} max={4} />
  <div className="text-xs">Cần thêm 3 người</div>
</div>
```

**Option C — Just better text:**
```tsx
<div>👤 1/4 — Cần 3 người nữa</div>
```

**Recommend Option A** — slot avatars là pattern Kahoot/MMO, immediate visual + show ai đã join.

**Acceptance:**
- [ ] Player count visible với avatars hoặc progress
- [ ] Sub-text rõ "cần X người nữa"
- [ ] Min players để start (nếu khác max) cũng visible
- [ ] Tests
- [ ] Commit: `feat(multiplayer): slot visualization với avatars (MP-P1-6)`

---

## 🟡 P2 — Improvements

### MP-P2-1: "Đề xuất hôm nay" lạc lõng, chỉ 1 event
**Severity:** Medium · **Type:** Layout · **Effort:** 30min-1h

**Triệu chứng:**
Card "Giải đố Sáng Thế Ký cùng mục sư · 14:00 Chiều nay" nằm bên phải, ngang với "Tham gia bằng mã" — 2 cards độc lập về content nhưng cạnh nhau.

**Vấn đề:**
- Chỉ 1 đề xuất → trông cô đơn, không có thread
- Visual relationship với "Tham gia bằng mã" không rõ
- Click card → navigate đâu? Mở event detail? Auto-join phòng đặc biệt?

**Fix options:**

**Option A — Section riêng "Sự kiện đặc biệt":**
```
[Tham gia bằng mã]
   |
[Sự kiện đặc biệt section]
  - Card 1: Sáng Thế Ký với mục sư
  - Card 2: Giải đấu cuối tuần
  - Card 3: Tournament hội thánh
   |
[Phòng Đang Chờ]
```

**Option B — Featured row trong "Phòng Đang Chờ":**
```
[Phòng Đang Chờ]
  ⭐ Featured: Giải đố Sáng Thế Ký cùng mục sư (14:00)
  ─────────
  Regular rooms list...
```

**Option C — Bỏ nếu không có content thật:**
Defer feature đến khi có ≥ 3 events thật + content management system.

**Recommend Option A** nếu Bui có roadmap để curate events. Option C nếu chưa.

**Acceptance:**
- [ ] Decision documented trong DECISIONS.md
- [ ] Section logic rõ ràng (1 event hoặc multiple, không lưng chừng)
- [ ] Commit: `refactor(multiplayer): featured events section`

---

### MP-P2-2: 3 toolbar icons không có tooltip/label
**Severity:** Low · **Type:** Accessibility · **Effort:** 15min

**Triệu chứng:**
3 icons (refresh / filter / search) không có tooltip → user mới không biết function.

**Fix:**

```tsx
<button aria-label="Làm mới danh sách phòng" title="Làm mới">
  <RefreshIcon />
</button>
<button aria-label="Lọc phòng theo điều kiện" title="Lọc">
  <FilterIcon />
</button>
<button aria-label="Tìm phòng theo tên" title="Tìm">
  <SearchIcon />
</button>
```

**Acceptance:**
- [ ] Tooltip on hover (desktop)
- [ ] aria-label cho screen reader
- [ ] Long-press tooltip on mobile (nếu support)
- [ ] Commit: `a11y(multiplayer): tooltips for toolbar icons`

---

### MP-P2-3: Filter chưa có UI active filters
**Severity:** Medium · **Type:** UX · **Effort:** 1h

**Triệu chứng:**
Filter button có nhưng:
- Active filters không visible
- User filter "Speed Race only" → không có visual feedback "đang lọc"
- Không biết clear filters

**Fix:**

```tsx
function FilterChipsBar({ filters, onRemove }) {
  if (filters.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mb-3">
      {filters.map(filter => (
        <button
          key={filter.id}
          onClick={() => onRemove(filter.id)}
          className="bg-secondary/15 text-secondary px-3 py-1 rounded-full text-xs flex items-center gap-1"
        >
          <span>{filter.label}</span>
          <span>×</span>
        </button>
      ))}
      {filters.length > 1 && (
        <button onClick={() => onRemove('all')} className="text-xs text-on-surface/55">
          Xoá tất cả
        </button>
      )}
    </div>
  );
}
```

**Use case:**
```
Active filters: [× Speed Race] [× Easy] [× Genesis]    Xoá tất cả

[List of rooms matching filters]
```

**Acceptance:**
- [ ] Active filter chips visible
- [ ] Click chip → remove filter
- [ ] "Xoá tất cả" link nếu nhiều filters
- [ ] Filter button có badge số filters đang active
- [ ] Tests
- [ ] Commit: `feat(multiplayer): active filter chips UI`

---

### MP-P2-4: Sort options không thấy
**Severity:** Medium · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
Phòng đang chờ list không có sort options:
- Mới tạo trước?
- Sắp đầy trước?
- Easy → Hard?

Order hiện tại không clear.

**Fix:**

**Option A — Sort tabs:**
```tsx
<div className="sort-tabs">
  <button className="active">Mới nhất</button>
  <button>Sắp đầy</button>
  <button>Theo khó</button>
</div>
```

**Option B — Sort dropdown:**
```tsx
<select>
  <option>Mới nhất (default)</option>
  <option>Sắp đầy</option>
  <option>Difficulty: Dễ → Khó</option>
  <option>Difficulty: Khó → Dễ</option>
</select>
```

**Recommend Option A** — sort tabs visible, không cần hidden trong dropdown.

**API:**
```
GET /api/rooms?sort=newest|filling|difficulty_asc|difficulty_desc
```

**Acceptance:**
- [ ] Sort visible (tabs hoặc dropdown)
- [ ] Default "Mới nhất"
- [ ] Sort persist across page navigation
- [ ] Commit: `feat(multiplayer): sort options for rooms list`

---

### MP-P2-5: Empty state cho Phòng Đang Chờ
**Severity:** Medium · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
Nếu LIVE = 0 (không có phòng nào đang chờ), page hiện gì?

**Đề xuất empty state:**

```tsx
{rooms.length === 0 ? (
  <div className="text-center py-12">
    <div className="text-4xl mb-3">🌱</div>
    <div className="text-on-surface text-base font-medium">
      Chưa có phòng nào đang chờ
    </div>
    <div className="text-on-surface/55 text-sm mt-2 mb-6">
      Bạn là người tiên phong! Tạo phòng đầu tiên ngay.
    </div>
    <button className="bg-secondary text-on-secondary px-6 py-3 rounded-lg">
      + Tạo phòng đầu tiên
    </button>
  </div>
) : (
  <RoomsList rooms={rooms} />
)}
```

**Acceptance:**
- [ ] Empty state khi 0 rooms
- [ ] CTA "Tạo phòng đầu tiên" actionable
- [ ] Visual encouraging, không silent
- [ ] Commit: `feat(multiplayer): empty state với CTA`

---

### MP-P2-6: Pagination cho 4+ phòng
**Severity:** Medium · **Type:** Scalability · **Effort:** 1h

**Triệu chứng:**
Hiện 4 phòng. Khi scale lên 50+ rooms active:
- Pagination?
- Infinite scroll?
- "Load more" button?

**Recommend:**

**Option A — Infinite scroll** (good UX, popular):
```tsx
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(...);
useIntersectionObserver(loadMoreRef, () => fetchNextPage());
```

**Option B — "Load more" button:**
- Manual control
- Better cho slow connections

**Option C — Page numbers:**
- Standard nhưng feels old-school cho realtime data
- Khó vì rooms list update realtime → page positions shift

**Recommend Option A + B fallback** — infinite scroll default, button làm fallback nếu auto-load fail.

**Acceptance:**
- [ ] List load more rooms tự động khi scroll cuối
- [ ] Loading indicator
- [ ] "Load more" button làm fallback
- [ ] Test với 50+ mock rooms
- [ ] Commit: `feat(multiplayer): infinite scroll for rooms list`

---

## 🟢 P3 — Polish

### MP-P3-1: Card hover state visible?
**Severity:** Very Low · **Type:** Polish · **Effort:** 15min

**Đề xuất:**
```css
.room-card:hover {
  border-color: rgba(232, 168, 50, 0.4);
  background: rgba(50, 52, 64, 0.6);
  transform: translateY(-1px);
}
```

**Acceptance:**
- [ ] Hover feedback subtle
- [ ] Cursor pointer cho cả card

---

### MP-P3-2: "Tham gia bằng mã" có auto-format + validation?
**Severity:** Very Low · **Type:** UX · **Effort:** 1h

**Đề xuất:**
- Input "1 2 3 4 5 6" auto-format khi user nhập
- Validation realtime:
  - Code tồn tại?
  - Phòng đã đầy?
  - Phòng đã start (không join được)?

```tsx
function CodeInput({ onSubmit }) {
  const [code, setCode] = useState('');
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    if (code.length === 6) {
      // Validate
      validateRoomCode(code).then(result => setValidation(result));
    }
  }, [code]);

  return (
    <>
      <DigitInput value={code} onChange={setCode} length={6} />
      {validation?.error && <div className="text-error">{validation.error}</div>}
    </>
  );
}
```

**Acceptance:**
- [ ] Auto-focus next digit khi nhập
- [ ] Validation realtime (debounced)
- [ ] Error messages clear
- [ ] Commit: `feat(multiplayer): code input auto-format + validation`

---

### MP-P3-3: Live count "LIVE 4" có realtime update?
**Severity:** Very Low · **Type:** UX · **Effort:** 30min-1h

**Triệu chứng:**
Badge "LIVE 4" — static hay realtime via WebSocket?

**Đề xuất:**
- Subscribe to `/topic/rooms.public.count` via WebSocket
- Update badge realtime khi có phòng mới hoặc end

```tsx
useEffect(() => {
  const subscription = stompClient.subscribe('/topic/rooms.count', (message) => {
    setLiveCount(JSON.parse(message.body).count);
  });
  return () => subscription.unsubscribe();
}, []);
```

**Acceptance:**
- [ ] Live count realtime update
- [ ] Animation khi count thay đổi (optional)
- [ ] Fallback polling nếu WebSocket fail
- [ ] Commit: `feat(multiplayer): realtime live rooms count`

---

## 📊 Tổng kết

| Severity | Count | Total effort |
|---|---|---|
| 🔴 P0 (data quality) | 3 | 3-5h |
| 🟠 P1 (UX) | 6 | 2-3h |
| 🟡 P2 (improve) | 6 | 3-4.5h |
| 🟢 P3 (polish) | 3 | 1.5-2.5h |
| **Total** | **18** | **~10-15h** |

---

## 🎯 Đề xuất thứ tự thực hiện

### Sprint 1 — Critical data quality [3-5h]
1. **MP-P0-1** — Filter test data (backend + frontend defensive)
2. **MP-P0-2** — Disambiguate duplicate rooms (host info)
3. **MP-P0-3** — Rich Bible context trong cards (backend metadata + frontend render)

### Sprint 2 — Card UX improvements [2-3h]
4. **MP-P1-1** — Host info + created time (covered by MP-P0-2 + MP-P0-3 partially)
5. **MP-P1-2** — Consistent mode icons
6. **MP-P1-3** — Cả card clickable + compact CTA
7. **MP-P1-4** — Mode badge prominent
8. **MP-P1-5** — Status indicator polish
9. **MP-P1-6** — Slot avatars visualization

### Sprint 3 — Lobby workflow [3-4h]
10. **MP-P2-3** — Active filter chips UI
11. **MP-P2-4** — Sort options
12. **MP-P2-5** — Empty state cho 0 rooms
13. **MP-P2-6** — Infinite scroll pagination
14. **MP-P2-1** — "Đề xuất hôm nay" decision

### Sprint 4 — Polish [1.5-2.5h]
15. **MP-P2-2** — Tooltips for toolbar
16. **MP-P3-1** — Hover states
17. **MP-P3-2** — Code input auto-format
18. **MP-P3-3** — Realtime live count

---

## 🔗 Related artifacts

- `BUG_REPORT_HOME_POST_IMPL.md`
- `BUG_REPORT_LEADERBOARD.md`
- `BUG_REPORT_RANKED.md`
- `BUG_REPORT_QUIZ.md`
- `BUG_REPORT_PRACTICE.md`
- `BUG_REPORT_GROUPS.md` (chưa tạo, defer sang sprint riêng)
- `SPEC_USER_v3.md` mục 5.4 (Multiplayer Room) — 4 game modes detail
- `SPEC_USER_v3.md` mục 16 (WebSocket Events) — realtime contract

---

## 🤔 Questions cần Bui quyết

1. **Test data filtering strategy** (MP-P0-1): Backend filter (long-term) vs Frontend defensive (immediate)?
2. **Featured events** (MP-P2-1): Có roadmap curate events không, hay defer feature?
3. **Code input validation** (MP-P3-2): Realtime validation OK, hay đợi user submit?
4. **Sort default** (MP-P2-4): "Mới nhất" hay "Sắp đầy"?
5. **Sprint priority**: Critical data quality (Sprint 1) trước, hay UX improvements (Sprint 2) trước?

---

## 📝 Cross-references với các bug reports khác

Issues tương đồng giữa Multiplayer và các trang khác:

| Issue type | Multiplayer | Other reports |
|---|---|---|
| Empty state pattern | MP-P2-5 | HM-P3-3 (Leaderboard), Practice empty Phiên gần đây |
| Card hover state | MP-P3-1 | RK-P3-2 (recent matches), GR-P2-3 (mockup) |
| Rich card content | MP-P0-3 | HM-P1-1 (mode cards live data) |
| Filter chips UI | MP-P2-3 | LB-P2 (filter empty state) |
| Disambiguation | MP-P0-2 | (unique) |
| Realtime updates | MP-P3-3 | LB realtime leaderboard |
| Status indicators | MP-P1-5 | (unique) |

Có thể batch fix:
- **Empty states cross-pages** (MP-P2-5 + LB + Practice + Profile...)
- **Card hover states** (MP-P3-1 + RK-P3-2 + GR mockup)
- **Filter chip patterns** (MP-P2-3 + LB)

---

## 📊 So sánh với 5 reports trước

| Trang | Implementation | P0 issues | P1 issues | Total | Notable |
|---|---|---|---|---|---|
| Home | 80-85% | 1 | 5 | 17 | Live data thiếu |
| Leaderboard | ~70% | 4 | 5 | 14 | i18n bug |
| Ranked | ~75% | 3 | 6 | 16 | CTA position |
| Quiz | ~75% | 3 | 4 | 13 | Color mapping |
| Practice | ~90% | 1 | 5 | 13 | Best implemented |
| **Multiplayer** | **~70%** | **3** | **6** | **18** | **Test data leak** |

Multiplayer có **highest issue count (18)** trong 6 reports, chủ yếu vì:
- Bible context thiếu (P0-3) → impact lớn
- Test data leak (P0-1) → embarrassing in production
- Card content shallow → cần backend data shape change

---

*Generated 2026-04-30 — Living document, cập nhật khi có thêm finding.*
