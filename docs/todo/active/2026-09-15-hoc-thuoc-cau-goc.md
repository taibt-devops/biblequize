# 2026-09-15 — Học Thuộc câu gốc (mode trong Luyện Tập) — Đợt 1 (cách A)

> **Source**: brainstorming 2026-09-15 sau đo độ khó Đấu Hạng (người mới bỏ app sau trận đầu, không tương quan độ chính xác; phản hồi: "muốn vừa chơi vừa học, ghi nhớ Kinh Thánh tốt hơn").
> **Scope**: Đợt 1 = toàn văn BTTHĐ 2011 + danh sách câu của tôi + lịch ôn giãn cách + 2 dạng bài (sắp xếp cụm từ, điền từ khuyết tăng dần) + đoạn văn xung quanh + lối vào (Luyện Tập + thẻ nhắc trang chủ). Đợt 2/3 ở cuối file, CHƯA thành task.
> **Branch/worktree**: `feat/hoc-thuoc-cau-goc` @ `../biblequize-memorize` (tránh đụng working tree chính).

---

## 1. Quyết định đã chốt (user, 2026-09-15)

| # | Quyết định |
|---|---|
| D1 | Trục chính = **thuộc câu gốc** (kết hợp nhớ câu chuyện + hiểu ý nghĩa làm bổ trợ) |
| D2 | Bản dịch = **BTTHĐ 2011** (C4). User xác nhận **đã có quyền** dùng nguyên văn |
| D3 | Nguồn câu = **user tự chọn bất kỳ câu nào** trong 66 sách → cần toàn văn |
| D4 | Vị trí = **mode "Học Thuộc" trong Luyện Tập** (màn riêng) + **thẻ "Câu gốc cần ôn hôm nay"** trên Home (chỉ hiện khi có câu đến hạn) |
| D5 | Dạng bài (đủ 4, chia đợt): sắp xếp cụm từ · điền từ khuyết tăng dần · gõ chữ cái đầu · nhớ địa chỉ câu |
| D6 | Ngữ cảnh: đoạn văn xung quanh · câu quiz sẵn có cùng chương · giải thích AI |
| D7 | Giải thích AI: **hiện ngay + nhãn "Do AI tóm tắt" + nút báo sai** vào hàng duyệt admin |
| D8 | Triển khai **cách A**: bản tối thiểu dùng được trước, mở rộng theo đợt |

**Không làm (cố ý):** không XP, không năng lượng, không bảng xếp hạng, không streak mới cho Học Thuộc (Luyện Tập vốn "không tính XP"; tránh game hoá — xem memory post-release feedback). Không cho khách (guest) — cần đăng nhập để lưu danh sách.

---

## 2. Thiết kế Đợt 1

### 2.1 Dữ liệu (Flyway V71)

**`bible_verses`** — toàn văn, read-only sau import
```
id VARCHAR(36) PK            -- UUID.nameUUIDFromBytes("bible|version|book|chapter|verse") (deterministic)
version VARCHAR(16)          -- 'BTTHD2011'
book VARCHAR(40)             -- English key như questions.book ("Genesis", "1 Samuel", "Song of Songs")
book_order TINYINT           -- 1..66 theo BibleStructure
chapter SMALLINT, verse SMALLINT
text TEXT NOT NULL
created_at, updated_at
UNIQUE uk_bv_ref (version, book, chapter, verse)
INDEX idx_bv_chapter (version, book_order, chapter, verse)
```

**`user_memory_verses`** — danh sách câu của tôi + trạng thái ôn
```
id VARCHAR(36) PK (UUID.randomUUID)
user_id VARCHAR(36) FK users ON DELETE CASCADE
version VARCHAR(16), book VARCHAR(40), chapter SMALLINT, verse_start SMALLINT, verse_end SMALLINT
mastery_level TINYINT NOT NULL DEFAULT 0      -- 0..5
next_review_at TIMESTAMP NOT NULL             -- thêm mới = now (đến hạn ngay)
last_reviewed_at TIMESTAMP NULL
review_count INT NOT NULL DEFAULT 0, lapse_count INT NOT NULL DEFAULT 0
created_at, updated_at
UNIQUE uk_umv_ref (user_id, version, book, chapter, verse_start, verse_end)
INDEX idx_umv_due (user_id, next_review_at)
```
Ràng buộc nghiệp vụ (service): `verse_end - verse_start ≤ 4` (tối đa 5 câu/đoạn), cả đoạn phải tồn tại trong `bible_verses`.

