# Cleanup — Bỏ Old Ranked Card, Resolve Conflict

**Vấn đề**: Sau khi implement Bible Basics Quiz, Home page có **2 systems mâu thuẫn cho Ranked unlock**:

1. **BasicQuizCard banner** (mới): "✅ Đã hoàn thành bài giáo lý" → vào Ranked được
2. **Ranked card trong GameModeGrid** (cũ): "🔒 Đã khóa — cần 919 XP hoặc 3/5 đúng" → bị khóa

User tier 1 nhìn 2 chỗ nói ngược nhau → confused. Cần cleanup.

**Cost ước tính**: 1.5-2 giờ.

**Quy tắc**: Mỗi step = 1 commit riêng để rollback dễ.

---

## Step 0 — Verify hiện trạng

Trả lời trong reply đầu tiên trước khi code:

1. **GameModeGrid Ranked card hiện tại**:
   - File: `apps/web/src/components/GameModeGrid.tsx`
   - Tìm card với `id='ranked'` hoặc tương đương
   - Hiển thị logic gì? Check `earlyRankedUnlock`? Check XP? Hay cả hai?

2. **BasicQuizCard placement hiện tại**:
   - File: `apps/web/src/pages/Home.tsx`
   - BasicQuizCard render ở vị trí nào? Trên hay dưới GameModeGrid?
   - Khi user pass → BasicQuizCard hiện State 4 với CTA "Bắt đầu Ranked"

3. **TierPerksTeaser text issue**:
   - Tìm i18n key cho "Hồi 22 năng lượng / giờ"
   - Confirm key name + đề xuất sửa thành "Hồi phục 22 năng lượng / giờ"

4. **Backend response**:
   - `/api/me` hoặc tương tự còn return `earlyRankedUnlock` field không?
   - Nếu có → frontend còn dùng field này ở đâu?

KHÔNG bắt đầu Step 1 cho đến khi có findings.

---

## Step 1 — Bỏ Ranked card khỏi GameModeGrid

### Mục tiêu

GameModeGrid **KHÔNG render** Ranked card nữa. BasicQuizCard banner ở trên đã đảm nhiệm vai trò gateway cho Ranked.

### Implementation

1. Mở `apps/web/src/components/GameModeGrid.tsx`
2. Trong array CARDS, **xóa hoàn toàn** entry với id='ranked' (hoặc tương đương)
3. Đảm bảo grid layout vẫn đẹp sau khi bỏ 1 card:
   - Trước: 2 featured (Practice + Ranked) + 4 secondary + 3 variety
   - Sau: 1 featured (Practice) + 4 secondary + 3 variety
   - Featured row có thể full-width Practice, hoặc giữ 2 columns với Practice + Group lên featured

### Layout đề xuất sau cleanup

```
[BasicQuizCard banner]   ← gateway cho Ranked (đã có)

[Chế độ chơi]
├─ Featured: Luyện Tập (full width hoặc large card)
├─ Secondary row 1: Thử Thách Ngày | Nhóm Giáo Xứ
├─ Secondary row 2: Phòng Chơi | Giải Đấu  
└─ Variety: Chủ Đề Tuần | Mystery Mode | Speed Round
```

### Acceptance criteria

- GameModeGrid KHÔNG render Ranked card
- Layout không bị gãy (grid alignment OK)
- Tests update: GameModeGrid tests assert về Ranked phải remove/đổi
- Manual: User chỉ thấy 1 chỗ duy nhất nói về Ranked = BasicQuizCard banner

### Cost: 30-45 phút

### Commit
- `refactor(home): remove Ranked card from GameModeGrid (BasicQuizCard handles unlock)`

---

## Step 2 — Fix TierPerksTeaser text

### Issues

```
Hiện tại:
  +10% XP cho mọi câu trả lời
  Hồi 22 năng lượng / giờ              ← awkward Vietnamese

Đề xuất:
  +10% XP cho mọi câu trả lời
  Phục hồi 22 năng lượng mỗi giờ        ← natural Vietnamese
```

### Files cần sửa

`apps/web/src/i18n/vi.json`:
```json
"tierPerks": {
  "energyRegen": "Phục hồi {{perHour}} năng lượng mỗi giờ"
}
```

`apps/web/src/i18n/en.json`:
```json
"tierPerks": {
  "energyRegen": "Recover {{perHour}} energy per hour"
}
```

### Acceptance criteria

- Text hiển thị tự nhiên trong cả 2 ngôn ngữ
- i18n validator pass

### Cost: 15 phút

### Commit
- `fix(i18n): natural Vietnamese for energy regen text`

---

## Step 3 — Cleanup dead code (Optional, defer if risky)

### Mục tiêu

Sau khi BasicQuizCard system stable, có thể cleanup các artifacts cũ. **Defer cho v1.1** để đảm bảo rollback safety nếu cần.

