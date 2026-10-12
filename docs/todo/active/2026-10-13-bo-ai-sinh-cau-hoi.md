# 2026-10-13 — Bỏ sinh câu hỏi bằng AI

> **Source**: user 13/10/2026: "bỏ giúp tôi phần AI, tức là sinh câu hỏi bằng AI" · **Scope**: apps/api (module `adminai`, `userquiz` generator, AI endpoints ở nhóm / bộ câu của tôi / Đấu nhanh, dashboard + health) + apps/web (trang Quản trị "AI tạo câu hỏi", gợi ý AI khi sửa câu, AI trong trình soạn bộ câu nhóm + Bộ câu của tôi, nguồn AI ở Đấu nhanh, `aiApi`)

**Giữ nguyên (không xóa dữ liệu):** câu hỏi đã có trong kho (kể cả câu từng do AI soạn), bảng/cột DB (`rooms.ai_questions_payload`, cột nguồn câu…), phòng cũ có nguồn `AI_GENERATED` vẫn đọc được (enum giữ để không vỡ dữ liệu cũ, không tạo mới).

### Tasks
- AIR-1 Phòng chơi / Đấu nhanh: bỏ nguồn câu AI (BE + web) — Status: [x] DONE
- AIR-2 Bộ câu của tôi: bỏ AI tạo câu, AI viết lại, hạn mức AI, API sinh câu cũ (BE + web) — Status: [x] DONE
- AIR-3 Bộ câu nhóm: bỏ AI tạo câu, AI viết lại, hạn mức AI (BE + web) — Status: [x] DONE
- AIR-4 Quản trị: bỏ trang "AI tạo câu hỏi", gợi ý AI khi sửa câu, KPI AI ở dashboard, kiểm tra nhà cung cấp AI ở health (BE + web) — Status: [x] DONE
- AIR-5 Gỡ module `adminai` + cấu hình khóa AI + `aiApi`; spec + DECISIONS; cả bộ test + boot jar + smoke — Status: [ ] TODO

Mỗi task: **Spec impact** SPEC_USER (bộ câu, nhóm, quản trị), SPEC_MULTIPLAYER (nguồn câu) · **Spec strategy** (a) update inline · quyết định vào DECISIONS 2026-10-13.