### 2.2 Import toàn văn

- File seed: `apps/api/src/main/resources/seed/bible/btthd2011/<book_order>-<book>.json`, mỗi file là mảng `{ "chapter": 3, "verse": 16, "text": "..." }` (book lấy từ tên file → không lặp 31k lần).
- `BibleTextImporter` (`infrastructure/seed/bible`): gate `app.seeding.bible.enabled=${BIBLE_IMPORT_ENABLED:false}`, chạy `ApplicationReadyEvent`, nuốt exception (như QuestionSeeder).
- Idempotent + nhanh: mỗi sách → nếu `count(version, book)` == số câu trong file thì **bỏ qua**; ngược lại `JdbcTemplate.batchUpdate` với `INSERT ... ON DUPLICATE KEY UPDATE text=VALUES(text)`, 1 transaction/sách. KHÔNG `existsById` từng dòng.
- Kiểm tra cấu trúc: log WARN nếu số chương/câu lệch `BibleStructure` (versification VN có thể khác nhẹ — không chặn import).
- ⚠️ **Phụ thuộc dữ liệu**: repo chưa có file toàn văn BTTHĐ 2011. Task HT-4 chuyển đổi từ nguồn user cung cấp → **BLOCKED cho tới khi có file** (hỏi user định dạng: JSON/USFM/XML/SQL…). Mọi task khác dùng fixture giả (text rõ ràng là giả, KHÔNG bịa câu Kinh Thánh).

### 2.3 Lịch ôn giãn cách (`MemorySchedule`, pure function)

| Level | Dạng bài Đợt 1 | Khoảng cách tới lần ôn kế nếu ĐẠT |
|---|---|---|
| 0 | Sắp xếp cụm lớn (3–4 chữ/cụm) | +1 ngày → lên L1 |
| 1 | Sắp xếp cụm nhỏ (2 chữ/cụm) | +2 ngày → L2 |
| 2 | Điền khuyết 25% | +4 ngày → L3 |
| 3 | Điền khuyết 50% | +7 ngày → L4 |
| 4 | Điền khuyết 75% | +14 ngày → L5 |
| 5 | Điền khuyết 100% | +30 ngày (giữ L5) |

- ĐẠT ở level L: `next = now + khoảng cách của hàng L` (L0→1, L1→2, L2→4, L3→7, L4→14, L5→30 ngày), rồi `level = min(L+1, 5)`; `review_count++`.
- CHƯA ĐẠT: `level = max(level-1, 0)`, `next = now + 10 phút` nếu level mới = 0, ngược lại `+1 ngày`; `lapse_count++`, `review_count++`.
- "Đến hạn" = `next_review_at <= now`. Phiên ôn lấy tối đa **10** câu đến hạn, cũ nhất trước.
- Đợt 2 sẽ đổi L4–5 sang "gõ chữ cái đầu" và chen "nhớ địa chỉ" — chỉ đổi bảng map level→dạng bài ở FE, không đổi schema.

### 2.4 API (theo idiom codebase: controller trong `com.biblequiz.api`, resolve user qua `Principal`, body `Map`/record, lỗi `{success:false,message}`)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/bible/passage?book&chapter&from&to` | Trả `{version, book, chapter, verses:[{verse,text}]}`; `to-from ≤ 29`; 404 nếu không có |
| GET | `/api/me/memory-verses` | Danh sách: `{items:[{id, book, chapter, verseStart, verseEnd, text, masteryLevel, nextReviewAt, due}] , dueCount}` |
| GET | `/api/me/memory-verses/due` | Tối đa 10 câu đến hạn (cùng shape item) |
| GET | `/api/me/memory-verses/due-count` | `{dueCount}` — cho thẻ Home |
| POST | `/api/me/memory-verses` | Body `{book, chapter, verseStart, verseEnd}` → 201 item; 400 range/không tồn tại; 409 trùng |
| DELETE | `/api/me/memory-verses/{id}` | 204; 404 nếu không phải của mình |
| POST | `/api/me/memory-verses/{id}/review` | Body `{exerciseType, passed}` → item đã cập nhật (level, nextReviewAt) |

Chấm điểm bài tập làm ở **FE** (pure utils); BE chỉ nhận `passed`. Chấp nhận client tự khai vì không có điểm/XP/xếp hạng → không có động cơ gian lận.

### 2.5 Frontend

