# Project: BibleQuiz

## Nguyên tắc tuyệt đối
- Không bao giờ sửa code module khác khi đang làm 1 module
- Mỗi thay đổi phải có test pass trước khi commit
- Không tự ý thêm dependency mới — hỏi trước (xem `docs/dev/dependencies.md`)
- Ưu tiên đọc TODO.md trước khi làm bất cứ thứ gì
- LUÔN chia nhỏ task vào TODO.md TRƯỚC khi code — không tự xử lý 1 lần

## Think Before Code (BẮT BUỘC trước khi viết dòng code đầu tiên)

> KHÔNG BAO GIỜ viết code ngay sau khi nhận prompt. Phải qua đủ 5 bước.

```
BƯỚC 1 — ĐỌC HIỂU: TODO.md có task dở? Prompt thực sự muốn gì? Known Issues?
BƯỚC 2 — KHẢO SÁT CODE: Đọc file sẽ sửa, grep pattern, đọc test, check file "nhạy cảm".
         E2E Test Gate (xem `docs/dev/testing.md` §E2E Test Gate).
BƯỚC 3 — PLAN: Chia tasks < 100 LOC, ghi TODO.md, xác định test strategy.
BƯỚC 4 — VERIFY ASSUMPTIONS: API response shape? State shape? Function đã có chưa?
         Pattern khác codebase?
BƯỚC 5 — BẮT ĐẦU CODE (chỉ sau khi 1-4 xong)
```

### Rules cứng (vi phạm = phải revert)
1. KHÔNG tạo function/component/hook mới mà chưa grep codebase
2. KHÔNG đoán API response — đọc Controller + DTO hoặc test endpoint
3. KHÔNG viết > 50 LOC mà chưa đọc file đang sửa
4. KHÔNG bắt đầu code mà chưa ghi TODO.md
5. KHÔNG sửa file nào mà chưa đọc Known Issues bên dưới
6. KHÔNG tạo CSS/style mới — check `docs/dev/design-system.md`
7. KHÔNG viết business logic trong component — tách hooks/utils
8. Prompt mơ hồ → DỪNG, hỏi clarify, KHÔNG tự suy diễn rồi code

> Self-check sau mỗi 30 phút code → `docs/dev/workflows.md`.

## Spec hierarchy — Source of truth cho business rules

> KHÔNG đoán business behavior. Đọc spec tương ứng trước.

| Concern | Spec |
|---|---|
| Tier system, scoring, energy, lifeline, prestige, cosmetic, comeback, missions, journey, achievements, leaderboard, tournaments, mobile parity, i18n, sound/haptics, onboarding | `docs/spec/SPEC_USER_v3.1.md` |
| 5 multiplayer modes, R1–R5 room lifecycle, STOMP events, Quản trò mode | `docs/spec/SPEC_MULTIPLAYER.md` |
| Church Group (Q-A...Q-O locked), Quiz Set Professional Sprint 5 (multi-mode + mastery + workflow + folders), scheduled quizzes, group leaderboard | `docs/spec/SPEC_GROUP_v1.3.md` |
| Admin panel, AI generator, duplicate detection, audit log, configuration | `docs/spec/SPEC_ADMIN_v3.1.md` |
| Future / non-shipped (Friend, Premium, TV Host, Multi-leader, Sentry, Offline) | `docs/spec/SPEC_ROADMAP.md` |
| Code gaps vs canonical (BL-1...BL-N) | `docs/spec/BACKLOG.md` |

### Khi spec ↔ code lệch
1. Spec = canonical intent. Code phải catch up.
2. Mở `BACKLOG.md` tìm BL-N tương ứng. Không có → tạo issue mới.
3. KHÔNG sửa spec cho match code, trừ khi user confirm qua `DECISIONS.md`.

### Canonical constraints (C1–C9)

| # | Constraint |
|---|---|
| C1 | Tier names: Tân Tín Hữu / Người Tìm Kiếm / Môn Đồ / Hiền Triết / Tiên Tri / Sứ Đồ |
| C2 | Mode names VN: "Luyện Tập" + "Đấu Hạng" (KHÔNG "Leo Rank", "Thi Đấu Ranked") |
| C3 | 4 mùa Liturgical (Phục Sinh / Ngũ Tuần / Cảm Tạ / Giáng Sinh) + ×1.5 score |
| C4 | Bible BTTHĐ 2011, 66 books Protestant, 50/50 VN/EN |
| C5 | Answer colors: A=Coral / B=Sky / C=Gold / D=Sage |
| C6 | Group roles: Leader (gold) / Mod (blue) / Member |
| C7 | Room lifecycle 5 rules R1–R5; CANCELLED status deprecated |
| C8 | SPEC_GROUP locked decisions Q-A...Q-O preserved verbatim |
| C9 | Defer features chỉ trong ROADMAP, không trong current specs |

