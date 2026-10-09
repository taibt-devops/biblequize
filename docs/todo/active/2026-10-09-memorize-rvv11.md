# 2026-10-09 — Học Thuộc dùng toàn văn RVV11 (MRV)

> **Source**: user 09/10/2026: "Học Thuộc dùng toàn văn RVV11" (trả lời câu hỏi giữ BTT 1926 hay dùng RVV11; quyền dùng nguyên văn đã xác nhận ở DECISIONS 2026-09-15 D2). · **Scope**: `scripts/bible/rvv11_to_seed.py`, bộ đọc RVV11 trong `content/easy-core/build.py` (khối gộp), `seed/bible/rvv11/` (thay `btt1926/`), `BibleVerse` (`RVV11`, `verse_end`), `BibleTextImporter`, `BiblePassageService` (+ `chapterVerses`), `BibleController` (`GET /api/bible/verses`), `MemoryVerseService` (nới đoạn theo khối gộp), V75, web `MemorizeAdd` / `ContextPassage` / `rangeEndOptions`, FAQ trang Câu đố. KHÔNG đổi Đấu Hạng, Luyện Tập, bộ câu hỏi.

### Tasks
- MRV-1 Toàn văn RVV11 làm seed
  - Status: [x] DONE · 1.189/1.189 chương, 0 lỗi tải · 66 file, **31.086 dòng**, 4 khối gộp, 41 khác biệt (`DIFFERENCES.md`: 15 câu Tân Ước RVV11 lược, đánh số kiểu Hê-bơ-rơ ở Dân Số Ký 29–30, 1 Sa-mu-ên 20/23–24, 1 Các Vua 22, Gióp 38–41, Ê-sai 8–9, Ê-xê-chi-ên 20–21, Ô-sê 11–12, Giô-na 1–2, Mi-chê 4–5, 2 Cô-rinh-tô 13, 3 Giăng, Khải Huyền 12), 0 lỗi chữ · bỏ `seed/bible/btt1926/` · tải từ kinhthanh.httlvn.org (`?v=RVV11`, 1,5 giây/trang, cache `content/easy-core/.cache/rvv11/`) · sửa bộ đọc: khối gộp `class="verse phu_13_17 phu_13_18"` trước đây bị bỏ cả khối (mất chữ), nay lưu ở câu đầu + `merged` · `rvv11_to_seed.py check|write` → 66 file `NN-Book.json` + `DIFFERENCES.md`; chặn khi chữ rỗng, sót markup, chương không có câu · `BibleSeedContentTest` kiểm theo RVV11: chương ngoài danh sách khác biệt phải khớp `BibleStructure`
  - **Spec impact**: [x] SPEC_USER §5.1.1
  - **Spec strategy**: [x] (a) update inline
- MRV-2 Backend theo cách đánh số của RVV11
  - Status: [x] DONE · `ACTIVE_VERSION = "RVV11"`; `bible_verses.verse_end` (khối gộp) · `getPassage`: câu cuối chương lấy từ dữ liệu (Giô-na 2:11, 1 Sa-mu-ên 20:43 hợp lệ), trả trọn khối gộp chạm vào đoạn · `GET /api/bible/verses` cho bộ chọn câu · thêm câu: nới đoạn ra trọn khối gộp, từ chối đoạn bắc qua câu RVV11 lược · V75: thêm cột, chuyển `user_memory_verses` BTT1926 → RVV11 (giữ địa chỉ, lịch ôn), xóa chữ 1926 · Test: `BiblePassageServiceTest` 9, `MemoryVerseServiceTest` +2, `BibleControllerTest` +2, `BibleTextImporterTest` +1, fixture BTT1926 → RVV11
  - **Spec impact**: [x] SPEC_USER §5.1.1
  - **Spec strategy**: [x] (a) update inline
- MRV-3 Web
  - Status: [x] DONE · `MemorizeAdd` lấy danh sách câu từ `/api/bible/verses` (khối gộp là một lựa chọn "17-18"; chọn khối thì "đến câu" là cuối khối) · `rangeEndOptions` dừng ở câu bị lược · nhãn "17-18" ở xem trước và khung ngữ cảnh · FAQ + trang Câu đố: "Bản Truyền Thống Hiệu Đính 2010 (RVV11)" · Test: `MemorizeAdd.test` +2, `schedule.test` +3; vùng memorize 88/88
  - **Spec impact**: [x] SPEC_USER §5.1.1
  - **Spec strategy**: [x] (a) update inline
- MRV-4 Lên prod
  - Status: [x] DONE 09/10 · commit `210f23dc`, BE `sha256:34fb410c…` (rollback `6985a2b6…`), FE `sha256:c51aa951…` (rollback `9f45ee0b…`) · V75 áp 07:55 · nạp một lần qua `/tmp/bible-once.yml` → `[bible-import] done, 31086 verses written` (~7 phút), rồi về `BIBLE_IMPORT_ENABLED=false` · `/api/public/bible/status` = `{"version":"RVV11","available":true}` → **Học Thuộc hiện lại trên prod** · DB: 31.086 dòng / 66 sách / 4 khối gộp; `user_memory_verses` 2 dòng → RVV11 · gọi thật (token ký tạm trong máy chủ, chỉ đọc): `/api/bible/verses` Phục Truyền Luật Lệ Ký 13 có khối 17-18; passage 13:18 → trả trọn 17-18; Giô-na 2:10-11 có câu 11; Ma-thi-ơ 17:20-22 trả 20, 22 (không có 21); danh sách câu gốc hiện chữ RVV11
  - User xác nhận được đăng toàn văn RVV11 vào repo công khai (DECISIONS 2026-10-09)
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]

### Ghi chú
- `VerseFooter` (câu Kinh Thánh hằng ngày) ghi nguồn "BTTHĐ 2011" nhưng chữ trong `data/verses.ts` là bản cũ — làm sau.