- Routes (trong AppLayout, `RequireAuth`, lazy): `/practice/memorize` (danh sách) · `/practice/memorize/add` (chọn câu) · `/practice/memorize/session` (phiên ôn).
- **Danh sách**: mỗi câu = thẻ (địa chỉ `useBookName`, trích 2 dòng, level 0–5 dạng chấm, "đến hạn"/"ôn lại sau N ngày", nút xoá). Nút "Ôn N câu đến hạn" + "Thêm câu". Empty state gợi ý vài câu phổ biến (Giăng 3:16, Thi Thiên 23:1, Phi-líp 4:13, Rô-ma 8:28, Châm Ngôn 3:5-6) — bấm để thêm, text lấy từ API (không hardcode nội dung câu).
- **Chọn câu**: Sách (`SearchableSelect` + `/api/books`) → Chương (`getChapterCount`) → Câu từ/đến (`getVerseCount`, tối đa 5) → xem trước bằng `/api/bible/passage` → "Thêm vào danh sách".
- **Phiên ôn** (`useMemorizeSession` hook giữ hàng đợi + trạng thái): mỗi câu: (1) màn ngữ cảnh — đoạn ±2 câu xung quanh, câu gốc tô đậm, nút "Bắt đầu"; (2) bài tập theo level; (3) kết quả đạt/chưa + câu đúng đầy đủ → POST review → câu kế. Cuối phiên: tóm tắt (đã ôn N, lên cấp M), không điểm.
- **Bài tập** (không thêm dependency — tap-to-place, hợp mobile/Capacitor):
  - `PhraseOrderExercise`: cụm xáo trộn ở dưới, chạm để đưa lên dòng trả lời, chạm dòng trả lời để trả về; đạt nếu sai ≤ 1 lần.
  - `ClozeExercise`: câu với ô trống; ngân hàng chữ = chữ bị ẩn + 2 chữ nhiễu lấy từ đoạn xung quanh; chạm chữ để điền ô đang chọn; đạt nếu số lần sai ≤ max(1, 10% số ô).
- **Utils thuần** `src/utils/memorize/`: `tokenize` (tách theo khoảng trắng, giữ dấu câu dính chữ, so khớp bỏ dấu câu + không phân biệt hoa thường), `chunkPhrases`, `pickClozeIndices(tokens, ratio, seed)` (ưu tiên chữ dài/không phải dấu câu, deterministic theo seed để test), `gradeOrder`, `gradeCloze`, `exerciseForLevel`.
- **Lối vào**: Practice — thẻ "Học Thuộc câu gốc" theo mẫu banner "retry wrong" (Practice.tsx đã 658 LOC → tách thành component riêng, không phình file). Home — `MemoryDueCard` sau `VerseLightwell`, chỉ render khi `dueCount > 0`.
- 3 trạng thái mỗi màn: Skeleton / lỗi + thử lại (banner `bg-bq-ruby/10` như codebase) / thành công. Token Khung Sáng (`bq-*`, `font-literata` cho text câu gốc).
- i18n namespace `memorize.*` (vi + en); `validate:i18n` không tăng.

### 2.6 Test strategy
- BE: unit Mockito cho `MemorySchedule`, `MemoryVerseService`, `BiblePassageService`, `BibleTextImporter` (fixture giả); `@WebMvcTest` + `BaseControllerTest` cho 2 controller. (Repo test profile = H2, không Testcontainers — theo codebase thực tế.)
- FE: Vitest cho utils (nhiều case), 2 exercise component, 3 page, hook session, 2 thẻ lối vào.
- E2E: module mới **W-M16 Memorize** (`/practice/memorize*`) — TC spec + Playwright smoke/happy **trước** khi code page (E2E Test Gate); cập nhật `tests/e2e/INDEX.md` + `TC-TODO.md`.
- Tầng 3 trước mỗi commit; baseline `.test-baseline` không giảm.

---

## 3. Tasks — Đợt 1

- HT-0 Plan + DECISIONS entry + TODO index
  - Status: [x] DONE · Files: `docs/todo/active/2026-09-15-hoc-thuoc-cau-goc.md`, `DECISIONS.md`, `TODO.md` · Test: n/a (docs)
  - **Spec impact**: [x] None (spec ở HT-1)
  - **Spec strategy**: [x] (c) [no-spec-impact]
  - Checklist: plan · decision log · index row · commit