### Items cần cleanup (TODO mới, KHÔNG làm trong PR này)

1. **Backend**:
   - V32 migration: DROP COLUMN `early_ranked_unlock`, `early_ranked_unlocked_at`, `practice_correct_count`, `practice_total_count` từ users
   - Xóa `EarlyUnlockMetricsService` (nếu có)
   - Xóa `/api/admin/early-unlock-metrics` endpoint
   - Xóa logic check `earlyRankedUnlock` trong SessionService

2. **Frontend**:
   - Xóa `apps/web/src/pages/admin/EarlyUnlockMetrics.tsx`
   - Xóa nav link "Early Unlock Metrics" trong admin sidebar
   - Xóa `earlyRankedUnlock` từ TypeScript types/interfaces

### Tạo TODO mới trong TODO.md

```markdown
## v1.1 — Cleanup deprecated early ranked unlock [DEFERRED]

> Sau khi Bible Basics Quiz stable trong production 1-2 tuần.

- [ ] V32 migration: DROP COLUMN early_ranked_unlock + practice_*_count
- [ ] Backend: remove EarlyUnlockMetricsService + endpoint
- [ ] Frontend: remove admin/EarlyUnlockMetrics page + nav link
- [ ] Types: remove earlyRankedUnlock from interfaces
- [ ] Tests: clean up tests referencing old system
```

### Cost cho Step 3 (chỉ TODO): 5 phút

### Commit
- `docs: TODO for v1.1 early ranked unlock cleanup`

---

## Step 4 — Full regression

### Manual smoke test

User flow chính:

**Flow A — Fresh user chưa pass**:
1. Login fresh user → Home
2. Verify: BasicQuizCard banner ở trên Game Modes section, hiển thị "Bắt đầu Bài Giáo Lý"
3. Verify: KHÔNG có Ranked card trong GameModeGrid
4. Verify: TierPerksTeaser hiển thị "Phục hồi 22 năng lượng mỗi giờ"

**Flow B — User đã pass Bible Basics**:
1. User pass bài giáo lý → quay lại Home
2. Verify: BasicQuizCard banner hiển thị "✅ Đã hoàn thành bài giáo lý" + CTA "Bắt đầu Ranked"
3. Verify: KHÔNG có Ranked card duplicate trong GameModeGrid
4. Click "Bắt đầu Ranked" → vào /ranked thành công

**Flow C — User logout/login**:
1. User pass → logout → login lại
2. Verify: BasicQuizCard vẫn hiển thị state đã pass (persist từ DB)

### Checklist

- [ ] `npm run build` pass (0 errors)
- [ ] FE tests pass (>= baseline, có thể giảm vài tests cũ về Ranked card)
- [ ] No console errors
- [ ] Manual flows A, B, C pass
- [ ] Layout không bị gãy ở mobile + desktop

### Cost: 30 phút

### Commit
- `chore: regression after Ranked card cleanup`

---

## Workflow Order

```
Step 0: Verify              — KHÔNG commit
Step 1: Remove Ranked card  — 1 commit
Step 2: Fix energy text     — 1 commit
Step 3: TODO for v1.1       — 1 commit
Step 4: Regression          — 1 commit
```

4 commits, mỗi commit revertable.

---

## Definition of Done

✅ Home page CHỈ có 1 chỗ nói về Ranked (BasicQuizCard banner)  
✅ GameModeGrid KHÔNG còn Ranked card  
✅ TierPerksTeaser text Vietnamese tự nhiên  
✅ TODO v1.1 cleanup deprecated system đã ghi  
✅ Manual flows A, B, C work end-to-end  
✅ Tests + build pass  

---

## Câu hỏi trước khi bắt đầu

Trả lời trong reply đầu tiên:

1. **Step 0 finding 1**: GameModeGrid card `id='ranked'` có những props/logic gì cần xóa? Có dependency nào break nếu xóa?

2. **Layout sau khi bỏ Ranked card**: 
   - Option A: Practice full-width 1 row → secondary 2x2 → variety 1x3
   - Option B: Practice + Group lên featured 2 columns → secondary 1x2 → variety 1x3
   - Đề xuất của bạn?

3. **Có test nào hiện tại assert "Ranked card visible in GameModeGrid"** không? Cần update bao nhiêu tests?

Sau khi confirm 3 câu → bắt đầu Step 1.

---

## Reminder

- Đây là **cleanup**, không phải feature mới — code phải **ÍT đi**, không nhiều hơn.
- KHÔNG xóa BasicQuizCard hoặc bất cứ gì liên quan đến new system.
- KHÔNG xóa V29/V30 migrations hoặc fields trong DB (defer v1.1).
- Mục tiêu: **single source of truth** cho Ranked unlock = BasicQuizCard.
