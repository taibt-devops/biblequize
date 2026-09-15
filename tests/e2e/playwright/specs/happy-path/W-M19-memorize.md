# W-M19 — Học Thuộc câu gốc (L2 Happy Path)

**Routes:** `/practice/memorize`, `/practice/memorize/add`, `/practice/memorize/session`, `/`
**Spec ref:** SPEC_USER §5.1.1, §27.20
**Backend:** API Học Thuộc + `/api/bible/passage` **stub có trạng thái** (`helpers/memorize-api-stub.ts`) vì DB E2E chưa có toàn văn (HT-5). Chữ câu là **giả** (`v16a v16b … v16f`), không phải Kinh Thánh.
**Auth**: storageState=tier1 · stub cài trong `beforeEach` → mỗi test tự đủ trạng thái.

---

### W-M19-L2-001 — Thêm đoạn câu mới từ bộ chọn và thấy trong danh sách
**Priority**: P0 · **Tags**: @happy @memorize
1. `goto('/practice/memorize/add')` → chọn `John` / `3` / `16` / `17`
2. Preview `memorize-add-preview` chứa `v16a` → click `memorize-add-submit`
- URL `/practice/memorize`, `memorize-item` count = 1; stub nhận POST `{book:'John',chapter:3,verseStart:16,verseEnd:17}`

### W-M19-L2-002 — Thêm đoạn đã có → báo lỗi trùng
**Priority**: P1 · **Tags**: @happy @memorize
Setup: stub có sẵn John 3:16-17 → chọn lại cùng đoạn → submit
- `memorize-add-error` visible (API 409); stub vẫn 1 câu

### W-M19-L2-003 — Đoạn chưa có nội dung → không cho thêm
**Priority**: P1 · **Tags**: @happy @memorize
Setup: passage trả 404 → chọn John 3:16
- `memorize-add-no-text` visible; `memorize-add-submit` disabled

### W-M19-L2-004 — Ôn câu level 0: sắp xếp cụm đúng → đạt
**Priority**: P0 · **Tags**: @happy @memorize @critical
Setup: John 3:16 level 0, đến hạn
1. `goto('/practice/memorize/session')` → `memorize-context` chứa `v16a` → `memorize-context-start`
2. `memorize-order-exercise` visible → chạm `memorize-order-chunk` theo thứ tự `v16a v16b v16c`, `v16d v16e v16f` (cụm 3 chữ)
- `memorize-result[data-passed="true"]`; `memorize-next-btn` → `memorize-summary`
- stub nhận review `{exerciseType:'order', passed:true}`

### W-M19-L2-005 — Ôn câu level 2: điền khuyết đúng → đạt
**Priority**: P0 · **Tags**: @happy @memorize @critical
Setup: John 3:16 level 2
1. Session → start → `memorize-cloze-exercise` visible
2. Với mỗi `memorize-cloze-blank[data-index=i]` → chạm `memorize-cloze-word` có text = token thứ i
- `memorize-result[data-passed="true"]`; review `{exerciseType:'cloze', passed:true}`

### W-M19-L2-006 — Xoá câu khỏi danh sách sau khi xác nhận
**Priority**: P2 · **Tags**: @happy @memorize
Setup: Psalms 23:1 → list → `memorize-item-delete` → `memorize-item-delete-confirm`
- `memorize-empty` visible; stub 0 câu

### W-M19-L2-007 — Home hiện thẻ câu cần ôn và dẫn vào phiên ôn
**Priority**: P1 · **Tags**: @happy @memorize
Setup: 2 câu đến hạn → `goto('/')`
- `home-memory-due-card` visible, chứa `2` → `home-memory-due-btn` → URL `/practice/memorize/session`, `memorize-session-page` visible

---

## NEEDS TESTID Summary

| Element | testid | File |
|---|---|---|
| Preview / không có chữ / lỗi thêm | `memorize-add-preview`, `memorize-add-no-text`, `memorize-add-error` | pages/memorize/MemorizeAdd.tsx |
| Xoá 2 bước | `memorize-item-delete`, `memorize-item-delete-confirm` | pages/memorize/MemorizeList.tsx |
| Phiên ôn | `memorize-session-page`, `memorize-context`, `memorize-context-start`, `memorize-result[data-passed]`, `memorize-next-btn`, `memorize-summary` | pages/memorize/MemorizeSession.tsx |
| Sắp xếp cụm | `memorize-order-exercise`, `memorize-order-chunk` | components/memorize/PhraseOrderExercise.tsx |
| Điền khuyết | `memorize-cloze-exercise`, `memorize-cloze-blank[data-index]`, `memorize-cloze-word` | components/memorize/ClozeExercise.tsx |
| Thẻ Home | `home-memory-due-card`, `home-memory-due-btn` | components/memorize/MemoryDueCard.tsx |
