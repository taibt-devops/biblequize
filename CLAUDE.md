# Project: BibleQuiz

## Nguyên tắc tuyệt đối
- Không bao giờ sửa code module khác khi đang làm 1 module
- Mỗi thay đổi phải có test pass trước khi commit
- Không tự ý thêm dependency mới — hỏi trước
- Ưu tiên đọc TODO.md trước khi làm bất cứ thứ gì
- LUÔN chia nhỏ task vào TODO.md TRƯỚC khi code — không tự xử lý 1 lần

## Think Before Code (BẮT BUỘC — đọc TRƯỚC KHI LÀM BẤT CỨ GÌ)

> **KHÔNG BAO GIỜ viết code ngay sau khi nhận prompt.**
> Phải qua đủ 5 bước phân tích bên dưới. Nếu skip bước nào → code sẽ sai.

### Quy trình bắt buộc TRƯỚC KHI viết dòng code đầu tiên

```
BƯỚC 1 — ĐỌC HIỂU (5 phút)
├── Đọc TODO.md → có task dở không?
├── Đọc prompt kỹ → user thực sự muốn gì? (không phải mình nghĩ họ muốn gì)
├── Đọc "Known Issues" trong CLAUDE.md → file sắp sửa có bug đã biết?
└── Output: 1-2 câu tóm tắt "Task này là: ..."

BƯỚC 2 — KHẢO SÁT CODE HIỆN TẠI (10 phút)
├── Đọc source file(s) sẽ sửa → hiểu logic hiện tại
├── Grep codebase tìm pattern tương tự → follow cách đã làm
├── Đọc test file hiện có → hiểu behavior mong đợi
├── Đọc component/hook mà file import → hiểu dependencies
├── Check file "nhạy cảm" → có ảnh hưởng global không?
├── **E2E Test Gate** → screen nào bị ảnh hưởng? TC spec đã có chưa? Playwright code đã có chưa?
│   (Xem chi tiết ở section "E2E Test Gate" bên dưới)
└── Output: Liệt kê "Files sẽ đọc/sửa: ..., Dependencies: ..., Impact: ..., E2E: TC có/chưa có"

BƯỚC 3 — PLAN (5 phút)
├── Chia thành tasks nhỏ (< 100 LOC mỗi task)
├── Xác định thứ tự: task nào trước, task nào phụ thuộc
├── Xác định test strategy: test gì, mock gì
├── Kiểm tra: có cần Stitch design không? Có cần đọc API contract không?
└── Output: Ghi tasks vào TODO.md

BƯỚC 4 — VERIFY ASSUMPTIONS (3 phút)
├── Mình có đang giả định response format API? → ĐỌC Controller/DTO thật
├── Mình có đang giả định state shape? → ĐỌC store/context thật
├── Mình có đang tạo function mới? → GREP xem đã có sẵn chưa
├── Mình có đang dùng pattern khác codebase? → DỪNG, follow existing pattern
└── Output: Confirm "Assumptions verified" hoặc "Cần check thêm: ..."

BƯỚC 5 — BẮT ĐẦU CODE (chỉ sau khi 4 bước trên xong)
└── Bắt đầu task đầu tiên trong TODO.md
```

### Ví dụ: ĐÚNG vs SAI

**Prompt:** "Thêm nút share vào Leaderboard"

❌ **SAI** (code ngay):
```
→ Nhận prompt → viết ShareButton component → thêm vào Leaderboard.tsx → commit
→ Kết quả: ShareButton trùng với ShareCard.tsx đã có, style không match design system
```

✅ **ĐÚNG** (think before code):
```
BƯỚC 1: Task = thêm share functionality vào Leaderboard page
BƯỚC 2: Đọc Leaderboard.tsx → Đọc ShareCard.tsx (đã có!) → Đọc ShareCard.test.tsx
        → Grep "share" trong codebase → phát hiện đã có ShareCard component + API
BƯỚC 3: Plan: 1 task = import ShareCard vào Leaderboard + thêm trigger button
BƯỚC 4: Đọc ShareCard props → cần type="session"|"daily"|"tier_up"
        → Leaderboard cần type mới "leaderboard"? → Check backend ShareCardController
BƯỚC 5: Code với full context → 15 LOC thay đổi thay vì 100 LOC component mới
```

### Rules cứng (vi phạm = phải revert)

1. **KHÔNG tạo function/component/hook mới** mà chưa grep codebase xem đã có chưa
2. **KHÔNG đoán API response format** — phải đọc Controller + DTO hoặc test endpoint thật
3. **KHÔNG viết code > 50 LOC** mà chưa đọc file đang sửa ít nhất 1 lần
4. **KHÔNG bắt đầu code** mà chưa ghi task vào TODO.md
5. **KHÔNG sửa file nào** mà chưa đọc "Known Issues" section ở trên
6. **KHÔNG tạo CSS/style mới** mà chưa check global.css và design tokens
7. **KHÔNG viết business logic trong component** — tách ra hooks/utils trước
8. **Khi prompt mơ hồ** → DỪNG, hỏi clarify, KHÔNG tự suy diễn rồi code

### Self-check sau mỗi 30 phút code

```
□ Mình đang code đúng task trong TODO.md? (hay bị đi lạc sang việc khác)
□ Mình có đang sửa file ngoài scope task? → DỪNG, ghi TODO riêng
□ Code mình vừa viết follow pattern existing? → Grep verify
□ Đã chạy Tầng 1 test chưa? → Nếu chưa: DỪNG, test ngay
□ LOC thay đổi hiện tại bao nhiêu? → Nếu > 100: DỪNG, commit partial, chia task
```

## Quy trình quản lý Task (BẮT BUỘC)

### Nguyên tắc cốt lõi
> **KHÔNG BAO GIỜ nhận prompt rồi chạy hết 1 lần.**
> Phải chia nhỏ → ghi TODO.md → làm từng task → check ✅ → task kế.

### Quy trình khi nhận prompt/task mới

```
1. ĐỌC TODO.md hiện tại → xem có task đang dở không
2. Nếu có task dở → hoàn thành nó trước (test pass, đánh ✅)
3. PHÂN TÍCH prompt mới → chia thành các task nhỏ (mỗi task 1 commit)
4. GHI tất cả tasks vào TODO.md theo format bên dưới
5. BẮT ĐẦU task đầu tiên
6. Xong task → chạy test → pass → đánh ✅ trong TODO.md → commit
7. Sang task tiếp theo → lặp lại bước 6
8. Hết tasks → chạy full regression → cập nhật TODO.md
```

### Format TODO.md

```markdown
## [Version/Phase] — [Tên nhóm task] [IN PROGRESS/DONE]

### Task [number]: [Tên task ngắn gọn]
- Status: [ ] TODO / [x] DONE / [!] BLOCKED
- File(s): [danh sách files sẽ sửa]
- Test: [test file tương ứng]
- Checklist:
  - [ ] Sub-step 1
  - [ ] Sub-step 2
  - [ ] Unit test pass
  - [ ] Commit: "[type]: [message]"
```

