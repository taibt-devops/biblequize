# Bộ câu tiếng Anh viết mới theo Berean Standard Bible (BSB)

> Quyết định: DECISIONS 2026-10-10 "Bộ câu tiếng Anh: Berean Standard Bible, viết mới độc lập". Luật viết và lệnh: `content/en/README.md`.

### Tasks

- BSB-1 Công cụ + tên câu chuyện tiếng Anh
  - Status: [x] DONE 10/10 · `content/en/build.py` (kiểm trích dẫn với `bsb_vpl.txt` 31.086 câu, luật độ dài, A–D, không trùng hash với seed khác hoặc câu đã retire, `story` phải có trong `stories_en.json`) · `stories_en.json` 120 tên + tham chiếu tiếng Anh; `content/easy-core/build.py export` ghép thành `titleEn`/`refEn` trong `stories.json` · `StoryCatalog.Story` thêm `titleEn`/`refEn` + `title(language)`/`ref(language)`; `PublicStoryController` trả tên theo `language` (tiếng Anh thiếu thì về tiếng Việt) · Test: `BsbEnSeedTest` (mới, 3), `StoryCatalogTest` +1, `PublicStoryControllerTest` +1
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-2 Đợt thử: Sáng Thế Ký
  - Status: [x] DONE · 238 câu thay 250 câu dịch máy cũ: Dễ 119 (17 câu chuyện cốt lõi, 5–10 câu mỗi chuyện), TB 76, Khó 43 · `retired_hashes.txt` 250 hash · `git rm genesis_quiz_en.json` · 54 test xanh
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-3 Đợt thử lên prod
  - Status: [x] DONE 10/10 · commit `9568ec8b`, BE `sha256:f8100869…` (rollback `a180d892…`) · seed một lần `bsb_en_quiz.json`, `sync-stale=false`: inserted=238, dupHash=0 · 250/250 hàng tiếng Anh cũ của Sáng Thế Ký khớp 250 hash retire, không bộ câu/phòng nào tham chiếu · dump `backups/questions-old-en-genesis-deleted-20261010.sql.gz` rồi xóa (CASCADE: 22 answers, 1 user_question_history, 2.495 quiz_session_questions) · xóa cache `questions:*` · `GET /api/questions?book=Genesis&language=en` × 3 mức trả câu BSB · `/api/public/stories?language=en`: 17 câu chuyện chơi được, tên tiếng Anh ("Creation", "Noah and the Flood"…)
  - Chờ user chơi thử giọng văn trước khi viết tiếp các sách khác
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
