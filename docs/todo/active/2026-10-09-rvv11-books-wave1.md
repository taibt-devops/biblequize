# 2026-10-09 — Viết lại câu Trung bình/Khó theo bản RVV11, đợt 1: Sáng Thế Ký + 4 sách Phúc Âm (RVB)

> **Source**: user 09/10/2026: "Giờ bộ câu hỏi chúng ta có hai version kinh thánh luôn, tôi nghĩ nên xóa bộ câu hỏi 1925 đi và làm lại" → đề xuất không xóa mà viết lại từng sách bằng RVV11, xong sách nào thì tắt câu cũ của sách đó; bắt đầu từ Sáng Thế Ký + 4 sách Phúc Âm. User: "tôi đồng ý". · **Scope**: `content/books/` (nguồn từng sách + `build.py`), `seed/questions/rvv11_books_quiz.json`, xóa `genesis/matthew/mark/luke/john_quiz.json` (giữ bản `_en`), `Rvv11BooksSeedTest`. KHÔNG đổi seeder, Đấu Hạng, Luyện Tập, Học Thuộc (vẫn BTT1926), bộ tiếng Anh.

### Tasks
- RVB-1 Quy trình viết và kiểm
  - Status: [x] DONE · `content/books/build.py`: dùng chung bộ đọc RVV11 với `content/easy-core/build.py`; kiểm từng trích dẫn trùng nguyên văn, mã sách đúng, 4 phương án khác nhau, câu hỏi ≤ 26 chữ, đáp án ≤ 10 chữ, không hỏi số chương/câu; xếp đáp án đúng đều A–D · `export` chặn trùng trong bộ, trùng `content_hash` với file seed khác hoặc với câu đã nghỉ hưu (`retired_hashes.txt`), và trùng ý với câu Dễ cốt lõi (cùng câu Kinh Thánh, cùng đáp án) · `retire <file>` ghi hash câu cũ trước khi xóa file · sửa `content_hash` của script khi `verseEnd` là `null` (khớp `IFNULL` trong cột SQL) · luật viết trong `content/books/README.md`
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- RVB-2 Viết 5 sách
  - Status: [x] DONE · 466 câu: Sáng Thế Ký 107 (66 TB / 41 Khó), Ma-thi-ơ 109 (76/33), Mác 74 (45/29), Lu-ca 84 (52/32), Giăng 92 (59/33) · thay 848 câu cũ của 5 sách (cả Dễ, Trung bình, Khó; câu Dễ của 5 sách giờ là 483 câu Dễ cốt lõi) · tránh lặp ý bộ Dễ; ưu tiên chi tiết riêng của từng sách Phúc Âm (vd Mác: Bô-a-nẹt, Ta-li-tha-cum, gà gáy hai lượt; Lu-ca: Si-lô-ê, Cơ-lê-ô-pa; Giăng: Man-chu, 153 con cá) · phương án nhiễu cho phép gần đúng (nhân vật/nơi chốn khác trong sách) nhưng chỉ một đáp án đúng theo RVV11
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- RVB-3 Gỡ bộ cũ khỏi repo + test
  - Status: [x] DONE · `git rm` 5 file seed tiếng Việt cũ (848 câu, hash lưu ở `content/books/retired_hashes.txt`) · `Rvv11BooksSeedTest` (2): mọi câu là vi, medium/hard, 4 phương án, có tag RVV11, không hỏi số câu; không trùng `content_hash` với file seed khác · chạy kèm `StoryCatalogTest`, `QuestionSeeder*Test`: 42 test xanh
  - Lưu ý: môi trường bật `sync-stale` (mặc định của seeder, vd máy dev) sẽ **xóa cứng** 848 hàng cũ (kèm lịch sử trả lời) ở lần khởi động có seed đủ file. Prod tắt `sync-stale` và tắt seed → làm tay ở RVB-4.
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- RVB-4 Lên prod
  - Status: [x] DONE 09/10 · commit `1e940782`, BE `sha256:0be255f8…` (rollback `sha256:88207c60…`) · seed một lần chỉ `rvv11_books_quiz.json`, `sync-stale=false`: inserted=466, dupHash=0, staleDeleted=0 · 848/848 hash khớp (toàn `seed:json`, đang bật, không lẫn sách/ngôn ngữ khác) → sao lưu `questions_bak_20261009_rvv11_w1` (id, is_active) rồi `is_active=0` cho 848 hàng
  - Sau khi tắt (đang bật / Dễ cốt lõi / RVV11): Sáng Thế Ký Dễ 156/153, TB 67/66, Khó 41/41 · Ma-thi-ơ 119/119, 79/76, 33/33 · Mác 42/41, 45/45, 29/29 · Lu-ca 111/111, 53/52, 32/32 · Giăng 59/59, 59/59, 33/33. Phần lẻ còn lại: Giáo lý căn bản (`bible_basics`), 3 câu nguồn "Kinh Thánh" của Sáng Thế Ký, 1 câu Lu-ca trong `isaiah_quiz.json` — để nguyên
  - Bật lại nếu cần: `UPDATE questions q JOIN questions_bak_20261009_rvv11_w1 b ON b.id = q.id SET q.is_active = b.is_active;`
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
- RVB-5 Các đợt sau
  - Status: [ ] TODO · đợt 2: 13 sách còn lại của vòng quen thuộc (Xuất Ai Cập Ký, Ru-tơ, 1 Sa-mu-ên, Ê-xơ-tê, Thi Thiên, Châm Ngôn, Đa-ni-ên, Giô-na, Công Vụ, Rô-ma, Ê-phê-sô, Phi-líp, Gia-cơ) → vòng 2 (22 sách) → vòng 3 (26 sách)
  - Chờ user: (a) Học Thuộc giữ BTT1926 có ghi rõ, hay xin phép dùng toàn văn RVV11; (c) bộ tiếng Anh làm lại sau. (b) tên sách giao diện → RVB-6
  - **Spec impact**: [ ] None
  - **Spec strategy**: [ ] (c) [no-spec-impact]
- RVB-6 Tên sách trên giao diện theo RVV11
  - Status: [x] DONE · user 09/10: "đổi sang tên RVV11 cho thống nhất" · nguồn tên: VIE2010 trên bible.com (cùng nguyên văn RVV11; trang HTTLVN dùng tên kiểu 1925 cho mọi bản nên không dùng được) · `V74__books_rvv11_names.sql`: `books.name_vi` Exodus → Xuất Ai Cập Ký, Ezra → E-xơ-ra, Acts → Công Vụ Các Sứ Đồ (cập nhật theo `name`, không sửa `R__data.sql` vì file repeatable đổi checksum sẽ chạy lại trên prod) · web `BIBLE_BOOKS_VI` (trình soạn bộ câu Nhóm): Xuất Ai Cập Ký, Dân Số Ký, Phục Truyền Luật Lệ Ký, Thi Thiên, Công Vụ Các Sứ Đồ; `normalizeBibleBookVi` đổi tên cũ đã lưu sang tên mới (editor, `localizeBibleBook`, `useBookName`) · màn chơi thử: "Xuất Hành" → "Xuất Ai Cập Ký" · Test: `bibleData.test` +2, sửa dữ liệu mẫu 6 file test, `Utf8EncodingTest`
  - Không đổi: lời giải thích/phương án của câu cũ (khoảng 350 chỗ ghi "Xuất Ê-díp-tô Ký", "Thi-thiên"…, kèm tên nước "Ê-díp-tô") — thay hẳn khi viết lại từng sách; bản đồ hành trình giữ nhãn vùng ngắn "Công Vụ"
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
