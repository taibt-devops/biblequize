# 2026-10-09 — Học Thuộc dùng toàn văn RVV11 (MRV)

> **Source**: user 09/10/2026: "Học Thuộc dùng toàn văn RVV11" (trả lời câu hỏi giữ BTT 1926 hay dùng RVV11; quyền dùng nguyên văn đã xác nhận ở DECISIONS 2026-09-15 D2). · **Scope**: `scripts/bible/rvv11_to_seed.py`, bộ đọc RVV11 trong `content/easy-core/build.py` (khối gộp), `seed/bible/rvv11/` (thay `btt1926/`), `BibleVerse` (`RVV11`, `verse_end`), `BibleTextImporter`, `BiblePassageService` (+ `chapterVerses`), `BibleController` (`GET /api/bible/verses`), `MemoryVerseService` (nới đoạn theo khối gộp), V75, web `MemorizeAdd` / `ContextPassage` / `rangeEndOptions`, FAQ trang Câu đố. KHÔNG đổi Đấu Hạng, Luyện Tập, bộ câu hỏi.

### Tasks
- MRV-1 Toàn văn RVV11 làm seed
  - Status: [ ] IN PROGRESS · tải 1.189 chương từ kinhthanh.httlvn.org (`?v=RVV11`, 1,5 giây/trang, cache `content/easy-core/.cache/rvv11/`) · sửa bộ đọc: khối gộp `class="verse phu_13_17 phu_13_18"` trước đây bị bỏ cả khối (mất chữ), nay lưu ở câu đầu + `merged` · `rvv11_to_seed.py check|write` → 66 file `NN-Book.json` + `DIFFERENCES.md`; chặn khi chữ rỗng, sót markup, chương không có câu · `BibleSeedContentTest` kiểm theo RVV11: chương ngoài danh sách khác biệt phải khớp `BibleStructure`
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
  - Status: [ ] TODO · deploy BE + FE (V75 chạy lúc khởi động) → nạp một lần (`BIBLE_IMPORT_ENABLED=true` qua file override, rồi về `false`) → `GET /api/public/bible/status` = `available:true` → Học Thuộc hiện lại cho người dùng → kiểm Giăng 3:16, khối gộp Phục Truyền Luật Lệ Ký 13:17-18, Giô-na 2:11
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]

### Ghi chú
- `VerseFooter` (câu Kinh Thánh hằng ngày) ghi nguồn "BTTHĐ 2011" nhưng chữ trong `data/verses.ts` là bản cũ — làm sau.