### Ví dụ cụ thể

Khi nhận prompt "Sync Home Dashboard từ Stitch + fix bugs + viết tests":

KHÔNG LÀM: đọc prompt → code hết 1 lần → commit 1 cục

LÀM ĐÚNG: chia thành TODO rồi làm từng task:
```markdown
## v2.5 — Sync Home Dashboard [IN PROGRESS]

### Task 1: Đọc Stitch design qua MCP + diff với code
- Status: [ ] TODO
- File(s): DESIGN_SYNC_AUDIT.md (output)
- Checklist:
  - [ ] MCP query Home screen
  - [ ] Liệt kê diff points
  - [ ] Ghi kết quả

### Task 2: Fix UNDEFINED energy bug
- Status: [ ] TODO
- File(s): GameModeGrid.tsx
- Test: GameModeGrid.test.tsx
- Checklist:
  - [ ] Xác định root cause (field name mismatch)
  - [ ] Fix code
  - [ ] Unit test cho null/undefined/loading cases
  - [ ] Vitest pass
  - [ ] Commit: "fix: energy UNDEFINED in GameModeGrid"

### Task 3: Cập nhật Welcome Bar theo Stitch
- Status: [ ] TODO
- File(s): Home.tsx
- Test: Home.test.tsx
- Checklist:
  - [ ] Compact layout (80px)
  - [ ] Greeting logic (sáng/chiều/tối)
  - [ ] Tier progress bar
  - [ ] Unit test
  - [ ] Vitest pass
  - [ ] Commit: "sync: Home welcome bar from Stitch"

### Task 4: Cập nhật Game Mode Grid theo Stitch
...

### Task 5: Cập nhật Leaderboard Preview
...

### Task 6: Fix warnings (useEffect → useQuery)
...

### Task 7: Full regression
- Status: [ ] TODO
- Checklist:
  - [ ] npx vitest run
  - [ ] npx playwright test
  - [ ] Backend tests
  - [ ] Số test >= baseline
```

### Rules
- Mỗi task phải ĐỦ NHỎ để commit riêng (1 task = 1 commit)
- KHÔNG gộp nhiều thay đổi vào 1 task
- KHÔNG skip task, làm theo thứ tự
- KHÔNG bắt đầu task kế nếu task hiện tại chưa ✅
- Sau mỗi task: cập nhật TODO.md NGAY (đánh ✅, ghi commit hash nếu cần)
- Nếu task bị BLOCKED: ghi lý do, chuyển sang task không phụ thuộc, quay lại sau

## Stack
- Backend: Spring Boot 3.3 (Java 17), port 8080
- Frontend: Vite 5 + React 18 + TypeScript 5.4, port 5173
- DB: MySQL 8.0 (Docker, port 3307)
- Cache: Redis 7 (Docker, port 6379)
- Unit Test: Vitest 4.1 (happy-dom) + @testing-library/react
- E2E Test: Playwright (đã setup: `apps/web/playwright.config.ts` + `tests/e2e/{smoke,happy-path,fixtures,helpers,pages}` + npm scripts `test:e2e`)
- Design: Stitch MCP (project ID `5341030797678838526`)

## Product context
- **Target audience**: Tin Lành (Protestant) chủ yếu; naming tier religious phù hợp cả Công Giáo nhưng nội dung Kinh Thánh là Protestant canon.
- **Bible canon**: 66 books (Protestant). KHÔNG thêm 7 Deuterocanonical của Công Giáo. Xem DECISIONS.md 2026-04-19 "Bible canon: Protestant only".
- **Tier naming**: religious (Tân Tín Hữu → Sứ Đồ), KHÔNG light-themed (Tia Sáng → Vinh Quang). Xem DECISIONS.md 2026-04-19 "Keep OLD religious tier naming".

## Question Seeding (source of truth)
- **Canonical location**: `apps/api/src/main/resources/seed/questions/*_quiz*.json`
- **Filename convention**:
  - `{book}_quiz.json` — Vietnamese version (default)
  - `{book}_quiz_en.json` — English version (generated via `scripts/translate_to_en.py`)
- **Format**: array of SeedQuestion objects (see `infrastructure/seed/question/SeedQuestion.java` for schema — key fields: `book, chapter, verseStart, verseEnd?, difficulty, type, content, options, correctAnswer, explanation, language, tags?`).
- **Seeder**: `QuestionSeeder` runs on `ApplicationReadyEvent`. Idempotent (deterministic UUIDs). Safe to restart app many times. VI + EN of same question coexist as 2 distinct DB rows (language is part of the ID hash).
- **Enable/disable**: `app.seeding.questions.enabled=true|false` in `application.yml` (default true; set `QUESTION_SEEDING_ENABLED=false` env var in prod after initial seed if desired).
- **Add new questions**: append to the relevant `{book}_quiz.json` file → restart app → only new entries insert.
- **Edit existing question**: edits create a NEW row (new deterministic UUID). Prefer "add new version" over "in-place edit". Admin UI handles in-place edits for DB-level corrections.
- **EN translation workflow**: `GEMINI_API_KEY=xxx python3 scripts/translate_to_en.py --all` — calls Gemini, writes `{book}_quiz_en.json` next to each VI file. Idempotent (skip existing unless `--force`).
- **SQL → JSON import**: `python3 scripts/sql_to_json.py` — one-shot converter for legacy `R__*_questions.sql` files. Skips books already in JSON (no overwrite).
- **Legacy Flyway seeds**: 26 `R__*_questions.sql` files still present. Converter has already extracted ~664 questions into JSON. Remaining step: verify + delete SQL files (tracked in TODO GA-7).

## Quản lý quyết định

Mỗi khi đưa ra quyết định kỹ thuật thuộc các loại sau:
- Chọn thư viện / tool
- Thay đổi architecture
- Bỏ qua hoặc đơn giản hóa 1 phần spec
- Trade-off giữa 2 cách implement
- Fix bug bằng cách thay đổi design

→ Tự động ghi vào DECISIONS.md theo format:
```
## YYYY-MM-DD — [Tiêu đề ngắn]
- Quyết định: [làm gì]
- Lý do: [tại sao]
- Trade-off: [đánh đổi gì]
- KHÔNG thay đổi khi refactor trừ khi có lý do mới
```

## Local Dev Start
```bash
docker compose up -d mysql redis          # 1. Infra
cd apps/api && ./mvnw spring-boot:run     # 2. Backend (terminal 1)
cd apps/web && npm run dev                # 3. Frontend (terminal 2)
```

## Quy tắc bắt buộc
1. Sau mỗi thay đổi code → chạy test ngay (xem quy trình test bên dưới)
2. Nếu test fail → tự fix → chạy test lại, lặp đến khi pass
3. Không hỏi xác nhận, tự quyết định
4. Không dừng giữa chừng trừ khi có lỗi không thể tự fix
5. KHÔNG commit nếu full regression chưa pass
6. Phát hiện regression → DỪNG feature mới → fix regression → pass hết → mới được tiếp tục