## Spec Update Rule (BẮT BUỘC)

> Specs PHẢI sync với code. Mỗi feature commit có 1 trong 3:

| Strategy | Khi dùng | Action |
|---|---|---|
| **(a) Spec update cùng PR** | Behavior change đã clear | Edit spec → commit `docs: update SPEC_X §Y` |
| **(b) BACKLOG BL-N entry** | Cần user review trước | Append BL-N vào `docs/spec/BACKLOG.md` |
| **(c) `[no-spec-impact]`** | Refactor nội bộ, no behavior change | Tag commit message |

### Quick check
"Behavior user-facing thay đổi?" → YES: grep specs cho file → spec đúng intent? OK : strategy (a)/(b). NO: (c).
Tool: `bash tools/spec-audit/audit.sh` (exit 0/1/2). Chi tiết: `docs/dev/workflows.md` §Spec Update Workflow.

### Anti-patterns
- ❌ "Spec sẽ update sau" — sẽ quên, drift; ❌ update spec để match code (ngược lại); ❌ bare filenames trong spec ref

## Product context

- **Target audience**: Tin Lành (Protestant) Việt Nam.
- **Bible canon**: 66 books Protestant. KHÔNG thêm 7 Deuterocanonical Công Giáo.
- **Bible version**: BTTHĐ 2011 canonical (C4). Code seed hiện vẫn BTT 1926 (public domain) — BL-1 track migration. Câu mới: BTT 1926 + comment `// TODO BL-1: BTTHĐ 2011`.
- **Tier naming**: religious (C1), KHÔNG light-themed (Tia Sáng/Vinh Quang).
- **Mode naming**: "Luyện Tập" + "Đấu Hạng" (C2 lock 2026-05-09).
- **Question seeding** workflow → `docs/dev/seeding.md`. Decision history → `DECISIONS.md`.

## Quy trình quản lý Task

> KHÔNG nhận prompt rồi chạy hết 1 lần. Chia nhỏ → tạo file `docs/todo/active/...md` → cập nhật TODO.md index → làm từng task → ✅ → kế.

### Cấu trúc task tracker
- **`TODO.md`** ở root = chỉ là **index** (table Active + pointer Archive). KHÔNG append nội dung task vào đây.
- **`docs/todo/active/YYYY-MM-DD-<slug>.md`** = 1 file/task work-unit. Detail nằm ở đây.
- **`docs/todo/archive/`** = file đã DONE/SUPERSEDED — di chuyển sang khi xong.
- Slug: ascii-fold tiếng Việt → kebab-case, < 70 ký tự (vd: `quiz-set-card-actions`, không phải `Quiz Set card: thêm action buttons`).

### 5 bước
```
1. Đọc TODO.md (index) — scan table Active xem task dở chưa xong?
   Nếu task dở liên quan → mở file detail trong docs/todo/active/.
2. Phân tích prompt mới → chia tasks (mỗi task = 1 commit, < 100 LOC).
3. TẠO file mới docs/todo/active/YYYY-MM-DD-<slug>.md theo format dưới,
   RỒI thêm 1 row vào table Active trong TODO.md (link tới file mới).
   Format file detail:
     # YYYY-MM-DD — <Title>
     > **Source**: ... · **Scope**: ...
     ### Tasks
     - <CODE>-N <Tên>
       - Status: [ ] TODO / [x] DONE / [!] BLOCKED · Files · Test
       - **Spec impact**: [ ] None [ ] SPEC_USER §X [ ] SPEC_ADMIN §X [ ] SPEC_GROUP §X [ ] SPEC_MULTIPLAYER §X [ ] BL-N
       - **Spec strategy**: [ ] (a) update inline [ ] (b) new BL-N [ ] (c) [no-spec-impact]
       - Checklist: impl · Tầng 1+2+3 pass · spec/BACKLOG updated · `audit.sh` no NEW broken · commit
4. Làm task đầu → test pass → ✅ status trong file detail → commit → task kế.
5. Hết tasks → full regression → move file sang docs/todo/archive/ → cập nhật TODO.md index (xoá row khỏi Active, thêm vào Archive list).
```

