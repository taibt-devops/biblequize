# 2026-09-15 — Flyway drift: thiếu cột `user_daily_progress.asked_question_ids`

> **Source**: phát hiện khi boot thử nhánh Học Thuộc (HT-9) trên DB trống với `ddl-auto: none` · **Scope**: 1 migration idempotent, không đổi entity/behavior.
> **Branch/worktree**: `fix/flyway-schema-drift` @ `../biblequize-flyway-fix`

## Chẩn đoán

- Entity `UserDailyProgress.askedQuestionIds` → cột `asked_question_ids JSON` — **không migration nào tạo**.
- DB trống + `ddl-auto: none` (cấu hình prod) → mọi truy vấn UDP lỗi `Unknown column 'udp1_0.asked_question_ids'`; khi test-data seeder bật thì app chết lúc startup.
- Dò toàn bộ drift (2 DB tạm: Flyway-only vs Flyway + Hibernate `update`, diff `information_schema`): **đây là cột duy nhất bị thiếu**. Các khác biệt còn lại chỉ là kiểu cột (vd varchar(100) vs 255) — không gây lỗi runtime, ngoài phạm vi.
- **Prod đã có cột** (`json`, NULL, do từng chạy `ddl-auto: update`), flyway ở V70 → migration phải idempotent.

## Tasks

- FWD-1 Migration V71 thêm cột nếu chưa có
  - Status: [x] DONE · Kết quả trên MySQL 8 container tạm: (1) jar cũ + DB trống + test-data → 72 migration, app chết "Application run failed", 4 lỗi Unknown column; (2) jar mới + DB trống → 73 migration, app chạy, seeder tạo 1185 UDP; (3) jar mới trên DB mô phỏng prod (V70 + cột đã có) → V71 success, cột giữ `json NULL`. `UserDailyProgressMigrationTest` 2/2; BE Tầng 3 897 run, chỉ 3 fail có sẵn (`StreakServiceTest`) · Files: `db/migration/V71__add_asked_question_ids_to_user_daily_progress.sql`, test schema-lock · Test: `UserDailyProgressMigrationTest`; boot DB trống `ddl-auto: none` + test-data bật (trước: chết; sau: chạy); chạy trên DB đã có cột (mô phỏng prod V70) → không lỗi; BE Tầng 3
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
  - Checklist: impl · verify 2 kịch bản DB · Tầng 3 BE · commit

- FWD-2 Nhánh `feat/hoc-thuoc-cau-goc`: đổi migration Học Thuộc V71 → V72
  - Status: [x] DONE (commit `322b6db1` trên `feat/hoc-thuoc-cau-goc`) · Files: (nhánh kia) `V72__bible_verses_and_memory_verses.sql`, `BibleVerseTest` · Test: `BibleVerseTest` 4/4, BE Tầng 3 nhánh kia 949 run / 3 fail có sẵn. Kiểm bản merge thử 2 nhánh trên DB trống `ddl-auto: none`: Flyway V70 → V71 → V72 success, app chạy, 0 lỗi Unknown column. Merge thật sẽ conflict nhẹ ở `TODO.md` (2 nhánh cùng thêm row)
  - **Spec strategy**: [x] (c) [no-spec-impact]
  - Checklist: rename · test · commit
