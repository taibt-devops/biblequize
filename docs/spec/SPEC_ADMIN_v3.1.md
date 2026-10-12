# SPEC_ADMIN v3.1 — Admin Panel

> **Last updated:** 2026-05-09
> **Replaces:** [SPEC_ADMIN_v3.md](../../archive/SPEC_ADMIN_v3.md) (2026-04-07, archived 2026-05-09)
> **Audit basis:** `docs/audit/AUDIT_INVENTORY.md` + `docs/audit/AUDIT_DIVERGENCES.md` (Phase 1, 2026-05-09)
> **Phase:** 2 — Spec rewrite to canonical (Q1–Q6 locked by Bùi 2026-05-09)
> **Scope:** Admin & content-moderation features. Người dùng cuối xem `SPEC_USER_v3.1.md`. Multiplayer xem `SPEC_MULTIPLAYER.md`. Group xem `SPEC_GROUP_v1.2.md`.

> **Quy ước trình bày:** Mỗi section H2 mô tả theo template **Mục đích → Routes/Endpoints → Hành vi shipped → Hạn chế / TODO → Cross-ref**. File:line trỏ đến code thật để dễ verify. Tên cosmetics dùng tier C1 chính tắc (Tân Tín Hữu / Người Tìm Kiếm / Môn Đồ / Hiền Triết / Tiên Tri / Sứ Đồ).

---

## Mục lục

1. Mục đích & Roles
2. Admin Panel Routes
3. Dashboard
4. User Management
5. Question CRUD
6. Duplicate Detection
7. AI Question Generator (đã bỏ 13/10/2026)
8. Question Review Queue
9. Question Quality
10. Group Moderation
11. Season Management
12. Notification Campaigns
13. Configuration
14. Audit Log
15. Metrics
16. Export Center
17. Test Panel (dev/staging)
18. Feedback Review
19. API Endpoints (tổng hợp)
20. Known Issues / Backlog
21. Cross-references

---

## 1. Mục đích & Roles

### 1.1 Mục đích
Admin Panel BibleQuize cung cấp công cụ vận hành nội dung (câu hỏi, mùa giải), kỷ luật người dùng (ban, lock group), giám sát chất lượng (review queue, quality, metrics), đẩy thông báo, sửa cấu hình runtime, và **các fixture E2E test** trên môi trường dev/staging/docker.

### 1.2 Roles & Quyền

| Role | Backend nguồn | Quyền chính | Truy cập |
|------|--------------|-------------|----------|
| `ADMIN` | `User.role = "ADMIN"` (DB) | Toàn bộ admin endpoints | Tất cả 15 trang admin |
| `CONTENT_MOD` | `User.role = "CONTENT_MOD"` (DB) | Read-only Dashboard + Metrics + Feedback list; Review Queue đầy đủ | Sidebar hiển thị nhãn "Moderation" |
| `USER` | mặc định | Không truy cập admin | Bị chuyển về `/` |