### Shortcut
Có thể dùng skill `/new-task <slug>` để tạo file template + cập nhật index 1 phát.

### Rules
- 1 task = 1 commit, < 100 LOC
- KHÔNG gộp / skip / làm song song
- Sau mỗi task: cập nhật status trong file detail NGAY (không đợi cuối)
- KHÔNG append `## YYYY-MM-DD — ...` section vào root TODO.md — hook sẽ block
- BLOCKED: ghi lý do trong file detail, chuyển task không phụ thuộc, quay lại

## Quy trình test bắt buộc (Regression Guard)

> Test đơn lẻ → code mới hoạt động. Full regression → KHÔNG phá code cũ.

### 3 tầng — KHÔNG bỏ tầng

| Tầng | Khi nào | Mục đích |
|---|---|---|
| 1 — Scope | Sau mỗi function/component | Code mới hoạt động đúng |
| 2 — Related | Sau hoàn thành 1 screen / sửa shared | Module liên quan không break |
| 3 — Full Regression | TRƯỚC mỗi commit (BẮT BUỘC) | KHÔNG regression toàn hệ thống |

Commands chi tiết: `docs/dev/testing.md`.

### Files "nhạy cảm" — sửa = chạy Tầng 3 ngay
`store/authStore.ts`, `api/client.ts`, `layouts/AppLayout.tsx`, `contexts/RequireAuth*.tsx`, `styles/global.css`, `hooks/useStomp.ts`, `main.tsx`; BE: `SecurityConfig`, `GlobalExceptionHandler`.

### Khi phát hiện regression
DỪNG, fix root cause → Tầng 3 lại → ALL PASS mới tiếp tục. Baseline: `apps/web/.test-baseline` + `apps/api/.test-baseline` — KHÔNG giảm.

### E2E Test Gate
Mọi feature/fix → check TC spec + Playwright code TRƯỚC khi code. Chi tiết: `docs/dev/testing.md` §E2E Test Gate.

## Quy ước code bắt buộc

### Backend
- Primary key UUID v7 (KHÔNG auto-increment)
- Mọi Entity: `id, createdAt, updatedAt`
- Mọi API lỗi: `{ code, message, requestId, details? }` — KHÔNG expose stack trace
- MapStruct cho Entity ↔ DTO
- Mọi DB change: Flyway script `db/migration/V{n}__{description}.sql`
- Mọi `/admin/**` endpoint: `@PreAuthorize("hasRole('ADMIN')")`
- `@Transactional` cho ghi nhiều bảng

### Frontend
- API call: TanStack Query (KHÔNG `useEffect + fetch`)
- Global state: Zustand (Exception: `ErrorContext` tree-scoped được phép)
- KHÔNG hardcode URL — `import.meta.env.VITE_API_URL`
- Form: loading + error handling
- Component max 300 LOC — vượt thì tách
- KHÔNG inline style — Tailwind hoặc global CSS utilities
- 3 states mỗi page: loading (Skeleton), error (msg + retry), success

> Architecture trees + design tokens + dependency list → `docs/dev/architecture.md`, `docs/dev/design-system.md`, `docs/dev/dependencies.md`.

## Definition of Done

- Tầng 3 pass (Vitest + Playwright + JUnit) — số test ≥ baseline (`.test-baseline` files)
- Không TypeScript/Java compile error; không `@SuppressWarnings` mới
- Flyway migration clean trên DB trống; chạy được local end-to-end
- UI match design tokens Lữ Khách (`docs/dev/design-system.md` + mockup canvas); loading/error/success states đều handled

## Commit Convention

```
feat | fix | refactor | test | style | sync | docs | chore
fix(BL-N): ...   # khi fix BACKLOG item
[no-spec-impact] # tag refactor không đổi behavior
```
Ví dụ: `feat: add TournamentMatch page`, `fix(BL-3): wire XP surge`, `sync: Home dashboard from Stitch v5`.

## KHÔNG được làm

