# 2026-10-09 — Luyện Tập theo câu chuyện + nạp bộ "Dễ cốt lõi" (PBS)

> **Source**: user 09/10/2026: "Các câu chuyện này đưa vào phần luyện tập luôn, kiểu có thể lựa chọn luyện tập theo sách hay theo câu chuyện". Bộ câu: `content/easy-core/` (120 chuyện, 1.095 câu Dễ, trích nguyên văn RVV11; trang chơi thử https://claude.ai/artifact/3Te8sBbgGzWYQd3oMfwLEo). · **Scope**: cột `questions.story` (V73), `QuestionSeeder`, `StoryCatalog` + `GET /api/public/stories`, `GET /api/questions?story=`, `POST /api/sessions` `story`, Practice.tsx, `SearchableSelect` (`hideAll`, `searchPlaceholder`). KHÔNG đụng Smart Selection, Đấu Hạng (câu mới vào kho Dễ như câu thường).

### Tasks
- PBS-1 Viết đủ 120 chuyện
  - Status: [x] DONE · đợt 10–12 (Ghết-sê-ma-nê → Khải Huyền 22) · `build.py` kiểm từng trích dẫn với RVV11 · `stories.md` đủ ✓
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- PBS-2 Xuất bộ câu vào app
  - Status: [x] DONE · `build.py export` → `seed/questions/easy_core_quiz.json` (mỗi câu thêm `story`) + `seed/stories/stories.json` (120 chuyện) · kiểm: id chuyện duy nhất, câu nào cũng có chuyện, chuyện nào cũng có câu, không trùng `content_hash` trong bộ và với file seed khác · sửa 3 câu trùng giữa "Sáng tạo" và "Vườn Ê-đen" (thay bằng ý chương 3), 1 câu ma-na trùng chữ câu Khó cũ, 1 câu Nô-ê trùng ý ở Hê-bơ-rơ 11
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- PBS-3 Backend
  - Status: [x] DONE · V73 `questions.story` + `idx_questions_story` (idempotent như V71) · `SeedQuestion.story`, seeder ghi/so sánh `story` (không vào id nên gắn chuyện = UPDATE tại chỗ) · `StoryCatalog` · `PublicStoryController` · `QuestionService.getStoryQuestions`/`countQuestionsByStory` · `/api/questions?story=` · `CreateSessionRequest.story` (`^[a-z0-9-]+$`) · `SessionService`: có `story` (chỉ Practice) → cả chuyện, bỏ Smart Selection, chuyện rỗng → 400 · Phiên gần đây trả `story` · Test: `StoryCatalogTest` 6 (đối chiếu file seed thật), `PublicStoryControllerTest` 2, `QuestionControllerTest` +1, `SessionControllerTest` +3, `SessionServiceTest` +4, `QuestionSeederTest` +2 · sửa test cũ `submitAnswer_practiceMode_tier1…` so ngày UTC (đỏ mỗi đêm 00:00–07:00 giờ VN) sang `GameClock.today()`
  - **Spec impact**: [x] SPEC_USER §5.1
  - **Spec strategy**: [x] (a) update inline
- PBS-4 Màn Luyện Tập
  - Status: [x] DONE · nút "Theo sách / Theo câu chuyện" · chọn chuyện (tìm kiếm) + 6 chuyện quen thuộc chọn nhanh + thẻ xem trước (tham chiếu, Cựu/Tân Ước, số câu) · ẩn số câu/độ khó/chương-câu; giữ thời gian + giải thích · khách chơi được · Phiên gần đây hiện tên chuyện · tiếng Anh: báo chỉ có tiếng Việt · Test: Practice +6, SearchableSelect +1, i18n parity
  - **Spec impact**: [x] SPEC_USER §5.1
  - **Spec strategy**: [x] (a) update inline
- PBS-5 Deploy prod (cura-dev) + nạp câu
  - Status: [x] DONE 09/10 · commit `4159d791`, BE `sha256:88207c60…`, FE `sha256:50e5d9ec…`; rollback BE `sha256:80a8662b…`, FE `sha256:643967c9…` · V73 áp 0,5 s · sao lưu `backups/questions_20261009_pre_v73.sql.gz` (cura-dev, thư mục compose)
  - Prod để `QUESTION_SEEDING_ENABLED=false`, nên seed một lần: `docker compose -f compose.yml -f /tmp/seed-once.yml up -d --force-recreate api` với `QUESTION_SEEDING_ENABLED=true` + `QUESTION_SEEDING_PATTERN=classpath*:seed/questions/easy_core_quiz.json` (`SYNC_STALE` vẫn `false`) → `inserted=1095, dupHash=0, staleDeleted=0`; rồi recreate lại bằng compose gốc (seeding tắt)
  - Kiểm: 1.095 câu có `story`, 120 chuyện, đều bật · câu Dễ `vi` đang bật 1.879 → 2.974 · `GET https://be.forbible.org/api/public/stories` 120 chuyện, không chuyện nào 0 câu · khách chơi "Nô-ê và trận lụt" trên forbible.org: 10 câu
  - Hoàn tác dữ liệu: `DELETE FROM questions WHERE story IS NOT NULL;` (chỉ bộ này có `story`; xoá kéo theo lịch sử trả lời các câu đó)
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]

### Theo dõi sau deploy
- Đo tỷ lệ đúng của bộ mới sau 2–4 tuần (đích ≥ 80%), tách theo chuyện để sửa chuyện khó bất thường.
- Bộ Dễ cũ vẫn mang nhãn Dễ sai (đo 08/10: Dễ 50% đúng); dán nhãn lại riêng.