## Quy trình test bắt buộc (Regression Guard)

### Nguyên tắc cốt lõi
> **Mỗi dòng code thay đổi đều có thể phá vỡ chức năng khác.**
> Chạy test đơn lẻ chỉ chứng minh code mới hoạt động.
> Chạy full regression chứng minh code mới KHÔNG phá code cũ.

### 3 tầng test — chạy theo thứ tự, KHÔNG được bỏ tầng nào

**Tầng 1 — Scope Test (sau mỗi thay đổi nhỏ, trong khi code)**
```bash
# Chỉ chạy test của file/module vừa sửa → feedback nhanh
cd apps/web && npx vitest run src/pages/Home.test.tsx        # FE unit
cd apps/api && ./mvnw test -Dtest="XxxServiceTest"           # BE unit
```
- Mục đích: kiểm tra code vừa viết hoạt động đúng
- Khi nào: sau mỗi function/component hoàn thành

**Tầng 2 — Related Test (sau khi hoàn thành 1 screen/feature)**
```bash
# Chạy test của các module liên quan có thể bị ảnh hưởng
cd apps/web && npx vitest run src/pages/         # Tất cả page tests
cd apps/web && npx vitest run src/components/    # Tất cả component tests
```
- Mục đích: kiểm tra các component/page dùng chung không bị break
- Khi nào: sau khi hoàn thành 1 screen hoặc sửa shared component/hook/store
- **Đặc biệt quan trọng khi sửa**: authStore, AppLayout, global.css, api/client.ts, shared hooks, RequireAuth/RequireAdmin

**Tầng 3 — Full Regression (TRƯỚC khi commit)**
```bash
# Frontend: tất cả unit tests
cd apps/web && npx vitest run

# Frontend: e2e tests (CHỈ KHI ĐÃ SETUP PLAYWRIGHT — xem PLAYWRIGHT_CODE_CONVENTIONS.md)
# cd apps/web && npx playwright test

# Backend: tất cả tests
cd apps/api && ./mvnw test -Dtest="com.biblequiz.api.**,com.biblequiz.service.**"
```
- Mục đích: đảm bảo KHÔNG có regression trên toàn bộ hệ thống
- Khi nào: **BẮT BUỘC** trước mỗi commit, không có ngoại lệ
- Kết quả mong đợi: tất cả tests pass, số test >= con số trước khi bắt đầu task

### Quy trình khi phát hiện regression

```
1. DỪNG ngay — không code thêm feature mới
2. Xác định test nào fail → đọc error message
3. Xác định nguyên nhân:
   a. Code mới phá logic cũ → sửa code mới cho compatible
   b. Test cũ outdated (assertion sai do UI thay đổi hợp lệ) → cập nhật test
   c. Shared dependency bị thay đổi → review impact, sửa tất cả chỗ bị ảnh hưởng
4. Sửa xong → chạy lại Full Regression (Tầng 3)
5. ALL PASS → mới được tiếp tục feature hoặc commit
```

### Các file "nhạy cảm" — khi sửa PHẢI chạy Full Regression ngay
| File | Lý do | Impact |
|------|-------|--------|
| `store/authStore.ts` | Global auth state | Mọi page dùng RequireAuth |
| `api/client.ts` | Axios interceptor, token | Mọi API call |
| `api/tokenStore.ts` | Token storage | Auth flow |
| `layouts/AppLayout.tsx` | Sidebar, nav | Mọi page trong AppLayout |
| `contexts/RequireAuth.tsx` | Auth guard | Mọi protected route |
| `contexts/RequireAdmin.tsx` | Admin guard | Mọi admin page |
| `styles/global.css` | Design tokens, utilities | Mọi component dùng glass-card, gold-gradient |
| `hooks/useStomp.ts` | WebSocket | RoomLobby, RoomQuiz |
| `main.tsx` | Routing | Mọi navigation |
| Backend: `SecurityConfig` | JWT, CORS | Mọi API endpoint |
| Backend: `GlobalExceptionHandler` | Error format | Mọi error response |

### Checklist trước commit (tự kiểm)
```
□ Tầng 1 pass — test file vừa sửa
□ Tầng 2 pass — test các module liên quan
□ Tầng 3 pass — full regression (FE unit + BE) (+ FE e2e nếu đã setup Playwright)
□ Số test KHÔNG giảm so với trước task (hiện tại baseline: 733)
□ Không có test bị skip/disabled mà trước đó đang pass
□ Nếu sửa file "nhạy cảm" → đã chạy full regression ngay sau khi sửa
```

---

## Cấu trúc package backend

```
com.biblequiz/
├── api/                    # REST Controllers + DTOs + WebSocket controllers
│   ├── dto/                # Request/Response DTOs
│   └── websocket/          # STOMP WebSocket controllers
├── infrastructure/         # Cross-cutting concerns (không chứa business logic)
│   ├── audit/              # Audit logging
│   ├── exception/          # GlobalExceptionHandler, custom exceptions
│   ├── security/           # JWT, OAuth2, RateLimiting filters
│   └── service/            # CacheService, monitoring
├── modules/                # Business logic, tổ chức theo domain
│   ├── achievement/        # entity/ + repository/ + service/
│   ├── auth/               # entity/ + repository/ + service/
│   ├── daily/              # service/
│   ├── group/              # entity/ + repository/ + service/  (Church Group)
│   ├── quiz/               # entity/ + repository/ + service/  (Question, Session, Answer)
│   ├── ranked/             # model/ + service/  (ScoringService, RankTier)
│   ├── room/               # entity/ + repository/ + service/  (4 game mode engines)
│   ├── season/             # entity/ + repository/ + service/
│   ├── share/              # entity/ + repository/ + service/  (Share Card)
│   ├── tournament/         # entity/ + repository/ + service/
│   └── user/               # entity/ + repository/ + service/  (User, Streak)
└── shared/                 # Utilities dùng chung giữa nhiều modules
    ├── aspect/             # AOP (performance monitoring)
    └── converter/          # JPA converters (JsonListConverter)
```

### Quy ước đặt file mới
- **Controller mới** → `api/XxxController.java` (không bao giờ đặt trong modules/)
- **Entity/Repository/Service mới** → `modules/{domain}/entity|repository|service/`
- **Module mới** → tạo thư mục `modules/{tên}/` với sub-folders entity/, repository/, service/
- **Filter, Security, Exception** → `infrastructure/{concern}/`
- **Converter, Aspect dùng chung** → `shared/` (chỉ cho utilities không thuộc domain nào)

### Shared/ — dùng cho gì, KHÔNG dùng cho gì
- **DÙNG**: JPA converters, AOP aspects, utility classes dùng bởi >= 2 modules
- **KHÔNG DÙNG**: Business logic, domain entities, DTOs, service classes — những thứ này thuộc modules/

---

## Cấu trúc frontend

