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