- HT-1 SPEC_USER: §5.1.1 Học Thuộc + §27.20 endpoints
  - Status: [x] DONE · Files: `docs/spec/SPEC_USER_v3.1.md` · Test: `bash tools/spec-audit/audit.sh` → broken 102 = trước khi sửa (không NEW)
  - **Spec impact**: [x] SPEC_USER §5.1.1, §27.20
  - **Spec strategy**: [x] (a) update inline
  - Checklist: spec theo §2 file này · audit no NEW broken · commit `docs: update SPEC_USER §5.1.1 Học Thuộc`

- HT-2 Flyway V71 + entity/repo `BibleVerse`
  - Status: [x] DONE · Files: `db/migration/V71__bible_verses_and_memory_verses.sql` (cả 2 bảng), `modules/bible/entity/BibleVerse.java`, `modules/bible/repository/BibleVerseRepository.java` · Test: `BibleVerseTest` 4/4 (id deterministic + schema-lock V71); V71 chạy sạch trên MySQL 8 container tạm (stub `users`). BE Tầng 3: 899 run, 3 fail **có sẵn trên main** (`StreakServiceTest` ×3, baseline 895/3 fail trước khi đổi code — không thuộc module này, không sửa)
  - **Spec impact**: [ ] None (đã ở HT-1) · **Spec strategy**: [x] (c)
  - Checklist: impl · Tầng 1+2+3 pass · commit

- HT-3 Entity/repo `UserMemoryVerse`
  - Status: [x] DONE · Files: `modules/memorize/entity/UserMemoryVerse.java`, `modules/memorize/repository/UserMemoryVerseRepository.java` (findAllByUserId, findDue, countDue, findOwned, existsRef) · Test: `UserMemoryVerseRepositoryTest` 5/5 (schema-lock JPQL). BE Tầng 3: 904 run, chỉ 3 fail có sẵn. ⚠️ JPQL chỉ được Spring validate lúc boot → kiểm bằng boot app trên MySQL tạm ở HT-9
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-4 `BibleTextImporter` (gated, batch, idempotent)
  - Status: [ ] TODO · Files: `infrastructure/seed/bible/BibleTextImporter.java`, `application.yml` (flag), test fixture `src/test/resources/seed/bible-fixture/` · Test: `BibleTextImporterTest` (skip khi đủ, upsert khi thiếu, WARN lệch cấu trúc)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-5 Chuyển đổi dữ liệu BTTHĐ 2011 → seed JSON + import dev + verify
  - Status: [!] BLOCKED — chờ user cung cấp file toàn văn + định dạng · Files: script `scripts/bible/convert_btthd2011.*`, `seed/bible/btthd2011/*.json` · Test: đếm câu/sách vs `BibleStructure`, soát ngẫu nhiên 20 câu với bản in
  - **Spec strategy**: [x] (c) · Checklist: convert · verify · commit

- HT-6 `BiblePassageService` + `GET /api/bible/passage`
  - Status: [ ] TODO · Files: `modules/bible/service/BiblePassageService.java`, `api/BibleController.java` · Test: service unit + `BibleControllerTest`
  - **Spec strategy**: [x] (c) (spec đã ở HT-1) · Checklist: impl · Tầng 1+2+3 · commit

- HT-7 `MemorySchedule` (pure SRS)
  - Status: [ ] TODO · Files: `modules/memorize/service/MemorySchedule.java` · Test: `MemoryScheduleTest` (mọi level × đạt/chưa, clamp 0/5, 10 phút ở L0)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-8 `MemoryVerseService` (add/list/delete/due/dueCount/review)
  - Status: [ ] TODO · Files: `modules/memorize/service/MemoryVerseService.java` · Test: `MemoryVerseServiceTest` (range > 5, câu không tồn tại, trùng, xoá của người khác, review cập nhật đúng)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-9 `MemoryVerseController`
  - Status: [ ] TODO · Files: `api/MemoryVerseController.java` · Test: `MemoryVerseControllerTest` (201/400/404/409/204, unauth 401)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-10 FE api adapter + query keys + hooks
  - Status: [ ] TODO · Files: `src/api/memorize.ts`, `src/api/queryKeys.ts` (thêm domain), `src/hooks/useMemoryVerses.ts`, `src/hooks/usePassage.ts` · Test: `src/hooks/__tests__/useMemoryVerses.test.tsx`
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-11 Utils thuần `src/utils/memorize/*`
  - Status: [ ] TODO · Files: `tokenize.ts`, `exercises.ts` (chunk/cloze/grade/exerciseForLevel) · Test: `src/utils/memorize/__tests__/*.test.ts`
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-12 E2E W-M16: TC spec + Playwright (fail trước)
  - Status: [ ] TODO · Files: `tests/e2e/playwright/specs/smoke/W-M16-memorize.md`, `.../happy-path/W-M16-memorize.md`, `tests/e2e/smoke/web-user/W-M16-memorize.spec.ts`, `tests/e2e/happy-path/web-user/W-M16-memorize.spec.ts`, page object `tests/e2e/pages/MemorizePage.ts`, `INDEX.md`, `TC-TODO.md` · Test: chạy → fail đúng chỗ chưa có UI
  - **Spec strategy**: [x] (c) · Checklist: TC · code · index · commit