```
apps/web/src/
├── api/                    # Axios client (client.ts) + token store (tokenStore.ts)
├── components/             # Shared reusable components + tests
│   └── ui/                 # Button, Card, Input, SearchableSelect
├── contexts/               # ErrorContext, RequireAuth, RequireAdmin
├── hooks/                  # useWebSocket, useStomp, useRankedDataSync
├── layouts/                # AppLayout, AdminLayout
├── pages/                  # 26 user pages + admin/
│   └── admin/              # 7 admin sub-pages
├── store/                  # Zustand (authStore.ts)
├── styles/                 # global.css (Tailwind + Stitch tokens)
└── test/                   # setup.ts (Vitest global setup)

apps/web/tests/e2e/         # Playwright e2e tests (đã setup — xem PLAYWRIGHT_CODE_CONVENTIONS.md)
```

### Quy ước đặt file mới
- **Page mới** → `pages/XxxPage.tsx`, route thêm trong `main.tsx`
- **Component shared** → `components/XxxComponent.tsx` (hoặc `components/ui/` nếu primitive)
- **Hook mới** → `hooks/useXxx.ts`
- **Unit test** → cạnh source file: `pages/Xxx.test.tsx` hoặc `pages/__tests__/Xxx.test.tsx`
- **E2E test** → `tests/e2e/{smoke|happy-path}/xxx.spec.ts` (xem PLAYWRIGHT_CODE_CONVENTIONS.md)
- **Admin page** → `pages/admin/XxxPage.tsx`

---

## Design System — "The Sacred Modernist"

### Stitch MCP
- **Server**: `https://stitch.googleapis.com/mcp` (HTTP transport)
- **Project ID**: `5341030797678838526`
- **Auth**: Google OAuth2 Bearer token (refresh: `gcloud auth print-access-token`)
- **Config**: `.mcp.json` at project root

### Design Tokens (bắt buộc tuân theo)
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#11131e` | Page background |
| Surface Container | `#1d1f2a` | Cards, panels |
| Secondary (Gold) | `#e8a832` | CTA buttons, highlights, accents |
| Tertiary | `#e7c268` | Gold gradient end |
| On-Surface | `#e1e1f1` | Primary text |
| Error | Standard red | Error states |
| Font | Be Vietnam Pro | All text |
| Icons | Material Symbols Outlined | All icons |

### CSS Utilities (global.css — không tạo mới, dùng đúng class đã có)
```css
.glass-card     → Cards: rgba(50,52,64,0.6) + backdrop-blur(12px)
.glass-panel    → Panels: rgba(50,52,64,0.6) + backdrop-blur(20px)
.gold-gradient  → CTA buttons: linear-gradient(135deg, #e8a832, #e7c268)
.gold-glow      → Hover effect: box-shadow 0 0 20px rgba(232,168,50,0.2)
.streak-grid    → Heatmap: grid 20 columns
.timer-svg      → Quiz timer: rotate(-90deg)
```

### Quy tắc UI bắt buộc
- Mọi screen mới phải dùng design tokens ở trên — KHÔNG được hardcode màu khác
- Card → dùng `.glass-card`, KHÔNG tự tạo card style mới
- CTA button → dùng `.gold-gradient`, KHÔNG dùng màu khác cho primary action
- Background → luôn `#11131e`, KHÔNG dùng black hay dark gray khác
- Font → Be Vietnam Pro only, import từ Google Fonts
- Khi có Stitch design → phải match pixel-perfect
- Khi không có Stitch design (custom) → follow cùng design tokens + pattern từ screens đã sync
- Responsive: mobile-first, breakpoints theo Tailwind default (sm/md/lg/xl)

---

## Quy ước code bắt buộc

### Backend
- Primary key: UUID v7, không dùng auto-increment
- Mọi Entity phải có: id, createdAt, updatedAt
- Mọi API lỗi trả về: { code, message, requestId, details? }
- Không bao giờ expose stack trace trong response
- Dùng MapStruct để map Entity ↔ DTO
- Mọi thay đổi DB phải có Flyway script: db/migration/V{n}__{description}.sql
- Mọi endpoint /admin/** phải có @PreAuthorize("hasRole('ADMIN')")
- Dùng @Transactional cho mọi thao tác ghi nhiều bảng

### Frontend
- Mọi API call qua TanStack Query — không dùng useEffect + fetch thủ công
- State global dùng Zustand — không dùng Context cho global state
  - Exception: ErrorContext (tree-scoped, render toasts trong React tree) được phép giữ Context
  - Auth state đã migrate sang `src/store/authStore.ts` (Zustand)
- Không hardcode URL — dùng import.meta.env.VITE_API_URL
- Mọi form phải có loading state + error handling
- Component không quá 300 LOC — nếu vượt, tách thành sub-components
- Không inline style — dùng Tailwind classes hoặc global CSS utilities
- Mọi page phải handle 3 states: loading (skeleton), error (message + retry), success (content)

---

## Quy tắc test

### Nguyên tắc chung
- Mỗi screen/component PHẢI có unit test
- Mỗi user flow PHẢI có e2e test
- Test không được mock/hardcode config values khác config thật
- Khi test service cần config value → dùng giá trị giống application-dev.yml
- KHÔNG commit code mà test đang fail

### Unit Test (Vitest)
- **Config**: `vitest.config.ts` (happy-dom, setup `src/test/setup.ts`)
- **Pattern**: `src/**/*.{test,spec}.{ts,tsx}`
- **Đặt file**: cạnh source `Xxx.test.tsx` hoặc trong `__tests__/Xxx.test.tsx`
- **Minimum per screen**: 8 test cases (render, props, state, interactions, loading, error, responsive, accessibility)
- **Mock strategy**:
  - API calls → mock TanStack Query hooks hoặc MSW
  - Navigation → mock `useNavigate` from react-router-dom
  - Auth state → mock Zustand store
  - WebSocket → mock useStomp/useWebSocket hooks
  - KHÔNG mock implementation details — test behavior, not internals

### E2E Test (Playwright) — đã setup
- **Config**: `apps/web/playwright.config.ts` (Chromium, serial, baseURL localhost:5173)
- **testDir**: `./tests/e2e`
- **Đặt file**: `tests/e2e/{smoke|happy-path}/web-user/<screen-name>.spec.ts`
- **Conventions**: Đọc `PLAYWRIGHT_CODE_CONVENTIONS.md` (4-section anatomy, POM, selectors, auth patterns)
- **Minimum per screen**: 5 test cases (happy path, navigation in/out, key interactions, error state, mobile viewport)
- **Quy tắc**:
  - Cần app đang chạy (dev server + backend + DB)
  - Dùng `page.goto()` với relative path (baseURL đã set)
  - KHÔNG dùng `page.waitForTimeout()` — dùng `waitFor()` hoặc `expect().toBeVisible()`

### Backend Test
- Unit test không dùng H2 — dùng Testcontainers MySQL
- Integration test phải kiểm tra config file thật
- Mọi Service method PHẢI có unit test

---

## Lệnh test

```bash
# Backend
cd apps/api && ./mvnw test -Dtest="com.biblequiz.api.**"         # API tests
cd apps/api && ./mvnw test -Dtest="com.biblequiz.service.**"     # Service tests
cd apps/api && ./mvnw test -Dtest="com.biblequiz.api.**,com.biblequiz.service.**"  # All backend

