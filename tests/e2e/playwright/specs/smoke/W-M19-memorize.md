# W-M19 — Học Thuộc câu gốc (L1 Smoke)

**Routes:** `/practice`, `/practice/memorize`, `/practice/memorize/add`
**Spec ref:** SPEC_USER §5.1.1
**Backend:** thật, chỉ đọc (không tạo dữ liệu)

---

### W-M19-L1-001 — Practice hiện thẻ Học Thuộc và dẫn tới danh sách

**Priority**: P1 · **Est. runtime**: ~3s · **Auth**: storageState=tier1 · **Tags**: @smoke @memorize

**Setup**: stub `GET /api/public/bible/status` → `{available: true}` (thẻ bị cổng ẩn khi chưa import chữ — HT-22; DB E2E chưa có chữ)

**Actions**:
1. `page.goto('/practice')`
2. `page.getByTestId('memorize-entry-btn').click()`

**Assertions**:
- `expect(page.getByTestId('memorize-entry-card')).toBeVisible()`
- `expect(page).toHaveURL('/practice/memorize')`
- `expect(page.getByTestId('memorize-list-page')).toBeVisible()`

**Notes**: [NEEDS TESTID: memorize-entry-card, memorize-entry-btn] — `MemorizeEntryCard`; [NEEDS TESTID: memorize-list-page]

---

### W-M19-L1-002 — Trang danh sách render empty state hoặc danh sách + nút Thêm

**Priority**: P1 · **Est. runtime**: ~3s · **Auth**: storageState=tier1 · **Tags**: @smoke @memorize

**Actions**: `page.goto('/practice/memorize')` → chờ hết skeleton

**Assertions**:
- `expect(page.getByTestId('memorize-add-btn')).toBeVisible()`
- `memorize-empty` HOẶC ít nhất 1 `memorize-item` hiển thị

**Notes**: [NEEDS TESTID: memorize-add-btn, memorize-empty, memorize-item]

---

### W-M19-L1-003 — Trang chọn câu render bộ chọn, nút Thêm bị khoá khi chưa chọn

**Priority**: P1 · **Est. runtime**: ~3s · **Auth**: storageState=tier1 · **Tags**: @smoke @memorize

**Actions**: `page.goto('/practice/memorize/add')`

**Assertions**:
- `memorize-add-book`, `memorize-add-chapter`, `memorize-add-verse-from`, `memorize-add-verse-to` visible
- `expect(page.getByTestId('memorize-add-submit')).toBeDisabled()`

**Notes**: [NEEDS TESTID: memorize-add-page + 4 select + memorize-add-submit] — select native (value sách = English key, vd `John`)

---

## NEEDS TESTID Summary

| Element | testid | File |
|---|---|---|
| Thẻ lối vào Practice | `memorize-entry-card`, `memorize-entry-btn` | components/memorize/MemorizeEntryCard.tsx |
| Trang danh sách | `memorize-list-page`, `memorize-empty`, `memorize-item`, `memorize-add-btn` | pages/memorize/MemorizeList.tsx |
| Trang chọn câu | `memorize-add-page`, `memorize-add-book/chapter/verse-from/verse-to`, `memorize-add-submit` | pages/memorize/MemorizeAdd.tsx |