- HT-13 `PhraseOrderExercise`
  - Status: [ ] TODO · Files: `src/components/memorize/PhraseOrderExercise.tsx` · Test: component test (đưa lên/trả về, đạt/chưa đạt)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-14 `ClozeExercise`
  - Status: [ ] TODO · Files: `src/components/memorize/ClozeExercise.tsx` · Test: component test
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-15 Trang danh sách `/practice/memorize` + route
  - Status: [ ] TODO · Files: `src/pages/memorize/MemorizeList.tsx`, `src/main.tsx` (⚠️ file nhạy cảm → Tầng 3 ngay), i18n · Test: page test (loading/error/empty+gợi ý/list/xoá)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-16 Trang chọn câu `/practice/memorize/add`
  - Status: [ ] TODO · Files: `src/pages/memorize/MemorizeAdd.tsx` · Test: page test (chọn sách/chương/câu, giới hạn 5, preview, 409 trùng)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-17 Hook `useMemorizeSession`
  - Status: [ ] TODO · Files: `src/hooks/useMemorizeSession.ts` · Test: hook test (hàng đợi, submit review, kết thúc, lỗi mạng giữ câu)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-18 Trang phiên ôn `/practice/memorize/session`
  - Status: [ ] TODO · Files: `src/pages/memorize/MemorizeSession.tsx` (+ `ContextPassage.tsx`, `SessionSummary.tsx` nếu > 300 LOC) · Test: page test
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-19 Lối vào Practice (thẻ Học Thuộc)
  - Status: [ ] TODO · Files: `src/components/memorize/MemorizeEntryCard.tsx`, `src/pages/Practice.tsx` (chỉ chèn 1 dòng) · Test: Practice.test + card test (guest → nhắc đăng nhập)
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-20 Thẻ Home "Câu gốc cần ôn hôm nay"
  - Status: [ ] TODO · Files: `src/components/memorize/MemoryDueCard.tsx`, `src/pages/Home.tsx` (chèn sau VerseLightwell) · Test: card test (ẩn khi 0, hiện N) + Home.test
  - **Spec strategy**: [x] (c) · Checklist: impl · Tầng 1+2+3 · commit

- HT-21 E2E xanh + full regression + đóng Đợt 1
  - Status: [ ] TODO · Files: — · Test: Playwright W-M16 pass, Tầng 3 đủ, `validate:i18n`, `audit.sh`
  - **Spec strategy**: [x] (c) · Checklist: regression · cập nhật baseline · move file sang archive (sau khi merge) · cập nhật TODO.md

**Thứ tự khi HT-5 còn BLOCKED:** làm HT-1 → HT-4, HT-6 → HT-21 với fixture; HT-5 chèn vào khi có file. Không deploy prod Học Thuộc trước khi HT-5 xong.

---

## 4. Đợt sau (chưa thành task)

- **Đợt 2**: dạng bài gõ chữ cái đầu (L4–5), nhớ địa chỉ câu (chen giữa phiên); tìm câu theo từ khoá.
- **Đợt 3**: câu quiz sẵn có cùng chương (dùng `questions.book/chapter/verse_start`); giải thích AI (Gemini, cache dùng chung theo đoạn, nhãn "Do AI tóm tắt", nút báo sai → hàng duyệt admin).
- **Mở / cần chốt sau**: bản EN cho người dùng tiếng Anh (C4 50/50 — cần bản public domain như WEB/KJV); nối vào "Cùng nhau thuộc Lời" của Nhóm (BL-23) khi đo được mức dùng; nhắc ôn qua notification/push.
- **Đo sau khi ra mắt**: % user thêm ≥1 câu · % quay lại ôn ngày thứ 2/7 · số câu lên L3+ — dùng `user_memory_verses` (không cần bảng log mới cho Đợt 1).