# Frontend unit
cd apps/web && npm test                     # Vitest watch mode
cd apps/web && npx vitest run               # Vitest single run (CI)
cd apps/web && npx vitest run src/pages/    # Vitest chỉ pages

# E2E (đã setup: apps/web/playwright.config.ts + tests/e2e/{smoke,happy-path,fixtures,helpers,pages})
cd apps/web && npm run test:e2e                                # All e2e
cd apps/web && npx playwright test tests/e2e/smoke/            # Chỉ smoke
cd apps/web && npm run test:e2e:headed                         # Có browser UI
cd apps/web && npm run test:e2e:report                         # Xem HTML report
```

---

## Commit Convention

```
feat: <mô tả>       # Tính năng mới
fix: <mô tả>        # Sửa bug
refactor: <mô tả>   # Refactor không thay đổi behavior
test: <mô tả>       # Thêm/sửa test
style: <mô tả>      # UI/CSS changes (không thay đổi logic)
sync: <mô tả>       # Sync design từ Stitch
docs: <mô tả>       # Documentation
chore: <mô tả>      # Build, config, tooling
```

Ví dụ:
- `sync: Home dashboard from Stitch v5 + tests`
- `feat: add TournamentMatch page with 1v1 gameplay`
- `fix: quiz timer not resetting between questions`
- `test: add e2e tests for login flow`

---

## Approved Dependencies (không cần hỏi)

### Frontend — đã có, thoải mái dùng
- react, react-dom, react-router-dom
- @tanstack/react-query
- zustand
- axios
- @stomp/stompjs
- tailwindcss
- vitest, @testing-library/react, @testing-library/user-event
- @playwright/test

### Frontend — CẦN HỎI trước khi thêm
- Bất kỳ UI library mới (shadcn, radix, headless-ui, ...)
- Animation library (framer-motion, react-spring, ...)
- Form library (react-hook-form, formik, ...)
- Chart library mới (hiện dùng inline SVG)
- Bất kỳ dependency nào chưa có trong package.json

### Backend — đã có, thoải mái dùng
- Spring Boot starters (web, data-jpa, security, websocket, validation, cache)
- Flyway, JJWT, springdoc-openapi, spring-dotenv, MapStruct
- Testcontainers, JUnit 5, Mockito

---

## E2E Test Gate (BẮT BUỘC cho mọi feature/fix)

> **Mọi thay đổi code PHẢI kiểm tra E2E coverage trước khi code.**
> Không có TC spec + Playwright code = không được ship.

### Quy trình kiểm tra E2E trước khi code

```
BƯỚC 1 — XÁC ĐỊNH SCREEN/FLOW bị ảnh hưởng
├── Feature mới: screen nào sẽ thêm/thay đổi?
├── Fix bug: bug ở screen nào? flow nào bị ảnh hưởng?
└── Output: danh sách routes/screens bị ảnh hưởng

BƯỚC 2 — KIỂM TRA TC SPEC ĐÃ CÓ CHƯA
├── Đọc tests/e2e/INDEX.md → module nào cover screen đó?
├── Đọc TC spec file tương ứng trong tests/e2e/playwright/specs/
│   ├── Smoke: tests/e2e/playwright/specs/smoke/W-M{xx}-*.md
│   └── Happy path: tests/e2e/playwright/specs/happy-path/W-M{xx}-*.md
├── Tìm TC ID cover đúng scenario đang fix/thêm
└── Output: "TC đã có: W-M04-L2-003" hoặc "CHƯA CÓ TC cho scenario này"

BƯỚC 3 — KIỂM TRA PLAYWRIGHT CODE ĐÃ CÓ CHƯA
├── Tìm file .spec.ts tương ứng:
│   ├── tests/e2e/smoke/web-user/W-M{xx}-*.spec.ts
│   └── tests/e2e/happy-path/web-user/W-M{xx}-*.spec.ts
├── Grep TC ID trong file: "W-M04-L2-003"
└── Output: "Code đã có" hoặc "CHƯA CÓ code Playwright"

BƯỚC 4 — HÀNH ĐỘNG THEO KẾT QUẢ
```

| TC Spec | Playwright Code | Hành động |
|---------|----------------|-----------|
| ✅ Có | ✅ Có | Code feature/fix → chạy e2e test đó → phải pass |
| ✅ Có | ❌ Chưa có | **Viết code Playwright TRƯỚC** (theo PLAYWRIGHT_CODE_CONVENTIONS.md) → rồi mới code feature |
| ❌ Chưa có | ❌ Chưa có | **Viết TC spec TRƯỚC** (theo tests/e2e/TEMPLATE.md) → viết Playwright code → rồi mới code feature |
| ✅ Có | ✅ Có nhưng outdated | Cập nhật TC spec + Playwright code cho match behavior mới |

### Khi fix bug

```
1. Xác định: bug ở screen nào, flow nào?
2. Tìm TC spec cover scenario đó
3. Nếu TC đã có nhưng test PASS → TC chưa đủ chi tiết → BỔ SUNG test case mới vào TC spec
4. Nếu TC đã có và test FAIL → đây là regression được detect → fix bug, test phải green lại
5. Nếu TC CHƯA CÓ → viết TC spec cho bug scenario → viết Playwright code → fix bug → test pass
6. Rule: mỗi bug fix PHẢI có ít nhất 1 e2e test case đảm bảo bug không quay lại
```

### Khi thêm feature mới

```
1. Feature ở screen mới → tạo TC spec file mới (smoke + happy path)
2. Feature ở screen đã có → bổ sung TC vào spec file hiện tại
3. Viết Playwright code cho TCs mới TRƯỚC khi code feature (TDD-style)
4. Code feature → e2e tests phải chuyển từ fail → pass
5. Nếu feature thêm UI elements mới → thêm data-testid vào source code
6. Cập nhật tests/e2e/INDEX.md: số TC mới, status
```

### Ví dụ: Fix bug "quiz timer không reset giữa các câu"

```
BƯỚC 1: Screen bị ảnh hưởng = /quiz (QuizPage)
BƯỚC 2: Đọc INDEX.md → W-M03 Practice Mode + W-M04 Ranked Mode cover /quiz
         Đọc specs/smoke/W-M03-practice-mode.md → không có TC cho timer reset
         Đọc specs/happy-path/W-M03-practice-mode.md → W-M03-L2-005 check timer nhưng không test reset
         → CHƯA CÓ TC đủ chi tiết cho timer reset scenario