### 1.3 Cơ chế gating
- **Backend:** `@PreAuthorize("hasRole('ADMIN')")` ở mọi `Admin*Controller` — verified `AdminUserController.java:23`, `AdminQuestionController.java:29`, `AdminGroupController.java:18`, `AdminSeasonController.java:18`, `AdminAuditController.java:27`, `AdminTestController.java:59`, `AIAdminController.java:20`. Hai trang sử dụng nhãn rộng hơn `hasAnyRole('ADMIN', 'CONTENT_MOD')`: `AdminDashboardController.java:24`, `AdminMetricsController.java:26`, `QuestionReviewController.java:25`, `FeedbackController.list` (`FeedbackController.java:98`).
- **Frontend:** `RequireAdmin.tsx:4` — kiểm tra `isAdmin || user.role === 'CONTENT_MOD'` (uppercase only sau Known Issue #9 fix).
- Tất cả Admin endpoints chạy qua JWT Bearer (cookie httpOnly hoặc Authorization header) — xem `SPEC_USER_v3.1 §2`.

### 1.4 Audit hành vi admin
Mọi thao tác state-changing log qua SLF4J `[ADMIN]` prefix; audit DB thông qua `audit_events` table (V4) đọc bởi `AdminAuditController` — xem §14.

---

## 2. Admin Panel Routes

> Source of truth: `apps/web/src/main.tsx:179-196` — tất cả nested routes nằm trong `<RequireAdmin><AdminLayout/></RequireAdmin>`.

| # | Route | Page component | Roles | Status |
|---|-------|---------------|-------|--------|
| 1 | `/admin` | `Dashboard.tsx` | ADMIN, CONTENT_MOD (read) | Shipped |
| 2 | `/admin/users` | `Users.tsx` | ADMIN | Shipped |
| 3 | `/admin/questions` | `Questions.tsx` | ADMIN | Shipped |
| 4 | `/admin/feedback` | `Feedback.tsx` | ADMIN, CONTENT_MOD (read) | Shipped |
| 5 | `/admin/rankings` | `Rankings.tsx` | ADMIN | Shipped |
| 6 | `/admin/events` | `Events.tsx` | ADMIN | Shipped (read-only frontend) |
| 7 | ~~`/admin/ai-generator`~~ | ~~`AIQuestionGenerator.tsx`~~ | ADMIN | **Đã bỏ 13/10/2026 (AIR-4)** |
| 8 | `/admin/review-queue` | `ReviewQueue.tsx` | ADMIN, CONTENT_MOD | Shipped |
| 9 | `/admin/groups` | `Groups.tsx` | ADMIN | Shipped |
| 10 | `/admin/notifications` | `Notifications.tsx` | ADMIN | Stub (broadcast UI hardcoded — backlog) |
| 11 | `/admin/config` | `Configuration.tsx` | ADMIN | UI shell only (POST chưa wire) — backlog |
| 12 | `/admin/export` | `ExportCenter.tsx` | ADMIN | UI stub (alert "not implemented") |
| 13 | `/admin/question-quality` | `QuestionQuality.tsx` | ADMIN | Partial (coverage real, score TODO) |
| 14 | `/admin/metrics/early-unlock` | `EarlyUnlockMetrics.tsx` | ADMIN, CONTENT_MOD | Shipped |
| 15 | `/admin/test` | `TestPanel.tsx` | ADMIN (dev/staging/docker only) | Shipped (gated by `import.meta.env.PROD`) |

> `AdminLayout` (sidebar 240px + top bar) được dùng làm parent layout — file `apps/web/src/layouts/AdminLayout.tsx`.

---

## 3. Dashboard

### 3.1 Mục đích
Tổng quan toàn hệ thống cho admin và content-mod (read-only): KPIs, queue chờ duyệt, coverage tóm tắt.

> **Scope cut 2026-06-16** (DECISIONS): dashboard trimmed về **chỉ số liệu thật**. Bỏ các panel placeholder chưa có backing data: `actionItems` ("Cần xử lý"), `recentActivity` ("Hoạt động Admin"), và 2 biểu đồ Sessions/User-registration (vốn render đường cong hardcoded, total luôn `—`). Chỉ giữ KPIs + Question Queue (pendingReview) + Coverage.

### 3.2 Endpoint
`GET /api/admin/dashboard` — `AdminDashboardController.java:33` — `@PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_MOD')")`.

**Response shape (verified, post-trim):**
```json
{
  "kpis": {
    "totalUsers": 1234,
    "totalQuestions": 660,
    "pendingReview": 12,
    "activeSessions": 89,
    "activeUsers": 320
  },
  "questionQueue": { "pendingReview": 12 },
  "coverage": { "booksWithMinPool": 14, "totalBooks": 66 }
}
```

### 3.3 Hành vi shipped
- `kpis.totalUsers`: `userRepository.count()`
- `kpis.totalQuestions`: `questionRepository.countByIsActiveTrue()`
- `kpis.pendingReview`: count questions có `reviewStatus = PENDING`
- `kpis.activeSessions`: count `quiz_sessions` tạo từ đầu ngày hôm nay (best-effort, swallow exception)
- `kpis.activeUsers`: count users có `lastPlayedAt` trong 7 ngày gần nhất
- `questionQueue.pendingReview`: cùng count với `kpis.pendingReview` (panel có CTA sang Review Queue)
- `coverage.booksWithMinPool`: count books thoả `easy ≥ 30 ∧ medium ≥ 20 ∧ hard ≥ 10`

### 3.4 Hạn chế / TODO
- Mọi field đều backed bằng count thật — không còn placeholder.
- Nếu sau này cần lại "Cần xử lý" / "Hoạt động Admin": wire `FeedbackRepository.countByStatus(pending)` + `audit_events` (xem §14 Audit, F-api-16) rồi un-hide. Đến lúc đó mới thêm panel trở lại — không ship panel rỗng.

---

## 4. User Management

### 4.1 Mục đích
Tìm/lọc người dùng, xem profile cơ bản, đổi role, ban/unban — tất cả ghi audit log SLF4J `[ADMIN]` prefix.

### 4.2 Endpoints
| Method | Endpoint | Mô tả | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/users` | Paginated list (search, role filter, banned filter) | `AdminUserController.java:35` |
| GET | `/api/admin/users/{id}` | User detail DTO | `AdminUserController.java:63` |
| PATCH | `/api/admin/users/{id}/role` | Đổi role (uppercase) | `AdminUserController.java:70` |
| PATCH | `/api/admin/users/{id}/ban` | Ban/unban + reason | `AdminUserController.java:97` |

### 4.3 List users
- Query params: `page` (default 0), `size` (default 20, capped tại 100), `role`, `search`, `banned`.
- Sort: `createdAt DESC`.
- Filter logic ở Java stream sau khi load page (hint: chưa scale cho > vài ngàn users — backlog).
- Response: `{ items, total, page, totalPages }`.

### 4.4 User detail DTO (verified `toUserDTO` `AdminUserController.java:126`)
Trường: `id, name, email, avatarUrl, role, currentStreak, longestStreak, lastPlayedAt, createdAt, isBanned, banReason, bannedAt`.

> SPEC_ADMIN v3 mô tả tabs (Sessions / Achievements / Groups / Journey) — frontend `Users.tsx` chưa render các tabs này; chỉ hiện thông tin cơ bản + ban modal. **Spec v3.1 hạ scope theo code; tabs thuộc backlog.**

### 4.5 Đổi role
- Body: `{ role: "USER" | "ADMIN" | "CONTENT_MOD" }`.
- Guard: admin không thể đổi role chính mình (`adminEmail` so với `user.email`).
- Lưu uppercase; trả `{ id, role }`.

### 4.6 Ban / unban (V18)
- Body: `{ banned: bool, reason?: string }`.
- Khi `banned = true`: `reason` bắt buộc, length ≥ 10 chars (validate `AdminUserController.java:113`).
- Cấm tự ban (`AdminUserController.java:109`).
- Set `User.isBanned`, `banReason`, `bannedAt`. Khi unban → null hết các field.
- Frontend `Users.tsx` mở modal nhập reason trước khi confirm.
- **Enforcement (ADM-4, 2026-06-16, F-api-17):** ban chặn **cả REST lẫn WebSocket**. `CustomUserDetailsService` set principal `disabled` theo `isBanned`; `JwtAuthenticationFilter` bỏ qua xác thực nếu `!isEnabled()` → endpoint protected trả 401 dù token còn hạn. Trước đây ban chỉ chặn WebSocket (`WebSocketRateLimitInterceptor`). Mobile login đã chặn sẵn (`MobileAuthService`).

### 4.7 Hạn chế / TODO
- Không có endpoint xóa user account từ admin (account deletion là user-initiated qua `AccountDeletionService`, audit log riêng).
- Không có "ban history" entity — mỗi unban xoá trace lý do; chỉ còn vết trên SLF4J log.
- Filter theo `tier` chưa hỗ trợ (cần join `UserDailyProgress` aggregate — backlog).

---

## 5. Question CRUD

### 5.1 Mục đích
Tạo / sửa / xoá / import câu hỏi với guardrails: duplicate detection 3-tầng, Bible Basics safeguard.

### 5.2 Endpoints
| Method | Endpoint | Mô tả | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/questions/ping` | Health | `AdminQuestionController.java:43` |
| GET | `/api/admin/questions` | Paginated + filter (book, difficulty, type, language, reviewStatus, category, search) | `AdminQuestionController.java:49` |
| GET | `/api/admin/questions/{id}` | 1 câu theo id (404 nếu thiếu) — phục vụ trang edit refresh-safe (QPG-1) | `AdminQuestionController.getOne` |
| POST | `/api/admin/questions` | Tạo (qua duplicate check) | `AdminQuestionController.java:95` |
| POST | `/api/admin/questions/check-duplicate` | Real-time check (no save) | `AdminQuestionController.java:138` |
| PUT | `/api/admin/questions/{id}` | Update | `AdminQuestionController.java:153` |
| DELETE | `/api/admin/questions/{id}` | Soft via `isActive=false` impl, hard delete row in code | `AdminQuestionController.java:212` |
| DELETE | `/api/admin/questions` | Bulk delete (`{ids: [...]}`) | `AdminQuestionController.java:221` |
| POST | `/api/admin/questions/import` | CSV/JSON multipart, dryRun + skipDuplicates | `AdminQuestionController.java:267` |
| GET | `/api/admin/questions/coverage` | Pool size per book × difficulty | `AdminQuestionController.java:582` |

### 5.3 Create — duplicate gate
1. Gọi `DuplicateDetectionService.checkDuplicate(...)` (xem §6).
2. Nếu `dupResult.blocked()` → HTTP 409 `{ error: "DUPLICATE", message, existingQuestion }`.
3. Nếu có `matches` không blocked + `forceCreate=false` → HTTP 409 `{ error: "POSSIBLE_DUPLICATE", message, similarQuestions, hint: "Gửi lại với forceCreate=true nếu muốn tạo" }`.
4. Pass → set UUID, `pending=true` → `reviewStatus=PENDING, isActive=false, approvalsCount=0`; ngược lại set `ACTIVE, approvalsCount=2`.

### 5.4 Update — Bible Basics safeguard
- Nếu update khiến một câu Bible Basics chuyển active → inactive **và** số câu Bible Basics còn active của ngôn ngữ đó < `BasicQuizService.TOTAL_QUESTIONS` (10) → throw `BusinessLogicException` (HTTP 400). Logic ở `assertBibleBasicsSafeguard` `AdminQuestionController.java:242`.
- Lý do: `/api/basic-quiz/questions` cần đủ 10 câu active mỗi ngôn ngữ; thiếu sẽ break Ranked unlock cho new user.

### 5.5 Import CSV/JSON (verified)
- Endpoint multipart `file` + query `dryRun` + `skipDuplicates`.
- Detect format theo extension/mime (`.json` hoặc `.csv`).
- Parse → list `Question` + list error.
- **Validation per record (IMP-1..IMP-5):**
  - IMP-1: thiếu `explanation` → warning (không block).
  - IMP-2: MCQ requires options ≥ 2; correctAnswer trong range; `true_false` mặc định options `["Đúng","Sai"]`.
  - IMP-3: language default `vi` nếu rỗng.
  - IMP-4: normalize tên sách Việt → English canonical (bảng map 66 sách `AdminQuestionController.java:617-656`).
  - IMP-5: 3-layer dedup vs DB (qua `DuplicateDetectionService`) + dedup trong batch (`seenContents` HashSet).
  - IMP-7 (QQA-2): length-bias warning — nếu đáp án đúng là dài nhất VÀ ≥1.5× độ dài trung bình distractor → warning "dễ đoán" (non-block). Dùng `QuestionQualityChecker.lengthBias`.
- **dryRun=true** → return `{ dryRun, willImport, errors, warnings, duplicates }` không lưu.
- **dryRun=false** → lưu batch 100, status `PENDING / isActive=false / approvalsCount=0` → vào Review Queue.

### 5.6 Coverage
- Trả `{ books: [{ book, easy, medium, hard, total, meetsMinimum, isActiveInRanked }] }`.
- `meetsMinimum`: `easy ≥ 30 ∧ medium ≥ 20 ∧ hard ≥ 10` (mirrors Dashboard).
- `isActiveInRanked` hiện = `meetsMinimum` (alias).

### 5.7 Hạn chế / TODO
- Frontend `Questions.tsx` chưa wire toàn bộ filter (review-status filter có; bulk action partial).
- Soft delete chưa thực hiện — `DELETE` thực sự xóa row. Backlog: `isActive=false` trước, hard-delete sau retention.
- Coverage không phân biệt language (single-aggregate per book).

---

## 6. Duplicate Detection

> File: `apps/api/src/main/java/com/biblequiz/modules/quiz/service/DuplicateDetectionService.java`

### 6.1 Mục đích
3 tầng kiểm tra trùng để giữ chất lượng pool — block exact, warn nội dung tương tự, áp dụng đồng nhất cho 3 đường vào (manual create, import, AI generate).

### 6.2 Three layers (verified)

| Layer | Check | Threshold | Action | File:line |
|-------|-------|-----------|--------|-----------|
| 1. Exact match | Content normalized identical (lowercase, strip dấu câu, trim spaces) qua `existsByContentIgnoreCase` + `findByNormalizedContent` | 100% | **BLOCK** (`status=EXACT_MATCH, blocked=true`) | `DuplicateDetectionService.java:50-60` |
| 2. Same verse + answer | Cùng `book + chapter + verseStart + language` và `correctAnswerText` (sau normalize) trùng | — | WARNING (`status=SAME_VERSE_ANSWER`, similarity 90%) | `DuplicateDetectionService.java:62-79` |
| 3. Fuzzy similarity | Jaccard similarity giữa câu cùng `book + chapter + language` (chỉ active) | ≥ 0.75 | WARNING (`status=SIMILAR_CONTENT`) | `DuplicateDetectionService.java:82-100` |

### 6.3 DTOs
```
DuplicateCheckRequest  : { content, correctAnswerText, book, chapter, verseStart, language }
DuplicateMatch         : { questionId, content, correctAnswerText, book, chapter, verseStart, similarityPercent }
DuplicateCheckResult   : { status, blocked, message, matches: List<DuplicateMatch> }
DuplicateStatus        : enum { NO_MATCH, EXACT_MATCH, SAME_VERSE_ANSWER, SIMILAR_CONTENT }
```

### 6.4 Áp dụng 3 paths
- **Manual create** — `AdminQuestionController.create` gọi `checkDuplicate` trước save; trả 409 nếu block hoặc có match (trừ `forceCreate=true`). UI có thể gọi `POST /check-duplicate` riêng để debounced preview.
- **Import** — mỗi record check vs DB + check vs các record trước đó trong batch. `skipDuplicates=true` để bỏ qua warning + exact.
- **AI generate** — `AIAdminController.generate` HIỆN tại **không** chạy `DuplicateDetectionService` trên batch trả về (xem §7.7); duplicate filter sẽ kích hoạt khi admin Approve drafts (đi qua `POST /api/admin/questions`).

### 6.5 Hạn chế / TODO
- Không có "force-create override" audit (ngoài SLF4J log) — backlog: ghi `audit_events` riêng.
- Layer 3 chỉ scan câu cùng chapter; câu cùng book khác chapter không catch.

---

## 7. AI Question Generator

> **ĐÃ BỎ (13/10/2026, AIR — DECISIONS 2026-10-13):** không còn sinh câu hỏi bằng AI ở bất kỳ đâu. Phần dưới giữ làm lịch sử; mã, endpoint, cấu hình khóa AI đã gỡ. Câu đã có trong kho (kể cả nguồn `ai-generated`/`ai-group`/`AI`) giữ nguyên.

### 7.1 Mục đích
Generate câu hỏi từ 1 đoạn Kinh Thánh theo cấu hình (book/chapter/verse, difficulty, type, language, count) để feed Review Queue.

> **All-books mode (ABO, 2026-06-20):** dropdown SÁCH có thêm option **"Tất cả sách"** → gửi `scripture.book = "ALL"` (sentinel). `buildPrompt` đổi sang chế độ toàn-Kinh-Thánh: ref = "toàn bộ Kinh Thánh (66 sách)", chỉ thị AI lấy câu từ NHIỀU sách khác nhau (đa dạng Cựu/Tân Ước) bám theo `scripture.text` (chủ đề, vd "câu đố về Đavit"), và **mỗi câu PHẢI tự khai báo `book/chapter/verseStart/verseEnd` của riêng nó**. FE disable (không ẩn) selector Chương/Câu khi chọn "Tất cả sách", và map draft theo `book/chapter/verse` từng câu AI trả về (thay vì form). Controller cho `"ALL"` đi xuyên qua (non-blank → không default về Genesis).

> **Anti-guessing rules (QQA-1, nâng cấp chuẩn Haladyna/NBME 2026-06-16):** `AIGenerationService.buildPrompt` ép bộ luật thiết kế distractor cho câu MCQ (áp dụng cho cả `/generate` lẫn `/improve-question`). 8 nhóm luật: (A) self-check — che câu hỏi vẫn đoán được → loại, distractor loại được bằng nền tảng chung → viết lại, đáp án đúng không được là phương án "tích cực/đầy đủ" duy nhất; (B) **mỗi distractor một loại lỗi KHÁC nhau** chọn từ 5 kiểu (nhầm passage gần / sai chi tiết / sai phạm vi / common misconception / đúng-văn-bản-lạc-câu-hỏi), trùng loại → viết lại; (C) ≥1 đáp án "gần đúng" (almost-right, sai 1 chi tiết then chốt); (D) homogeneous (cùng độ dài/giọng văn/cấu trúc); (E) không cue tuyệt đối lộ liễu; (F) cường độ distractor theo độ khó (dễ/trung bình ≥1 almost-right/khó ≥2); (G) đảo vị trí đáp án đúng; (H) explanation nêu loại lỗi của TỪNG distractor. Lý do: seed audit 2026-06-16 thấy 80% câu có đáp án đúng dài nhất (~2.4× distractor) → đoán được không cần kiến thức; bản cũ (chỉ length-parity + near-miss) chưa đủ → AI suggestion yếu. Ví dụ JSON dùng `correctAnswer: 2` (không neo vị trí A). **Error-type enforcement (AEQ, 2026-06-16):** output MCQ thêm field `distractors[]` — mỗi phương án SAI khai `{index, errorType, almostRight}` với `errorType` ∈ 5 key `nearby_passage|wrong_detail|wrong_scope|common_misconception|true_but_off`. Server `AIGenerationService.annotateQuality` gắn `_quality` vào mỗi câu MCQ: `{valid, duplicateErrorType, almostRightCount, requiredAlmostRight (easy0/med1/hard2), reasons[]}` (lý do: `duplicate_error_type` / `insufficient_almost_right` / `missing_distractors`); gọi ở `AIAdminController.generate` (không áp cho mock). FE `DraftCard` hiện loại lỗi + tag "gần đúng" từng distractor, banner cảnh báo, và **chặn nút Duyệt** khi `quality.valid=false` (sửa draft = admin override, clear flag). `options[]` + `correctAnswer` giữ nguyên — `distractors`/`_quality` chỉ là metadata review, KHÔNG lưu vào câu hỏi. Auto reject-and-regenerate phía server (retry loop) defer.
>
> **Auto-eval panel (QEV, FE editor):** `evaluateQuestionQuality` (`apps/web/src/pages/admin/questionTypes.ts`) chạy heuristic tức thì (no AI, no quota) trong panel "Đánh giá đáp án (tự động)" của trình sửa câu hỏi. Kiểm phần *cơ học hoá được* của chuẩn trên: đủ/không trùng lựa chọn, length-parity (đúng dài nhất ≥1.5× → warn), vị trí (cảnh báo nếu ở A), **cue tuyệt đối lệch một phía đúng/sai (Rule E) → warn**, độ dài explanation. Phần *ngữ nghĩa* (loại lỗi khác nhau, almost-right, plausibility) để info "cần mắt người/AI".

### 7.2 Endpoints
| Method | Endpoint | Mô tả | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/ai/models` | List Gemini models (live API) | `AIAdminController.java:47` |
| GET | `/api/admin/ai/info` | Provider config + quota usage | `AIAdminController.java:52` |
| POST | `/api/admin/ai/generate` | Generate questions | `AIAdminController.java:76` |
| POST | `/api/admin/ai/improve-question` | AI đề xuất viết lại đáp án/distractor (QPG-2). Đi qua **`AIProviderRouter`** (mặc định **DeepSeek/Bedrock** + fallback Gemini/Claude — cùng đường với generate), gửi "improve" qua customPrompt → buildPrompt áp luật distractor. `{aiAvailable, suggestion{options,correctAnswer,explanation,providerUsed}?}`; aiAvailable:false (fail-soft, không tốn quota) khi `!router.hasAvailableProvider()` | `AIAdminController.improveQuestion` |

### 7.3 Provider support (BL-AD-7, verified 2026-05-12)
- **DeepSeek V3.2** (default): via AWS Bedrock region `ap-northeast-1` (Tokyo). Config block `biblequiz.ai.bedrock.{enabled,region,model-id,max-tokens,temperature}`. Credentials via `DefaultCredentialsProvider` chain — IAM role in prod, env vars / AWS profile for dev. Conditional bean (`BedrockDeepSeekProvider`); disable with `biblequiz.ai.bedrock.enabled=false`.
- **Gemini** (fallback): config `gemini.api-key` + `gemini.model` (default `gemini-2.5-flash`). Single request asks for all `count` questions to avoid rate limit.
- **Claude (Anthropic)** (fallback): config `anthropic.api-key` + `anthropic.model` (default `claude-haiku-4-5-20251001`). Multi-model parallel: caller có thể pass `claudeModels=[modelId1, modelId2, "auto"]`. `auto` resolves to model-by-difficulty (Sonnet 4.6 cho hard/medium, Haiku cho easy).
- **Routing:** `AIProviderRouter` injects all three; in `auto` mode tries default → fallback chain; explicit provider name (`deepseek`/`gemini`/`claude`) does NOT fallback (admin must retry on failure).
- **Mock fallback**: nếu cả 3 providers đều chưa configured → trả mock data với cảnh báo prefix `⚠️ Đây là dữ liệu mô phỏng` để debug FE.

### 7.4 Quota (BL-AD-7)
- **Daily quota:** `200 questions / day` — **SHARED GLOBALLY** across admin + group leaders (D5). Counter: Redis `ai:quota:{yyyy-MM-dd}` (UTC), TTL 25h. Reset is implicit: a new UTC date uses a new key.
- **Fail-open:** if Redis is unreachable, `AIQuotaService.tryAcquire` returns `true` so dev/CI flows still work (logs WARN).
- **Cost alert:** `$10.00 / day` (constant; cost tracking deferred to follow-up).
- Vượt quota → HTTP 429 `{ error: "QUOTA_EXCEEDED", message, used, limit, remaining }`.

### 7.5 Request shape (`AIGenerationRequest`)
```
{
  scripture:    { book, chapter, verseStart, verseEnd, text? },  // book="ALL" → all-books mode (§7.1), chapter/verse bỏ qua
  difficulty:   "easy" | "medium" | "hard",
  type:         "multiple_choice_single" | "multiple_choice_multi" | "true_false" | "fill_in_blank",
  language:     "vi" | "en",
  count:        1..20,
  customPrompt: string?,             // ghi chú bổ sung gửi vào prompt
  provider:     "auto" | "deepseek" | "gemini" | "claude",  // omit / "auto" → router default+fallback
  claudeModels: ["auto"] | string[]  // chỉ dùng khi provider=claude
}
```

### 7.6 Response shape
```
{
  jobId:      "<provider>-job-<timestamp>",
  status:     "completed",
  provider:   "deepseek" | "gemini" | "claude",
  count:      <actual returned>,
  questions:  [ { content, type, difficulty, language, options, correctAnswer, explanation, book, chapter, verseStart, verseEnd, tags, source, _generatedBy? } ],
  quotaUsed:  <int>,
  quotaLimit: 200
}
```

### 7.7 Draft workflow (current)
- Backend `AIAdminController.generate` **trả questions trực tiếp**, không lưu DB, không tạo "draft" rows. Khái niệm "drafts" trong SPEC v3 là frontend-only state.
- Frontend `AIQuestionGenerator.tsx` hiển thị danh sách → admin chỉnh inline → click "Approve" → `POST /api/admin/questions?pending=true` cho từng câu (đi qua duplicate check + Review Queue).
- Không có endpoint nào tên `POST /api/admin/ai/drafts/{id}/approve` — SPEC v3 mô tả không khớp code.

### 7.8 Hạn chế / TODO
- Quota in-memory (xem §7.4).
- Không lưu generation history / cost per call.
- Endpoint `POST /api/admin/ai/generate-explanations` (batch generate explanation cho câu cũ) **không tồn tại** trong code — SPEC v3 vaporware. Backlog item nếu muốn ship.
- Auto duplicate-check trước khi hiện drafts — backlog (hiện admin phải Approve để biết duplicate).

---

## 8. Question Review Queue

> File: `apps/api/src/main/java/com/biblequiz/api/QuestionReviewController.java` — `@PreAuthorize("hasAnyRole('ADMIN', 'CONTENT_MOD')")`.
> Migrations V8/V9 (`question_reviews` table).

### 8.1 Mục đích
1 admin (hoặc CONTENT_MOD) Approve một câu PENDING là đủ để vào pool active. Admin từ chối → REJECTED.

> **ADM-3 (DECISIONS 2026-06-16):** hạ từ 2 → 1 phê duyệt. Dual-control (2 admin khác nhau) là bất khả thi với team 1 admin → mọi câu import/AI kẹt PENDING vĩnh viễn. Nâng lại khi pool reviewer đủ lớn.
>
> **Backfill (V67, 2026-06-16):** việc hạ ngưỡng chỉ áp dụng cho lượt duyệt mới — các câu đã được duyệt 1 lần (`approvalsCount≥1`) thời ngưỡng=2 vẫn kẹt PENDING (admin duy nhất không thể duyệt lại câu mình đã review). Migration `V67__activate_single_approval_pending.sql` backfill chúng sang `ACTIVE` (idempotent) để khớp luật 1-duyệt hiện hành.

### 8.2 Endpoints
| Method | Endpoint | Mô tả | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/review/pending` | List PENDING chưa được current admin review | `QuestionReviewController.java:44` |
| POST | `/api/admin/review/{questionId}/approve` | Approve | `QuestionReviewController.java:93` |
| POST | `/api/admin/review/{questionId}/reject` | Reject (single rejection → REJECTED ngay) | `QuestionReviewController.java:137` |
| GET | `/api/admin/review/stats` | Per-admin stats | `QuestionReviewController.java:170` |
| GET | `/api/admin/review/my-history` | Lịch sử review của admin hiện tại | `QuestionReviewController.java:195` |

### 8.3 Quy tắc
- `APPROVALS_REQUIRED = 1` (constant `QuestionReviewController.java`; ADM-3 hạ từ 2).
- Admin không được approve câu mình đã review (check `existsByQuestionIdAndAdminId`).
- Approve → `approvalsCount++`; nếu `≥ 1` → `reviewStatus=ACTIVE, isActive=true` (tức ngay phê duyệt đầu tiên).
- Reject → 1 lần duy nhất → `reviewStatus=REJECTED, isActive=false`.
- **Revert về PENDING (QED-3, 2026-06-16):** sửa câu ở tab Questions đổi `reviewStatus` ACTIVE/REJECTED → PENDING sẽ mở chu kỳ duyệt mới: `approvalsCount=0` + xoá `QuestionReview` cũ (`AdminQuestionController.update`, `@Transactional`). Tránh tình trạng câu vào lại queue nhưng vô hình ở `pendingForMe` vì review của người duyệt trước vẫn còn.
- Stats: `pendingForMe, totalPending, active, rejected, myActionsToday, approvalsRequired`.
- **Edit-in-place (QED-2, 2026-06-16):** mỗi câu pending có nút "Sửa" mở **chung** `QuestionEditModal` (giống tab Questions) với `reviewStatus=PENDING` → reviewer sửa-rồi-duyệt tại chỗ; save qua `PUT /api/admin/questions/{id}`. Câu ACTIVE vẫn chỉ sửa ở tab Questions (review queue chỉ chứa PENDING).

### 8.4 DTO record (review row)
```
QuestionReview { id, questionId, adminEmail (= adminId), action: APPROVE|REJECT, comment, createdAt }
```

### 8.5 Hạn chế / TODO
- Không có "edit then approve" endpoint — admin phải `PUT /api/admin/questions/{id}` riêng rồi approve.
- Không bắt buộc lý do reject (spec v3 mô tả min 10 chars; **không enforced trong code**) — backlog.

---

## 9. Question Quality

### 9.1 Mục đích
Theo dõi chất lượng pool: coverage per book, score tổng quan, problem questions.

### 9.2 Frontend
`apps/web/src/pages/admin/QuestionQuality.tsx` — render từ `GET /api/admin/questions/coverage` (xem §5.6).

### 9.3 Hành vi shipped
- Render coverage chart per book.
- "Overall Quality Score" = **hard-coded `72`** (TODO comment `QuestionQuality.tsx:18`).
- Color coding (green ≥ 70, amber 40–69, red < 40).

### 9.4 Hạn chế / TODO
- Không có endpoint `/api/admin/question-quality/*` — toàn bộ section "Question Quality" trong SPEC v3 (problems / unused / trends / distribution / duplicates) là **vaporware**.
- Backlog: tính `qualityScore` từ `accuracy + feedback + reports`; expose `/problems` và `/unused`.

---

## 10. Group Moderation

### 10.1 Mục đích
Liệt kê / lock / unlock / soft-delete church groups khi vi phạm.

### 10.2 Endpoints
| Method | Endpoint | Mô tả | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/groups` | List groups (filter `deleted_at IS NULL`) | `AdminGroupController.java:28` |
| GET | `/api/admin/groups/{id}` | Detail | `AdminGroupController.java:37` |
| PATCH | `/api/admin/groups/{id}/lock` | Lock + reason | `AdminGroupController.java:44` |
| PATCH | `/api/admin/groups/{id}/unlock` | Unlock | `AdminGroupController.java:61` |
| DELETE | `/api/admin/groups/{id}` | Soft delete (`deleted_at = now`) | `AdminGroupController.java:73` |

### 10.3 Lock (V19)
- Body: `{ reason: string }` — bắt buộc, length ≥ 10 chars (`AdminGroupController.java:47`).
- Set `isLocked=true, lockReason, lockedAt=now`.
- Audit log SLF4J `[ADMIN] Group {id} locked by {email} reason: {reason}`.
- Khi lock, members thấy banner "Nhóm bị khóa" (logic ở Group page — xem `SPEC_GROUP_v1.2`).

### 10.4 DTO (`toDTO` `AdminGroupController.java:83`)
`{ id, name, code, memberCount, maxMembers, isPublic, isLocked, lockReason, lockedAt, createdAt, leaderName }`.

### 10.5 Hạn chế / TODO
- Không có `transfer-leader` endpoint admin — chỉ leader có thể transfer (xem `SPEC_GROUP_v1.2`).
- Không có `flagged groups` endpoint — `GroupReport` table (V41) chưa wire vào admin UI.
- Không có max-members override.

---

## 11. Season Management

### 11.1 Endpoints
| Method | Endpoint | Mô tả | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/seasons` | List sorted DESC start | `AdminSeasonController.java:28` |
| POST | `/api/admin/seasons` | Create | `AdminSeasonController.java:35` |
| POST | `/api/admin/seasons/{id}/end` | End sớm (set `endDate=today, isActive=false`) | `AdminSeasonController.java:60` |

> Note: V7 added `seasons` + `season_rankings`. AUDIT_INVENTORY ghi `PUT /api/admin/seasons/{id}` — chỉ có `POST /end`; PUT chưa có. Backlog nếu muốn edit name.

### 11.2 Validation create
- Body: `{ name, startDate (ISO), endDate (ISO) }`.
- `endDate` phải **strictly after** `startDate`.
- Không check overlap với season hiện active — backlog.

### 11.3 End season
- Set `isActive=false`, `endDate=today`.
- **Không** trigger badge distribution / season ranking snapshot trong code — backlog (SPEC v3 mô tả "trigger badge distribution" là vaporware).

### 11.4 Hạn chế / TODO
- Không có endpoint `/api/admin/seasons/{id}/stats` — backlog.
- Không có `/api/admin/leaderboard/reset` (manual recompute Redis ZSET) — backlog; Redis ZSET tự refresh qua `LeaderboardController`.

---

## 12. Notification Campaigns

### 12.1 Mục đích
Compose + broadcast in-app notifications cho user theo target.

### 12.2 Status — Stub
`apps/web/src/pages/admin/Notifications.tsx`:
- Frontend đọc lịch sử qua `GET /api/notifications?limit=20` (đây là user endpoint, không phải admin broadcast endpoint).
- Hàm `sendBroadcast` hiện gọi `await new Promise(r => setTimeout(r, 500))` — **không gọi API thật**. Comment: `// Note: broadcast endpoint needs to be created in backend`.

### 12.3 Backend
- Không tồn tại `POST /api/admin/notifications/broadcast` trong code — vaporware.
- `NotificationController` chỉ phục vụ user-side (mark-read, list cá nhân).

### 12.4 Backlog
- Triển khai `POST /api/admin/notifications/broadcast` với body `{ title, content, target: { all|tier|role|group|userIds }, scheduleAt? }`.
- Lưu campaign vào DB; track `sentCount`, `openedCount`.
- Automated notifications (streak warning, daily-challenge ready, weekly summary, ...) — quản lý qua scheduled jobs riêng, **chưa có UI admin để toggle**.

---

## 13. Configuration

### 13.1 Mục đích
Cho phép sửa runtime parameters mà không redeploy.

### 13.2 Status — UI shell only
`apps/web/src/pages/admin/Configuration.tsx`:
- Render 4 panels (Game / Scoring / AI / Room) với input boxes.
- `saveAll` chỉ `alert("not implemented")` — không POST gì cả.
- TODO comment: `// TODO: POST /api/admin/config with changed values`.

### 13.3 Backend
- Không tồn tại `AdminConfigController` — không có `GET/PATCH /api/admin/config`.
- Không có `app_config` table.
- Cấu hình runtime hiện chỉ qua env vars + `application.yml` (SPRING profiles).

### 13.4 Config keys thực tế đang dùng (`application.yml:69-87, 115-140`)

| Namespace | Key | Default | Override env var | Mô tả |
|-----------|-----|---------|------------------|-------|
| `biblequiz.auth.google` | `android-client-id` | (empty) | `GOOGLE_ANDROID_CLIENT_ID` | Mobile OAuth |
| `biblequiz.room` | `idle-timeout-minutes` | 30 | `ROOM_IDLE_TIMEOUT_MINUTES` | LOBBY auto-end (R2) |
| `biblequiz.room` | `ended-retention-hours` | 24 | `ROOM_ENDED_RETENTION_HOURS` | ENDED retention (R3) |
| `biblequiz.room` | `reconnect-grace-seconds` | 60 | `ROOM_RECONNECT_GRACE_SECONDS` | STOMP grace (R4/R5) |
| `gemini` | `api-key` / `model` | (empty) / `gemini-2.5-flash` | `GEMINI_API_KEY` / `GEMINI_MODEL` | AI provider |
| `anthropic` | `api-key` / `model` | (empty) / `claude-haiku-4-5-20251001` | env vars | AI provider |
| `app.cookie` | `secure` | `false` | `COOKIE_SECURE` | HTTPS cookie flag |
| `app.rate-limit.admin` | `requests` / `window` | 100 / 3600 | `RATE_LIMIT_ADMIN_REQUESTS` / `RATE_LIMIT_ADMIN_WINDOW` | Rate limit admin endpoints |
| `app.rate-limit.general` | `requests` / `window` | 1000 / 3600 | `RATE_LIMIT_GENERAL_REQUESTS` / `RATE_LIMIT_GENERAL_WINDOW` | Rate limit user endpoints |
| `app.seeding.questions` | `enabled` / `pattern` | `true` / `classpath*:seed/questions/*_quiz*.json` | `QUESTION_SEEDING_ENABLED` / `QUESTION_SEEDING_PATTERN` | Boot-time seeder |
| `jwt` | `secret` / `expiration` / `refresh-expiration` | (random base64) / 900_000ms / 2_592_000_000ms | env vars | JWT |

### 13.5 Backlog
- Triển khai `AdminConfigController` + `app_config` DB table với cache invalidation (current static từ YAML).
- UI keys mô phỏng (DAILY_ENERGY, BASE_POINTS_*, AI_DAILY_QUOTA, ROOM_*) ⇒ map sang config mới.

---

## 14. Audit Log

### 14.1 Endpoints
| Method | Endpoint | Mô tả | Source |
|--------|----------|-------|--------|
| GET | `/api/admin/audit/events` | Paginated events (filter `userId`, `eventType`, `action`) | `AdminAuditController.java:35` |
| GET | `/api/admin/audit/events/user/{userId}` | All events của 1 user | `AdminAuditController.java:84` |
| GET | `/api/admin/audit/events/recent` | Last N hours (default 24) | `AdminAuditController.java:97` |
| GET | `/api/admin/audit/stats` | Counts by `AuditEventType` + 24h recent | `AdminAuditController.java:115` |

### 14.2 Schema (`audit_events` V4)
- `AuditEvent` entity với fields: `id, userId, eventType, action, timestamp, metadata` (chi tiết phụ thuộc entity — xem `infrastructure/audit/AuditEvent.java`).
- `AuditEventType` enum quyết định categories.

### 14.3 Hành vi shipped
- `events` endpoint: filter `eventType` parse enum; nếu invalid → `IllegalArgumentException` bubble lên 500 (cẩn thận khi gọi từ FE).
- Filter `action` chỉ trả empty page — có comment `"basic implementation"` (`AdminAuditController.java:55-60`).

### 14.4 Action codes hiện ghi (verified qua SLF4J + AdminTestController)
- `[ADMIN]` prefix: `Role changed`, `User BANNED/UNBANNED`, `Group locked/unlocked/soft-deleted`, `Season created/ended`, `Update question`, `Import done/dry-run`.
- `[REVIEW]`: `Question ACTIVATED after N approvals`, `Question REJECTED by {email}`.
- `[FEEDBACK]`: `Admin updated id={} status={}`.
- `[AI]`: `Admin {id} generated {n} questions`.
- `[TEST_PANEL]` (WARN): `test.set_state`, `test.set_mission_state`, `test.seed_points`, `test.daily_complete`, `test.seed_group`, `test.seed_tournament`, `test.seed_review_queue`, `test.seed_feedback`, `test.seed_ranked_progress`.

> Lưu ý: hiện audit chủ yếu là SLF4J string log; persist vào `audit_events` chưa cover toàn bộ admin actions. Backlog: chuẩn hoá `AuditEventService.record(...)` và gọi từ mọi controller.

---

## 15. Metrics

### 15.1 Mục đích
Dashboard chuyên đề cho từng feature lớn — mỗi feature có endpoint + page riêng để giữ payload nhỏ.

### 15.2 Early Ranked Unlock metrics

**Endpoint:** `GET /api/admin/metrics/early-unlock` — `AdminMetricsController.java:55` (`@PreAuthorize hasAnyRole ADMIN, CONTENT_MOD`).

**Response:**
```json
{
  "totalUnlockers": 1234,
  "unlocksLast7Days": 12,
  "unlocksLast30Days": 87,
  "avgAccuracyPctAtUnlock": 84.3,
  "timeline": [
    { "date": "2026-04-10", "count": 0 },
    ...
    { "date": "2026-05-09", "count": 2 }
  ]
}
```

- 30-day timeline **zero-filled server-side** để FE chart không cần gap interpolation.
- `avgAccuracyPctAtUnlock` round 1 decimal; null nếu chưa có unlocker nào.

**Frontend:** `EarlyUnlockMetrics.tsx` — 4 KPI cards + 30-day timeline chart, dùng TanStack `useQuery`.

### 15.3 Hạn chế / TODO
- Chưa có metrics cho: Daily Mission completion, Lifeline usage, Comeback redemption, Tier distribution, Multiplayer mode popularity, Group activity. Backlog.

---

## 16. Export Center

### 16.1 Status — UI stub
`apps/web/src/pages/admin/ExportCenter.tsx`:
- Render 5 export type cards (questions / users / leaderboard / groups / analytics) × format buttons.
- `handleExport` chỉ `alert("not implemented")`.

### 16.2 Backend
- Không có `/api/admin/export/*` endpoint nào.
- Toàn bộ section §14 Export Center trong SPEC v3 là vaporware.

### 16.3 Backlog
- Triển khai async job pattern: `POST /api/admin/export/{type}` → `{ jobId }`; `GET /api/admin/export/jobs/{id}/download`; retention 24h.
- Format support: CSV (mọi loại), JSON (questions/analytics), PDF (leaderboard), Excel (users/groups).

---

## 17. Test Panel (Dev/Staging)

> File: `apps/api/src/main/java/com/biblequiz/api/AdminTestController.java`
> Annotation: `@PreAuthorize("hasRole('ADMIN')")` + `@Profile({"dev", "staging", "docker"})` (`AdminTestController.java:60`).
> Frontend: `TestPanel.tsx` — `if (import.meta.env.PROD) return <Navigate to="/" />`.

### 17.1 Mục đích
Fixture endpoints để E2E tests setup/teardown user state nhanh — bypass grind nhiều ngày để đạt tier / streak / mission state cần thiết.

> ⚠️ **NEVER active in production.** Profile guard ở backend + import.meta.env.PROD ở frontend.

### 17.2 Endpoints

| Method | Endpoint | Body / Params | Audit | Source |
|--------|----------|---------------|-------|--------|
| POST | `/api/admin/test/users/{id}/set-tier` | `?tierLevel=1..6` | `[ADMIN]` log | `AdminTestController.java:108` |
| POST | `/api/admin/test/users/{id}/reset-history` | — | log | `AdminTestController.java:151` |
| POST | `/api/admin/test/users/{id}/mock-history` | `?percentSeen=50&percentWrong=10` | log | `AdminTestController.java:161` |
| POST | `/api/admin/test/users/{id}/refill-energy` | — | log | `AdminTestController.java:201` |
| POST | `/api/admin/test/users/{id}/set-streak` | `?days=N` | log | `AdminTestController.java:220` |
| GET | `/api/admin/test/users/{id}/preview-questions` | `?count=10&book=...&language=vi` | — | `AdminTestController.java:230` |
| POST | `/api/admin/test/users/{id}/full-reset` | — | log | `AdminTestController.java:273` |
| POST | `/api/admin/test/users/{id}/set-state` | `SetStateRequest` (partial scalar) | `test.set_state` | `AdminTestController.java:306` |
| POST | `/api/admin/test/users/{id}/seed-points` | `SeedPointsRequest { totalPoints }` | `test.seed_points` | `AdminTestController.java:383` |
| POST | `/api/admin/test/users/{id}/set-mission-state` | `SetMissionStateRequest` | `test.set_mission_state` | `AdminTestController.java:435` |
| POST | `/api/admin/test/daily-complete` | `{ email, score }` | `test.daily_complete` | `AdminTestController.java:503` |
| POST | `/api/admin/test/seed-group` | `{ ownerEmail, groupName?, memberEmails[] }` | `test.seed_group` | `AdminTestController.java:539` |
| POST | `/api/admin/test/seed-tournament` | `{ tournamentName?, participantEmails[] }` | `test.seed_tournament` | `AdminTestController.java:625` |
| POST | `/api/admin/test/seed-review-queue` | `{ count: 1..100 }` | `test.seed_review_queue` | `AdminTestController.java:687` |
| POST | `/api/admin/test/seed-feedback` | `{ userEmail, count: 1..50 }` | `test.seed_feedback` | `AdminTestController.java:725` |
| POST | `/api/admin/test/seed-ranked-progress` | `{ email, questionsAnswered?, correctAnswers? }` | `test.seed_ranked_progress` | `AdminTestController.java:773` |

### 17.3 Set-state body (verified `SetStateRequest`)

| Field | Type | Range | Effect |
|-------|------|-------|--------|
| `livesRemaining` | int | 0–100 | `UserDailyProgress(today).livesRemaining` |
| `questionsCounted` | int | 0–200 | today's ranked cap counter |
| `daysAtTier6` | int | 0–30 | `User.daysAtTier6` (Prestige eligibility) |
| `lastPlayedAt` | date `YYYY-MM-DD` | — | `User.lastPlayedAt = atStartOfDay()` |
| `xpSurgeHoursFromNow` | int | 0–72 | `0` clears surge; `N` sets `xpSurgeUntil = now + N hours` |

- Null fields = no-op. Unknown fields → 400 (Jackson `UnrecognizedPropertyException` qua `GlobalExceptionHandler`).

### 17.4 Seed-points (verified)
`POST /api/admin/test/users/{userId}/seed-points` với body `{ totalPoints: 0..200000 }`:
1. Wipe **TOÀN BỘ** rows `UserDailyProgress` của user.
2. Insert 1 row mới hôm nay với `pointsCounted=totalPoints, livesRemaining=100, questionsCounted=0`.
3. Response: `{ userId, totalPoints, tierLevel, tierName (canonical C1), wipedRows }`.

> Cần thiết vì `UserTierService.getTotalPoints() = SUM(UserDailyProgress.pointsCounted)` — không có `User.totalPoints` column.

### 17.5 Set-mission-state (verified)
- Body: `{ date?: YYYY-MM-DD (default today UTC), missions: [{ missionType, progress?, completed?, bonusClaimed? }] }`.
- Lookup `(userId, date, missionType)` qua `dailyMissionRepository.findByUserIdAndDateOrderByMissionSlot`.
- Trả 404 nếu không có mission nào cho user/date đó, hoặc nếu `missionType` không tồn tại trong missions ngày đó.

### 17.6 Frontend Test Panel UI
- Inputs: email/userId target.
- Buttons: Set Tier 1..6, Trigger Tier-Up (note: trigger-tier-up endpoint in AUDIT_INVENTORY chưa có code thực — backend chỉ có `set-tier`), Refill Energy, Set Streak 30/100, Reset History, Mock History 50/10, Preview 10 questions, Full Reset.
- Hiển thị JSON response sau mỗi action.
- Banner cảnh báo "Dev/Staging only".

### 17.7 Hạn chế / TODO
- `SmartQuestionSelector` (mockHistory + previewQuestions) phải tồn tại — đã verify qua import.
- `trigger-tier-up` endpoint trong SPEC v3 không có trong code — UI button gọi sẽ fail. Backlog.

---

## 18. Feedback Review

### 18.1 Endpoints
| Method | Endpoint | Roles | Source |
|--------|----------|-------|--------|
| POST | `/api/feedback` | USER | `FeedbackController.java:54` |
| GET | `/api/admin/feedback` | ADMIN, CONTENT_MOD (read) | `FeedbackController.java:97` |
| PATCH | `/api/admin/feedback/{id}` | ADMIN | `FeedbackController.java:146` |

### 18.2 List (admin)
- Query: `status` (pending / in_review / resolved / dismissed), `type` (report / question / general), `page`, `size`.
- Response: `{ items, total, page, totalPages, stats: { <Status>: count } }`.
- Item DTO: `{ id, type, status, content, createdAt, updatedAt, userId, userName, userEmail, question?: {id, content, book}, handledBy? }`.

### 18.3 Update
- Body: `{ status?, note? }`.
- Khi `note` không rỗng → append `\n\n[Admin note]: <note>` vào `content` (in-place mutate — backlog: tách bảng admin notes).
- Set `handledBy = currentAdmin`.

### 18.4 Hạn chế / TODO
- Không có feedback delete endpoint admin.
- Không có moderation queue UI cho group announcements / reports — backlog.

---

## 19. API Endpoints (tổng hợp)

| # | Method | Endpoint | Roles | Section |
|---|--------|----------|-------|---------|
| 1 | GET | `/api/admin/dashboard` | ADMIN, MOD | §3 |
| 2 | GET | `/api/admin/users` | ADMIN | §4 |
| 3 | GET | `/api/admin/users/{id}` | ADMIN | §4 |
| 4 | PATCH | `/api/admin/users/{id}/role` | ADMIN | §4 |
| 5 | PATCH | `/api/admin/users/{id}/ban` | ADMIN | §4 |
| 6 | GET | `/api/admin/questions` | ADMIN | §5 |
| 7 | POST | `/api/admin/questions` | ADMIN | §5 |
| 8 | POST | `/api/admin/questions/check-duplicate` | ADMIN | §5/§6 |
| 9 | PUT | `/api/admin/questions/{id}` | ADMIN | §5 |
| 10 | DELETE | `/api/admin/questions/{id}` | ADMIN | §5 |
| 11 | DELETE | `/api/admin/questions` (bulk) | ADMIN | §5 |
| 12 | POST | `/api/admin/questions/import` | ADMIN | §5 |
| 13 | GET | `/api/admin/questions/coverage` | ADMIN | §5/§9 |
| 14 | GET | `/api/admin/ai/models` | ADMIN | §7 |
| 15 | GET | `/api/admin/ai/info` | ADMIN | §7 |
| 16 | POST | `/api/admin/ai/generate` | ADMIN | §7 |
| 17 | GET | `/api/admin/review/pending` | ADMIN, MOD | §8 |
| 18 | POST | `/api/admin/review/{id}/approve` | ADMIN, MOD | §8 |
| 19 | POST | `/api/admin/review/{id}/reject` | ADMIN, MOD | §8 |
| 20 | GET | `/api/admin/review/stats` | ADMIN, MOD | §8 |
| 21 | GET | `/api/admin/review/my-history` | ADMIN, MOD | §8 |
| 22 | GET | `/api/admin/groups` | ADMIN | §10 |
| 23 | GET | `/api/admin/groups/{id}` | ADMIN | §10 |
| 24 | PATCH | `/api/admin/groups/{id}/lock` | ADMIN | §10 |
| 25 | PATCH | `/api/admin/groups/{id}/unlock` | ADMIN | §10 |
| 26 | DELETE | `/api/admin/groups/{id}` | ADMIN | §10 |
| 27 | GET | `/api/admin/seasons` | ADMIN | §11 |
| 28 | POST | `/api/admin/seasons` | ADMIN | §11 |
| 29 | POST | `/api/admin/seasons/{id}/end` | ADMIN | §11 |
| 30 | GET | `/api/admin/feedback` | ADMIN, MOD | §18 |
| 31 | PATCH | `/api/admin/feedback/{id}` | ADMIN | §18 |
| 32 | GET | `/api/admin/audit/events` | ADMIN | §14 |
| 33 | GET | `/api/admin/audit/events/user/{userId}` | ADMIN | §14 |
| 34 | GET | `/api/admin/audit/events/recent` | ADMIN | §14 |
| 35 | GET | `/api/admin/audit/stats` | ADMIN | §14 |
| 36 | GET | `/api/admin/metrics/early-unlock` | ADMIN, MOD | §15 |
| 37–51 | various | `/api/admin/test/*` | ADMIN (dev/staging/docker only) | §17 |

---

## 20. Known Issues / Backlog

> Tracked tại `BACKLOG.md`. Top items relevant to admin:

| Area | Gap | Severity | Backlog ref |
|------|-----|----------|-------------|
| §3 Dashboard | ~~`actionItems` + `recentActivity` hard-coded 0 / empty~~ **RESOLVED 2026-06-16**: panel placeholder đã gỡ (scope cut, DECISIONS) — dashboard chỉ còn số liệu thật | — | done |
| §7 AI | `POST /api/admin/ai/generate-explanations` không có (vaporware) | low | spec defer hoặc implement |
| §7 AI | Quota in-memory, mất khi restart | medium | persist Redis hoặc DB |
| §7 AI | Auto duplicate-check trên drafts | medium | gọi `DuplicateDetectionService` trong `AIAdminController.generate` |
| §9 Quality | Overall score hard-coded `72`; không có endpoint `/problems`, `/unused`, `/trends` | medium | implement controller |
| §10 Groups | Flagged groups (V41 reports) chưa wire UI | low | implement |
| §11 Seasons | Không tự động distribute badges khi end season | medium | trigger logic |
| §11 Seasons | `PUT /seasons/{id}` (rename / fix dates) | low | implement |
| §12 Notifications | Broadcast endpoint không tồn tại | high | implement (`POST /api/admin/notifications/broadcast`) |
| §13 Config | Toàn bộ Configuration page chưa wire backend | high | tạo `AdminConfigController` + `app_config` table |
| §14 Audit | Hầu hết admin action chỉ SLF4J log, không persist | medium | chuẩn hoá `AuditEventService.record` |
| §16 Export | Toàn bộ Export Center chưa có backend | medium | async job pattern |
| §17 Test Panel | `trigger-tier-up` button không có endpoint | low | implement hoặc xóa nút |
| Q1 (Bùi locked) | Bible canon BTTHĐ 2011 vs code BTT 1926 | high | migrate seed text (admin-impacting nếu có content fix tool) |
| Q3 (Bùi locked) | Liturgical seasons 2/4 ship; ×1.5 dead code | medium | implement Pentecost + Thanksgiving |
| Q5 (Bùi locked) | XP surge consume chưa wire ScoringService | medium | wire bonus |
| Q6 | Sentry không ship → đã loại khỏi spec | resolved | — |

### 20.1 Recommended resolutions (2026-05-09 — pragmatic defaults)

Các open question từ Phase 2 audit, kèm recommendation + rationale. Bui có thể override; nếu không phản hồi → áp dụng default.

| # | Question | Recommendation | Rationale |
|---|---|---|---|
| AD-1 | AI Quota persistence: Redis vs DB vs in-memory | **Redis sorted-set per `adminId:date`** với TTL 48h | DB write/request → too chatty; Redis có sẵn (cache layer); TTL tự cleanup |
| AD-2 | Configuration backend: new `app_config` DB table vs read-only `application.yml` | **Mới: `app_config(key, value, type, updated_by, updated_at)` table + cache layer** | Read-only YML không justify Configuration page; có table cho phép hot-config without redeploy. Use cache (Caffeine 5min TTL) tránh round-trip per request. |
| AD-3 | Notification broadcast: reuse NotificationService vs build campaign system | **Build campaign system (lightweight)**: `notification_campaigns(id, target_audience, content, sent_count, opened_count, sent_at)`. Spawn batch per target user. | UI đã design cho campaign metrics; reuse NotificationService đơn lẻ làm mất tracking. Lightweight = không async queue đầy đủ, chỉ batch insert + sync send. |
| AD-4 | Audit log: standardize via `AuditEventService.record(...)` vs SLF4J only | **Standardize for compliance/search.** Mọi admin write action call `AuditEventService.record(actorId, action, targetType, targetId, before, after, metadata)` | SLF4J string log không searchable; `audit_events` table V4 đã sẵn — chỉ cần wire from controllers. Compliance-ready. |
| AD-5 | Question delete: soft (`isActive=false`) vs hard | **Soft delete + 30-day retention**: `Question.deleted_at` column (nullable); admin "Trash" tab để restore; cron purge sau 30 ngày | Mistakes từ admin có thể recover; aggregate queries filter `deleted_at IS NULL`; 30 ngày = compromise giữa storage + UX |
| AD-6 | CONTENT_MOD UI variation: implement label switch in AdminLayout | **Implement** — sidebar header read `userRole`, render "Moderation Dashboard" cho CONTENT_MOD, "Admin Panel" cho ADMIN. Hide sections không có quyền (Configuration, Test Panel, Notifications campaign builder). | Spec v3 đã hứa; cost thấp (~30 LOC layout); rõ ràng cho mod biết phạm vi. |

> **Chấp nhận default → tracked trong [BACKLOG.md](BACKLOG.md)** với prefix `BL-AD-N`.

---

## 21. Cross-references

- **User-facing features:** `SPEC_USER_v3.1.md` (tier C1 names, scoring, daily mission, lifeline, prestige, comeback, milestone burst).
- **Multiplayer (5 modes + R1–R5 lifecycle + STOMP events):** `SPEC_MULTIPLAYER.md`.
- **Group features (Q-A scoring scope, Q-N route, scheduled quizzes, kick logs):** `SPEC_GROUP_v1.2.md`.
- **Roadmap (Friend v2.5, TV Host v1.5, Premium v3.0, Sentry):** `SPEC_ROADMAP.md`.
- **Code gaps & migration items:** `BACKLOG.md`.
- **Audit basis (this rewrite):** `docs/audit/AUDIT_INVENTORY.md`, `docs/audit/AUDIT_DIVERGENCES.md`, `docs/audit/AUDIT_SUMMARY.md`.

---

*Living spec — cập nhật theo từng milestone. Nếu bất kỳ section nào diverge khỏi code, ưu tiên fix code (theo BACKLOG) hoặc cập nhật spec ngay sau khi xác nhận với Bùi.*
