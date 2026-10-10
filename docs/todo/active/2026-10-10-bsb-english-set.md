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
  - User chơi thử, duyệt giọng văn 10/10: "ok rồi viết tiếp đến khi xong luôn đi"
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-4 Đợt E2: vòng 1, phần Cựu Ước (8 sách)
  - Status: [x] DONE · 387 câu thay 949 câu dịch máy: Xuất Ai Cập Ký 94 (Dễ 54 trên 7 câu chuyện / TB 27 / Khó 13), Ru-tơ 32 (10/15/7), 1 Sa-mu-ên 73 (36 trên 5 câu chuyện / 24 / 13), Ê-xơ-tê 31 (10/14/7), Thi Thiên 50 (21+0 / 20 / 9), Châm Ngôn 35 (7+5 / 15 / 8), Đa-ni-ên 42 (16+3 / 15 / 8), Giô-na 30 (15/10/5) · Thi Thiên gọi tên bài bằng nội dung ("David's shepherd psalm", "the very first psalm") thay vì số · `retired_hashes.txt` 1.199 hash; 1 câu Xuất Ai Cập Ký trùng chữ câu cũ → đổi lời · `bsb_en_quiz.json` 625 câu, 39 câu chuyện có câu tiếng Anh · 55 test xanh
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-5 Đợt E2 lên prod
  - Status: [x] DONE 10/10 · commit `0bfaf0d7`, BE `sha256:94ebf7b0…` (rollback `f8100869…`) · seed `bsb_en_quiz.json`: inserted=387, dupHash=0 · 950 hàng cũ (949 khớp hash + 1 hàng mồ côi Xuất Ai Cập Ký từ bản file cũ, cùng loại dịch máy) · dump `backups/questions-old-en-e2-deleted-20261010.sql.gz` rồi xóa (CASCADE: 68 answers, 6.164 quiz_session_questions) · xóa cache · API Xuất Ai Cập Ký/Ru-tơ/1 Sa-mu-ên/Ê-xơ-tê × 3 mức trả câu BSB · 39 câu chuyện chơi được bằng tiếng Anh
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-6 Đợt E3: vòng 1, phần Tân Ước (9 sách)
  - Status: [x] DONE · 636 câu thay 1.019 câu dịch máy: Ma-thi-ơ 133 (Dễ 86 trên 14 câu chuyện / TB 31 / Khó 16), Mác 69 (35/22/12), Lu-ca 126 (85 trên 13 câu chuyện / 26 / 15), Giăng 87 (47 trên 7 câu chuyện / 27 / 13), Công Vụ 111 (70 trên 10 câu chuyện / 25 / 16), Rô-ma 36 (8/19/9), Ê-phê-sô 29 (15/9/5), Phi-líp 23 (7/10/6), Gia-cơ 22 (8/9/5) · câu thư tín luôn nêu tên thư ("In Romans, Paul says…") · `retired_hashes.txt` 2.218 hash; 2 câu trùng chữ câu cũ → đổi lời · `bsb_en_quiz.json` 1.261 câu, 91 câu chuyện có câu tiếng Anh · test seed xanh
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-7 Đợt E3 lên prod
  - Status: [x] DONE 10/10 · commit `4924b78f`, BE `sha256:4a3172fe…` (rollback `94ebf7b0…`) · seed `bsb_en_quiz.json`: inserted=636, dupHash=0 · 1.019/1.019 hàng cũ khớp hash, không bộ câu/phòng nào tham chiếu · dump `backups/questions-old-en-e3-deleted-20261010.sql.gz` rồi xóa (CASCADE: 143 answers, 10 user_question_history, 5.354 quiz_session_questions) · hàng tiếng Anh: 1.261 BSB + 2.857 cũ; tổng 7.681 câu · API Ma-thi-ơ/Mác/Lu-ca/Giăng × 3 mức trả câu BSB · 91 câu chuyện chơi được bằng tiếng Anh
  - Gotcha: key cache có dấu cách (`questions:1 Samuel:easy`) — `xargs redis-cli del` tách đôi nên không xóa; script đợt sau dùng `while IFS= read -r k`
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-8 Đợt E4: vòng 2, phần Cựu Ước (11 sách)
  - Status: [x] DONE · 439 câu thay 1.079 câu dịch máy: Phục Truyền 40 (14/16/10), Giô-suê 48 (Dễ 19, 14 trên 2 câu chuyện / 18 / 11), Các Quan Xét 45 (18, 15 trên 2 câu chuyện / 16 / 11), 2 Sa-mu-ên 40 (15/16/9), 1 Các Vua 55 (28 trên 4 câu chuyện / 16 / 11), 2 Các Vua 55 (28 trên 4 câu chuyện / 16 / 11), Nê-hê-mi 28 (10/10/8), Gióp 29 (9/12/8), Truyền Đạo 22 (7/10/5), Ê-sai 44 (21 trên 3 câu chuyện / 14 / 9), Giê-rê-mi 33 (11/14/8) · bỏ chi tiết bạo lực (Gia-ên, Bát-sê-ba chỉ hỏi tên chồng, Áp-sa-lôm chỉ hỏi cây) · `retired_hashes.txt` 3.297 hash; 2 câu trùng chữ câu cũ → đổi lời · `bsb_en_quiz.json` 1.700 câu, 110 câu chuyện có câu tiếng Anh · test seed xanh
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- BSB-9 Đợt E4 lên prod
  - Status: [x] DONE 10/10 · commit `91309b67`, BE `sha256:d245f780…` (rollback `4a3172fe…`) · seed: inserted=439, dupHash=0 · 1.080 hàng cũ (1.079 khớp hash + 1 hàng mồ côi Phục Truyền thế hệ cũ, câu hỏi ghi sẵn "Deuteronomy 11:13-14"), không bộ câu/phòng nào tham chiếu · dump `backups/questions-old-en-e4-deleted-20261010.sql.gz` rồi xóa (CASCADE: 61 answers, 6.374 quiz_session_questions) · hàng tiếng Anh: 1.700 BSB + 1.777 cũ; tổng 7.040 câu · cache sạch (`cache_left=0`) · API Phục Truyền/Giô-suê/Các Quan Xét/2 Sa-mu-ên × 3 mức trả câu BSB · 110 câu chuyện chơi được bằng tiếng Anh
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