BƯỚC 3: Chưa có code Playwright cho timer reset
BƯỚC 4: Hành động:
         1. Thêm TC mới: W-M03-L2-014 "Timer reset về 30s khi chuyển câu mới"
         2. Viết Playwright code cho TC đó (test.fixme() vì bug đang tồn tại)
         3. Fix bug trong QuizPage.tsx
         4. Chạy lại e2e → W-M03-L2-014 pass
         5. Commit: "fix: quiz timer not resetting + e2e test W-M03-L2-014"
```

---

## Workflow khi làm feature mới

```
1. Đọc TODO.md → xác định task cần làm
2. Nếu prompt mới → CHIA NHỎ thành tasks → GHI VÀO TODO.md trước
3. **E2E Test Gate** → kiểm tra TC spec + Playwright code (xem section trên)
4. Bắt đầu task đầu tiên trong TODO.md
5. Nếu có Stitch design → MCP query Stitch lấy design → code match pixel-perfect
6. Nếu không có Stitch design → follow design tokens + pattern từ screens đã sync
7. Code từng phần nhỏ → Tầng 1 test (scope test) sau mỗi phần
8. Hoàn thành screen → viết unit test đầy đủ (Vitest, min 8 cases)
9. Unit test pass → chạy e2e test liên quan (Playwright) → phải pass
10. Tầng 2 test (related modules) → fix nếu có regression
11. Tầng 3 test (FULL REGRESSION) → BẮT BUỘC pass hết trước khi commit
12. Kiểm tra: số test >= baseline, không có test bị skip
13. Update TODO.md → đánh ✅ task vừa xong
14. Commit theo convention (1 task = 1 commit)
15. Nếu có quyết định kỹ thuật → ghi DECISIONS.md
16. Chuyển sang task tiếp theo trong TODO.md → lặp lại từ bước 4
```

## Workflow khi sync Stitch design

### Nguyên tắc cốt lõi
> **Stitch HTML là source of truth. Code PHẢI replicate từng section, không được tự ý bỏ bớt hoặc thêm.**
> Nếu Stitch có 8 sections → code phải có 8 sections. Không được "simplified version".

```
1. Đọc TODO.md → nếu là prompt mới → chia thành tasks per screen → ghi TODO.md
2. Bắt đầu task đầu tiên (1 screen = 1 task)
3. Đọc Stitch HTML file:
   - Nếu có trong docs/designs/stitch/ → đọc trực tiếp
   - Nếu chưa có → MCP Stitch query → save HTML → rồi đọc
4. LIỆT KÊ từng section trong Stitch HTML (viết ra comment hoặc terminal):
   - Section 1: [tên] — [mô tả nội dung] — [Tailwind classes chính]
   - Section 2: [tên] — [mô tả] — [classes]
   - ... liệt kê TOÀN BỘ, không bỏ sót
5. Đọc code hiện tại → liệt kê sections trong code
6. DIFF bắt buộc (viết ra):
   | # | Stitch Section | Code Section | Match | Action |
   |---|---------------|-------------|-------|--------|
   | 1 | KPI Cards | KPI Cards | 🔄 70% | Update sub-stats |
   | 2 | Activity Log | KHÔNG CÓ | ❌ | THÊM MỚI |
   | 3 | ... | ... | ... | ... |
7. Thực hiện TỪNG action trong bảng diff:
   - ❌ KHÔNG CÓ → tạo component mới match Stitch HTML
   - 🔄 Partial → update cho khớp 100%
   - ✅ Match → giữ nguyên
   - Code có nhưng Stitch KHÔNG CÓ → XÓA (trừ khi là business logic cần thiết)
8. Với mỗi section mới/update: copy Tailwind classes từ Stitch HTML, adjust cho React
9. KHÔNG thay đổi business logic — chỉ sửa UI/styling
10. SAU KHI CODE XONG — verify lại bảng diff: tất cả sections phải ✅
11. Tầng 1 → Tầng 2 → Tầng 3 test
12. Update TODO.md → đánh ✅
13. Commit: `sync: <ScreenName> from Stitch + tests`
```

### Cách đọc Stitch HTML file
```
1. Mở file HTML trong docs/designs/stitch/
2. Tìm tất cả top-level <div> hoặc <section> → đó là các sections
3. Với mỗi section:
   - Đọc Tailwind classes → giữ nguyên khi chuyển sang React
   - Đọc text content → hiểu section làm gì
   - Đọc nested structure → replicate component tree
4. Colors trong HTML → map sang code variables (nếu có)
5. Icons trong HTML → dùng cùng icon library
6. KHÔNG ĐƯỢC tự ý:
   - Bỏ section nào trong Stitch
   - Thêm section không có trong Stitch
   - Đổi layout grid khác Stitch
   - Đổi color khác Stitch
   - "Simplified" bất kỳ section nào