### Code
- KHÔNG H2 in-memory cho test — Testcontainers MySQL
- KHÔNG map Entity → DTO thủ công — MapStruct
- KHÔNG business logic trong Controller — chỉ Service
- KHÔNG `System.out.println` — `@Slf4j` log
- KHÔNG xóa Flyway migration đã chạy — tạo migration mới
- KHÔNG hardcode màu/font ngoài design tokens; KHÔNG `page.waitForTimeout()` Playwright

### Workflow
- KHÔNG commit khi test fail; KHÔNG skip Tầng 3 trước commit (kể cả 1 dòng CSS)
- KHÔNG file > 300 LOC; KHÔNG gộp nhiều thay đổi vào 1 commit
- KHÔNG disable test cũ để test mới pass; KHÔNG tiếp tục feature khi đang regression
- KHÔNG nhận prompt rồi code 1 lần — chia thành file trong `docs/todo/active/` trước
- KHÔNG append section task `## YYYY-MM-DD — ...` vào root TODO.md — root chỉ là index, detail phải nằm trong `docs/todo/active/<slug>.md` (hook PreToolUse sẽ block)
- KHÔNG bỏ section Stitch HTML khi sync

### Specs
- KHÔNG tự ý sửa SPEC_*.md để match code (ngược lại — code phải catch up)
- KHÔNG document defer features (Friend/Premium/TV Host) như shipped
- KHÔNG dùng tier names cũ (Tia Sáng/Vinh Quang) — đã C1 lock religious
- KHÔNG dùng "Leo Rank"/"Thi Đấu Ranked" trong VN UI — C2 lock "Đấu Hạng"
- KHÔNG seed câu hỏi mới mà thiếu `explanation` + `scriptureRef` (BTTHĐ 2011)

## Known Issues & Fix-on-touch (cập nhật 2026-05-13)

> Khi task chạm file có known issue → **tạo task fix issue đó** TRƯỚC task chính.

### Critical — fix ngay khi chạm

_None hiện tại — `hooks/useWebSocket.ts` đã được xóa 2026-05-13 (BL-15 DONE)._

### Medium — fix khi có thời gian
- `pages/AuthCallback.tsx` dynamic `import()` → static; `pages/RoomQuiz.tsx` `location.state as any` → typed
- `pages/Achievements.tsx` `useState<any>({})` → typed; `components/ui/SearchableSelect.tsx` inline styles → Tailwind

### i18n Coverage (cập nhật 2026-05-09)

- Validator: `cd apps/web && npm run validate:i18n`
- Current: **648 hardcoded lines / 14 missing keys** (post-V39 multiplayer expansion)
- Accepted debt: `data/verses.ts`, PrivacyPolicy/TermsOfService, LandingPage marketing, AIQuestionGenerator DEFAULT_PROMPT, mock sample data
- Rule: PR mới không tăng count trừ accepted-debt

### BACKLOG (BL-N items vs canonical specs)

> Source: `docs/spec/BACKLOG.md`.

**Fix-on-touch:** task chạm file có BL-N → fix BL-N trước, commit `fix(BL-N): ...` riêng, cập nhật BACKLOG.md.

**Top-priority:**
- BL-1 BTTHĐ 2011 migration · BL-2 group leaderboard Q-A scope · BL-3 wire XP surge · BL-13 wire Comeback multiplier · BL-4 i18n "Đấu Hạng"/"Luyện Tập" · BL-5 Pentecost+Thanksgiving · BL-15 useWebSocket migrate

## References — `docs/dev/`

| File | Khi nào đọc |
|------|-------------|
| `docs/dev/setup.md` | Setup local environment, env vars, ports, 3 dev modes |
| `docs/dev/architecture.md` | Hiểu cấu trúc backend modules / frontend pages / mobile |
| `docs/dev/design-system.md` | Sửa UI, design tokens Lữ Khách, thành phần mẫu, ảnh |
| `docs/dev/testing.md` | Lệnh test chi tiết, E2E Test Gate full, viết test |
| `docs/dev/dependencies.md` | Add deps mới, check version |
| `docs/dev/workflows.md` | Feature workflow, Stitch sync workflow, PROMPT_*.md pattern |
| `docs/dev/conventions.md` | Error handling 3 layers, State management, localStorage keys |
| `docs/dev/seeding.md` | Question seed JSON workflow, Gemini translation |

> Khi sửa nội dung trong reference docs → KHÔNG add lại vào CLAUDE.md. CLAUDE.md chỉ giữ behavioral core.