```

---

## Definition of Done
- Full Regression pass (Tầng 3): Vitest + Playwright + JUnit — tất cả green
- Số test >= baseline trước task (không được giảm)
- Không có test bị skip/disabled mà trước đó đang pass
- Không có TypeScript/Java compile error
- Không có @SuppressWarnings mới
- Flyway migration chạy clean trên DB trống
- Chạy được trên local end-to-end
- UI match design tokens (nếu có Stitch → pixel-perfect)
- Loading, error, success states đều handled

## KHÔNG được làm
- Không dùng H2 in-memory cho test — dùng Testcontainers MySQL
- Không map Entity → DTO thủ công — dùng MapStruct
- Không để business logic trong Controller — chỉ ở Service
- Không commit code có System.out.println — dùng @Slf4j + log
- Không xóa Flyway migration đã chạy — tạo migration mới để fix
- Không hardcode màu/font ngoài design tokens
- Không tạo CSS utility mới khi đã có class tương đương trong global.css
- Không dùng `page.waitForTimeout()` trong Playwright — dùng proper waits
- Không commit code mà test đang fail
- Không để 1 file component > 300 LOC
- Không skip Full Regression (Tầng 3) trước commit — dù chỉ sửa 1 dòng CSS
- Không disable/skip test cũ để làm test mới pass — fix root cause
- Không tiếp tục feature mới khi đang có regression chưa fix
- Không chỉ chạy test file vừa sửa rồi commit — phải qua đủ 3 tầng
- Không nhận prompt rồi code hết 1 lần — PHẢI chia nhỏ tasks vào TODO.md trước
- Không gộp nhiều thay đổi vào 1 commit — 1 task = 1 commit
- Không bỏ qua cập nhật TODO.md sau mỗi task hoàn thành
- Không bỏ section nào có trong Stitch HTML khi sync — phải replicate TOÀN BỘ
- Không thêm section mà Stitch design KHÔNG CÓ (trừ khi business logic bắt buộc)
- Không "simplified version" khi sync Stitch — phải pixel-perfect
- Không sync Stitch mà không viết DIFF table trước — phải liệt kê sections trước khi code
- Không tự ý đổi layout/grid/color khác Stitch HTML — Stitch là source of truth
## Mobile Code Rules
- TẤT CẢ business logic PHẢI nằm trong src/logic/ hoặc src/utils/
- Components CHỈ chứa UI render + gọi logic functions
- Mỗi logic file PHẢI có test file tương ứng
- KHÔNG viết logic trong component
## Mobile Testing Rules

### Bắt buộc mỗi PR (Claude Code tự chạy):

1. **Logic test cho MỌI function trong src/logic/ và src/utils/**
   - Chạy: `npm test`
   - Target: 100% logic functions có test
   
2. **Component test cho MỌI screen và component mới/sửa**
   - Render test: component hiện đúng text, elements
   - Interaction test: press, input, navigation
   - Chạy: `npm test`
   
3. **Snapshot test cho MỌI screen**
   - Tạo snapshot lần đầu
   - Verify snapshot không thay đổi ngoài ý muốn
   
4. **TypeScript strict — no any**
   - `"strict": true` trong tsconfig.json
   - Type errors = bugs tiềm ẩn

### Code structure bắt buộc:

---

## Known Issues & Tech Debt (cập nhật: 2026-04-27)

> **Claude Code PHẢI đọc section này trước khi code.** Nếu chạm vào file có known issue → fix luôn, KHÔNG để lại.

### Critical — fix ngay khi chạm vào file
| # | File | Issue | How to fix |
|---|------|-------|------------|
| 1 | `api/client.ts` | ~~Duplicate auth interceptor~~ — FIXED: only `addAuthInterceptor(api)` + `addAuthInterceptor(aiApi)` now | — |
| 2 | `api/client.ts` | ~~Error messages hardcoded tiếng Việt~~ — FIXED in i18n Phase 4: routes through `i18n.t('errors.*')` | — |
| 3 | `api/client.ts` | ~~`window.location.href = '/login'`~~ — FIXED: dispatches `auth:session-expired` event | — |
| 4 | `infra/docker/nginx.conf` | ~~CSP có `unsafe-eval` trong script-src~~ — FIXED 2026-04-27: removed `'unsafe-eval'`; kept `'unsafe-inline'` only (line 41). Original entry incorrectly pointed at `vite.config.ts` — actual prod CSP is served by nginx. | — |
| 5 | `.env.production` | ~~API URL vẫn là `localhost:8080`~~ — FIXED: `VITE_API_BASE_URL=` và `VITE_WS_URL=` để trống (same-origin qua reverse proxy) | — |
| 6 | `hooks/useWebSocket.ts` | ~~Không gửi JWT token~~ — FIXED: line 142-145 appends `?token=...` query param using `getAccessToken()` | — |
| 7 | `hooks/useWebSocket.ts` | ~~useEffect dependency `[]`~~ — FIXED: line 275 now has `[url]` | — |
| 8 | `utils/localStorageClearDetector.ts` | ~~Monkeypatch `localStorage.clear()` + polling 2s~~ — FIXED: rewritten to use native `storage` event + explicit `notifyRankedDataCleared()` (24-line file, no monkeypatch, no polling) | — |
| 9 | `contexts/RequireAdmin.tsx` | ~~Role check cả uppercase + lowercase~~ — FIXED: only checks `'CONTENT_MOD'` (uppercase) on line 7; backend now consistent | — |

### Medium — fix khi có thời gian
| # | File | Issue |
|---|------|-------|
| 10 | `pages/AuthCallback.tsx` | Dynamic `import()` trong useEffect — đổi thành static import |
| 11 | `pages/RoomQuiz.tsx` | `location.state as any` — tạo typed interface |
| 12 | `pages/Achievements.tsx` | `useState<any>({})` — type stats object |
| 13 | `hooks/useWebSocket.ts` | PLAYER_UNREADY gọi onPlayerReady — cần handler riêng |
| 14 | `store/authStore.ts` | Dispatch event tên `localStorageCleared` misleading — đổi thành `rankedDataCleared` |
| 15 | `components/ui/SearchableSelect.tsx` | Inline styles thay vì Tailwind classes |

### i18n Coverage (cập nhật: 2026-04-19)

- **Validator**: `cd apps/web && npm run validate:i18n` — fails CI if hardcoded Vietnamese or missing key appears
- **Current state**: 116 hardcoded lines, 0 missing keys (baseline 578/32)
- **Accepted debt** (not UI strings, do NOT fail validator):
  - `data/verses.ts` (30) — Bible verse content, separate localization workflow
  - `pages/PrivacyPolicy.tsx` + `pages/TermsOfService.tsx` (57) — legal text, bilingual via `isVi` ternary
  - `pages/LandingPage.tsx` (10) — marketing copy
  - `pages/admin/AIQuestionGenerator.tsx` DEFAULT_PROMPT (8) — literal prompt sent to AI
  - Mock sample data (11) — placeholder records until real APIs wire up
- **Rule**: every new PR MUST run `npm run validate:i18n`; if count increases, block merge

> Khi nhận task mới mà chạm vào file có known issue → **tạo thêm 1 task fix issue đó** trong TODO.md, làm TRƯỚC task chính.

---

## API Endpoints Map (cho Claude Code hiểu data flow)

### Auth
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| POST | `/api/auth/exchange` | No | OAuth code → tokens (set httpOnly cookie) |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | Yes | Blacklist token + clear cookie |
| GET | `/api/me` | Yes | Current user profile |

### Quiz & Game Modes
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| GET | `/api/questions` | No | Lấy questions (query params: book, difficulty, count) |
| GET | `/api/questions/qotd` | No | Question of the day |
| POST | `/api/sessions` | Yes | Tạo quiz session |
| POST | `/api/sessions/{id}/answers` | Yes | Submit answer |
| GET | `/api/daily-challenge` | No | Daily challenge (5 questions) |
| POST | `/api/ranked/sessions` | Yes | Tạo ranked session |
| POST | `/api/ranked/sync-progress` | Yes | Sync ranked data |
| GET | `/api/ranked/status` | Yes | Energy, question counts, current book |
| GET | `/api/ranked/tier` | Yes | Current tier info |

### Lifelines (v1 — hint only; askOpinion deferred to v2)
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| POST | `/api/sessions/{id}/lifeline/hint` | Yes | Eliminate 1 wrong option (body: `{questionId}`; returns `{eliminatedOptionIndex, hintsRemaining, method}`) |
| GET | `/api/sessions/{id}/lifeline/status?questionId=X` | Yes | Remaining quota + eliminated options for current question |

### Multiplayer
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| POST | `/api/rooms` | Yes | Create room |
| GET | `/api/rooms` | No | List public rooms |
| POST | `/api/rooms/{id}/join` | Yes | Join room by code |
| WS | `/ws` (STOMP) | Bearer | Real-time room messaging |
| WS | `/topic/room/{roomId}` | Sub | Room events (STOMP subscribe) |

### Social
| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| GET | `/api/leaderboard` | No | Rankings (query: period) |
| GET/POST | `/api/groups` | Yes | Church groups CRUD |
| GET/POST | `/api/tournaments` | Yes | Tournament CRUD |
| GET | `/api/achievements` | Yes | User achievements |

### Admin (tất cả yêu cầu ADMIN role)
| Prefix | Mô tả |
|--------|--------|
| `/api/admin/users` | User management |
| `/api/admin/questions` | Question CRUD + review |
| `/api/admin/rankings` | Ranking config |
| `/api/admin/events` | Event management |
| `/api/admin/config` | System configuration |

---

## Error Handling Patterns (bắt buộc tuân theo)

### Backend error response format (mọi endpoint)
```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Question not found",
  "requestId": "abc-123",
  "details": {}
}
```

### Frontend error handling (3 layers)
```
Layer 1: TanStack Query onError → showError() from ErrorContext → toast
Layer 2: Axios response interceptor → auto-refresh token on 401, attach userMessage
Layer 3: ErrorBoundary → catch render crashes → fallback UI
```

### Quy tắc khi viết error handling mới:
- LUÔN dùng `showError(error.userMessage || error.message)` — không tự viết message
- LUÔN handle 3 states trong page: loading (Skeleton), error (message + retry button), success
- API errors trong TanStack Query → dùng `onError` callback hoặc `isError` + `error` từ useQuery
- KHÔNG dùng try/catch cho API calls khi đã dùng TanStack Query — Query tự handle
- KHÔNG swallow errors silently (`catch {}` trống) — ít nhất phải `console.warn`

---

## State Management Map

### Zustand Stores
| Store | File | Scope | Persistence |
|-------|------|-------|-------------|
| `useAuthStore` | `store/authStore.ts` | User auth, role, token | In-memory token + localStorage profile cache |
| `useOnboardingStore` | `store/onboardingStore.ts` | Onboarding completion | localStorage |

### React Context (chỉ cho tree-scoped concerns)
| Context | File | Scope |
|---------|------|-------|
| `ErrorContext` | `contexts/ErrorContext.tsx` | Toast notifications (render trong React tree) |

### TanStack Query (server state)
- Tất cả API data → TanStack Query (cache, refetch, stale)
- KHÔNG dùng useState cho data từ API
- Stale time mặc định: 5 phút
- Retry: 3 lần với exponential backoff

### localStorage keys đang dùng
| Key | Mô tả | Đọc bởi |
|-----|--------|---------|
| `userName` | Cached user name | authStore (checkAuth) |
| `userEmail` | Cached user email | authStore |
| `userAvatar` | Cached avatar URL | authStore |
| `rankedSnapshot` | Ranked progress snapshot | useRankedDataSync |
| `rankedProgress` | Ranked progress data | useRankedDataSync |
| `rankedStatus` | Ranked status cache | useRankedDataSync |
| `quizLanguage` | vi / en preference | quizLanguage util |
| `hasSeenOnboarding` | Boolean | onboardingStore |
| `i18nextLng` | Language preference | i18n |
| `dailyBonusDismissed` | `YYYY-MM-DD` of last-dismissed daily bonus | DailyBonusModal |

> KHÔNG thêm localStorage key mới mà không ghi vào bảng trên.

---

## Khi Claude Code bị kẹt / không chắc

### Nguyên tắc "Khi nghi ngờ"
1. **Không chắc về behavior** → viết test trước, verify behavior hiện tại, rồi mới sửa
2. **Không chắc file nào ảnh hưởng** → đọc bảng "file nhạy cảm" ở trên → chạy Full Regression
3. **Không chắc design** → check Stitch MCP trước, KHÔNG tự design
4. **Không chắc API contract** → đọc Controller + DTO trong backend, KHÔNG đoán response format
5. **Không chắc về performance impact** → benchmark trước và sau, ghi kết quả vào commit message
6. **Task quá lớn (> 100 LOC thay đổi)** → DỪNG, chia nhỏ thêm trong TODO.md
7. **2 cách implement, không biết chọn cái nào** → ghi cả 2 vào DECISIONS.md với trade-offs, chọn cái đơn giản hơn

### Khi gặp lỗi không fix được sau 3 lần thử
```
1. Ghi lại: file nào, error gì, 3 cách đã thử
2. Đánh task [!] BLOCKED trong TODO.md
3. Ghi lý do block
4. Chuyển sang task khác không phụ thuộc
5. Quay lại task blocked sau khi có thêm context
```

---

## Vibe Coding Guardrails

### Trước khi bắt đầu BẤT KỲ task nào
```
□ Đã đọc TODO.md
□ Đã đọc section "Known Issues" ở trên — nếu chạm file có issue → thêm fix task
□ Đã xác định files sẽ sửa — có file "nhạy cảm" không?
□ Đã chia task đủ nhỏ (< 100 LOC mỗi task)
□ **E2E Test Gate**: đã check TC spec + Playwright code cho screens bị ảnh hưởng
```

### Trong khi code
```
□ Mỗi function/component xong → Tầng 1 test ngay
□ Không viết code > 30 phút mà chưa chạy test
□ Nếu đang sửa file A mà phát hiện bug ở file B → GHI TODO riêng, KHÔNG fix luôn
□ Console.log chỉ dùng với `if (import.meta.env.DEV)` — production sẽ bị strip
```

### Sau khi code xong 1 task
```
□ Tầng 1 + 2 + 3 test pass
□ TODO.md đã cập nhật ✅
□ Commit message theo convention
□ Nếu có quyết định kỹ thuật → DECISIONS.md
□ Nếu thêm localStorage key mới → cập nhật bảng trong CLAUDE.md
□ Nếu thêm API endpoint mới → cập nhật API Endpoints Map trong CLAUDE.md
```

### Anti-patterns phổ biến khi vibe coding (Claude Code hay mắc)
- ❌ Nhận prompt dài → code hết 1 lần → commit 1 cục lớn → có bug không biết do đâu
- ❌ Sửa bug ở file A → tiện tay refactor file B → break file C → mất 2 giờ debug
- ❌ Mock quá nhiều trong test → test pass nhưng code thật fail
- ❌ Copy-paste code từ component khác → quên đổi tên/ID → duplicate logic
- ❌ Thêm dependency mới mà không hỏi → conflict với existing libraries
- ❌ Viết CSS inline vì "nhanh hơn" → không consistent với design system
- ❌ Skip error handling vì "sẽ thêm sau" → quên, user thấy blank screen
- ❌ Chạy chỉ 1 test file pass rồi commit → regression ở file khác
- ❌ Tạo utility function mới mà đã có sẵn trong codebase → duplicate
- ❌ Không đọc existing code trước khi viết → tạo pattern khác với codebase

### Pattern đúng
- ✅ Đọc code hiện tại TRƯỚC khi viết code mới → follow existing patterns
- ✅ Grep codebase trước khi tạo utility mới → tránh duplicate
- ✅ 1 task = 1 commit = < 100 LOC thay đổi
- ✅ Test ngay sau mỗi thay đổi nhỏ, không đợi cuối
- ✅ Khi sửa shared code → chạy full regression NGAY, không đợi cuối task