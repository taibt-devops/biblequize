# Bug Report — Leaderboard Page (`/leaderboard`)

> **Source:** Visual review screenshot 2026-04-30
> **Reporter:** UX/Design audit
> **Page:** `apps/web/src/pages/Leaderboard.tsx` (web), mobile equivalent if exists
> **Severity overview:** 4× P0 (blockers), 5× P1 (UX issues), 3× P2 (improvements), 2× P3 (polish)

## 📊 Fix status (2026-05-01)

| Bug | Severity | Status | Commit |
|---|---|---|---|
| LB-P0-1 i18n keys raw | 🔴 P0 | ✅ FIXED | `941cee5` |
| LB-P0-2 Tier season naming | 🔴 P0 | ✅ DECIDED + FIXED (Option A, mockup override) | `941cee5` |
| LB-P0-3 Duplicate user row | 🔴 P0 | ✅ FIXED (FE) — BE root cause investigation deferred | `888c146` |
| LB-P0-4 Tier colors not distinguishable | 🔴 P0 | ✅ FIXED (avatars + bục now use tier colorHex) | `8254ad2` |
| LB-P1-1 Podium same height | 🟠 P1 | ✅ FIXED | `8254ad2` |
| LB-P1-2 Roman numerals redundant | 🟠 P1 | ✅ FIXED | `8254ad2` |
| LB-P1-3 Crown #1 too small | 🟠 P1 | ✅ FIXED (👑 + gold glow) | `8254ad2` |
| LB-P1-4 Missing Season tab | 🟠 P1 | ✅ FIXED (BE + FE) | `8f1f6e6` |
| LB-P1-5 Tie-break opacity | 🟠 P1 | ✅ FIXED (questions count in podium) | `8254ad2` |
| LB-P2-1 Flat row content | 🟡 P2 | ✅ FIXED (tier badge + streak/trend graceful) | `b371117` |
| LB-P2-2 Empty state daily | 🟡 P2 | ⏸️ DEFERRED to LB-2 |
| LB-P2-3 Section purpose | 🟡 P2 | ✅ FIXED (subtitle added) | `941cee5` |
| LB-P3-1 Sidebar context | 🟢 P3 | ✅ FIXED (2 widgets) | `3f00b70` |
| LB-P3-2 Header font hierarchy | 🟢 P3 | ⏸️ DEFERRED to LB-2 |

**Sprint 1 score: 12/14 fixed (86%), 2 deferred to LB-2.**

Tracked in `TODO.md` "Leaderboard Redesign Sprint 1 [DONE]".

---

## 🔴 P0 — Production Blockers

### LB-P0-1: i18n keys không render — hiển thị raw string
**Severity:** Critical · **Type:** Bug · **Effort:** 30min

**Triệu chứng:**
Section "Xếp Hạng Mùa" hiện 4 cards với text raw thay vì translation:
- `leaderboard.tierGold` (đáng lẽ "Vàng")
- `leaderboard.tierGoldDesc` (đáng lẽ description)
- `leaderboard.tierSilver`, `leaderboard.tierSilverDesc`
- `leaderboard.tierBronze`, `leaderboard.tierBronzeDesc`
- `leaderboard.tierIron`, `leaderboard.tierIronDesc`

**Root cause khả năng cao:**
- Keys chưa được thêm vào `apps/web/src/i18n/vi.json` + `en.json`
- Hoặc namespace `leaderboard.*` chưa load đúng
- Hoặc component dùng `t('leaderboard.tierGold')` nhưng file translation chưa có key này

**Verification:**
```bash
grep -n "leaderboard.tier" apps/web/src/i18n/vi.json apps/web/src/i18n/en.json
# Expect: keys present in both files
```

**Fix:**
1. Tìm component render section "Xếp Hạng Mùa" (likely `SeasonRankingTiers.tsx` hoặc inline trong `Leaderboard.tsx`)
2. Identify all i18n keys used
3. Thêm vào `vi.json` + `en.json` với translation Bible-themed (xem LB-P0-2)
4. Verify không còn raw key nào trên UI

**Acceptance:**
- [ ] Tất cả 8 keys render thành text tiếng Việt + tiếng Anh
- [ ] Test cả 2 languages (toggle UI language)
- [ ] No console warnings về missing keys

---

### LB-P0-2: Tier system "Mùa" mâu thuẫn với BibleQuiz brand
**Severity:** Critical · **Type:** Design Decision · **Effort:** 1h decision + 30min impl

**Triệu chứng:**
Section "Xếp Hạng Mùa" dùng tier kim loại **Gold/Silver/Bronze/Iron** — pattern eSports/League of Legends, không phải Bible-themed.

**BibleQuiz có 6 tier tôn giáo:**
Tân Tín Hữu → Người Tìm Kiếm → Môn Đồ → Hiền Triết → Tiên Tri → Sứ Đồ

**Mâu thuẫn:**
- SPEC_USER_v3 mục 3.3: "Tier season riêng biệt với tier all-time" — intent có 2 hệ thống
- Nhưng dùng tên kim loại phá vỡ Sacred Modernist tone + thần học progression của brand

**Đề xuất options:**

**Option A (recommend):** Dùng nguyên 6 tier tôn giáo cho cả season
- "Top 3 mỗi tier nhận badge **Vinh Quang Mùa Xuân 2026**" (giống SPEC mục 9.2)
- Đơn giản, nhất quán

**Option B:** Tạo tier season riêng nhưng Bible-themed
- Vinh Quang / Hào Quang / Ánh Sáng / Tia Lửa (4 tier)
- Hoặc dùng metaphor khác (mùa: Xuân/Hạ/Thu/Đông)

**Option C:** Dịch metallic sang VN
- Vàng / Bạc / Đồng / Sắt
- Giữ nguyên concept eSports nhưng VN-friendly

**Decision (2026-05-01):** ✅ **Option A** — dùng nguyên 6 tier tôn giáo cho cả season. Top 3 mỗi tier nhận badge "Vinh Quang Mùa Xuân 2026" cuối mùa. Xem `DECISIONS.md` 2026-05-01 "Leaderboard tier season naming".

```
TIER_SEASON_NAMING = A
```

**Acceptance:**
- [ ] Decision documented trong `DECISIONS.md`
- [ ] Translation keys + values phù hợp với option đã chọn
- [ ] Nhất quán với SPEC_USER_v3 mục 3.3 + 9.2

---

### LB-P0-3: Duplicate row "TAI THANH" — render bug
**Severity:** Critical · **Type:** Bug · **Effort:** 1-2h debug

**Triệu chứng:**
Trong list dưới podium, **TAI THANH xuất hiện 2 lần liên tiếp:**
- Dòng #4: "TAI THANH · 0 điểm"
- Dòng #3 (highlighted gold): "TAI THANH · BẠN · 0 điểm"

Cả 2 dòng cùng tên, cùng 0 điểm, nhưng thứ hạng khác nhau (#3 và #4).

**Root cause hypotheses:**
1. **Backend bug:** Query trả 2 rows cho cùng userId (JOIN sai, hoặc Redis ZSET có duplicate entry)
2. **Frontend bug:** Component "around-me row" render đè lên list row mà không filter trùng userId
3. **Pattern bug:** Frontend cố tình hiện 2 rows — 1 là "rank thật", 1 là "your row" — nhưng UX sai (phải gộp thành 1)

**Verification:**
```bash
# Check API response
curl "http://localhost:8080/api/leaderboard/global?period=daily" | jq '.rows[] | select(.userName == "TAI THANH")'
# Expect: 1 row only

# Check around-me API
curl "http://localhost:8080/api/leaderboard/around-me?period=daily" | jq
# Expect: rows that may include TAI THANH but with deduplication logic on FE
```

**Files cần kiểm tra:**
- `apps/api/.../service/LeaderboardService.java` — query logic
- `apps/api/.../service/LeaderboardRedisService.java` — Redis ZSET deduplication
- `apps/web/src/pages/Leaderboard.tsx` — frontend render logic
- `apps/web/src/components/LeaderboardRow.tsx` (nếu có)

**Fix:**
- Nếu backend trả duplicate → fix query/Redis ZSET (set vs sorted set)
- Nếu frontend render đè → dedupe trong render: `rows.filter((r, i, arr) => arr.findIndex(x => x.userId === r.userId) === i)`
- Pattern đúng: **1 row duy nhất per user**, nếu là current user thì add highlight + badge "BẠN"

**Acceptance:**
- [ ] Mỗi user chỉ xuất hiện 1 lần trong leaderboard
- [ ] Current user row có visual highlight (gold bg) + badge "BẠN"
- [ ] Không có duplicate ở bất kỳ tab nào (Daily / Weekly / All time)

---

### LB-P0-4: Tier color không phân biệt được giữa các user
**Severity:** Critical · **Type:** Visual Bug · **Effort:** Phụ thuộc Task 1 COLOR_AUDIT

**Triệu chứng:**
- Top 3 podium: 3 avatar (Test Tier 1, 2, 3) đều **xám** — không phân biệt được tier
- List dưới: cả TAI THANH (Tân Tín Hữu) và Test Tier 3 (?) đều xám

**Đáng lẽ phải hiển thị:**
| User | Tier | Color đúng |
|---|---|---|
| Test Tier 1 (4350 pts) | Sứ Đồ | `#ef4444` đỏ |
| Test Tier 2 (1000 pts) | Tiên Tri | `#eab308` vàng |
| Test Tier 3 (0 pts) | Hiền Triết hoặc lower? | `#a855f7` tím |
| TAI THANH (0 pts) | Tân Tín Hữu | `#9ca3af` xám |

**Root cause:**
Đây là vấn đề Task 1 trong `docs/COLOR_AUDIT.md` đã chỉ ra — tier colors web ↔ mobile mismatch + một số tier dùng hardcoded hex thay vì token.

**Fix:**
- Phụ thuộc completion của `PROMPT_COLOR_FIXES.md` Task 1 (sync 6 tier colors)
- Sau khi tier tokens được wire, update `LeaderboardRow.tsx` + `PodiumCard.tsx` để dùng `tier.colorHex` từ user data thay vì hardcoded gray

**Acceptance:**
- [ ] 6 tier có 6 màu khác biệt rõ ràng
- [ ] Avatar background = tier color tương ứng
- [ ] Visual scan 1 giây biết được mỗi user thuộc tier nào

---

## 🟠 P1 — UX Issues

### LB-P1-1: Podium 3 bục cùng chiều cao — mất metaphor
**Severity:** High · **Type:** UX · **Effort:** 2-3h

**Triệu chứng:**
3 bục dưới top 3 (II / I / III) **cùng chiều cao**, cùng width. Mất hoàn toàn metaphor "podium" trong đó:
- Bục #1 phải cao nhất
- Bục #2 thấp hơn
- Bục #3 thấp nhất

Hiện tại chỉ có chữ La Mã (II / I / III) trong khung chữ nhật giống nhau → không truyền tải hierarchy.

**Đề xuất fix:**

```
       [#1 - 100% height]
[#2 - 70%]              [#3 - 50%]
```

Hoặc bỏ bục, chỉ để 3 avatar với:
- #1 avatar size 80px + crown lớn
- #2 + #3 avatar size 60px

**Files:**
- `apps/web/src/pages/Leaderboard.tsx` (podium section)
- Hoặc `components/PodiumTop3.tsx` nếu đã extract

**Acceptance:**
- [ ] Visual hierarchy giữa 3 bục rõ ràng (chiều cao hoặc avatar size)
- [ ] User mới scan 1 giây biết ai #1

---

### LB-P1-2: Số La Mã trong podium thừa + lạc lõng
**Severity:** Medium · **Type:** UX · **Effort:** 30min

**Triệu chứng:**
Bục podium có "II / I / III" font cực to. Nhưng đã có badge số "1, 2, 3" dưới mỗi avatar rồi → **lặp thông tin**.

La Mã cũng không phải convention quốc tế cho podium — Olympic dùng số Ả-rập + chiều cao bục.

**Fix:**
- Bỏ luôn La Mã
- Hoặc thay bằng chiều cao bục thực sự (xem LB-P1-1)

**Acceptance:**
- [ ] Không còn ký tự La Mã trên podium
- [ ] Thông tin rank chỉ hiện 1 chỗ (badge số dưới avatar)

---

### LB-P1-3: Crown badge top 1 quá nhỏ + không nổi bật
**Severity:** Medium · **Type:** Visual · **Effort:** 1-2h

**Triệu chứng:**
Top 1 (Test Tier 1) chỉ có 1 ngôi sao nhỏ trên đầu avatar. Champion celebration thiếu lực — không khác biệt nhiều so với top 2/3.

**Đề xuất:**
- Crown icon lớn hơn (24-32px thay vì ~14px hiện tại)
- Avatar #1 to hơn 2 người còn lại (80px vs 60px)
- Glow ring gold quanh avatar
- Có thể thêm subtle pulse animation
- Nếu là season ranking: thêm badge "Vinh Quang" (theo decision LB-P0-2)

**Acceptance:**
- [ ] Champion #1 visually dominant trên podium
- [ ] Animation/glow đủ celebrate nhưng không over-the-top

---

### LB-P1-4: Tab thiếu period "MÙA"
**Severity:** Medium · **Type:** Missing Feature · **Effort:** 1h

**Triệu chứng:**
3 tabs hiện tại: HÀNG NGÀY / HÀNG TUẦN / TẤT CẢ

Theo SPEC_USER_v3 mục 17.11, leaderboard có **4 periods:**
- `daily` ✅
- `weekly` ✅
- `season` ❌ MISSING
- `all_time` ✅ (= "TẤT CẢ")

**Fix:**
Thêm tab "MÙA" giữa "HÀNG TUẦN" và "TẤT CẢ":
```
HÔM NAY · TUẦN · MÙA · TẤT CẢ
```

API endpoint có sẵn: `GET /api/leaderboard/global?period=season`

**Acceptance:**
- [ ] 4 tabs hiển thị đúng thứ tự
- [ ] Click "Mùa" → fetch + render season leaderboard
- [ ] Tab labels rút gọn cho mobile (tránh overflow)

---

### LB-P1-5: Tie-break logic không transparent với user
**Severity:** Medium · **Type:** UX · **Effort:** 1h

**Triệu chứng:**
- Test Tier 3 có **0 pts** đứng #3 (trên podium)
- TAI THANH có **0 pts** đứng #4 (dưới list)
- Cùng 0 pts nhưng thứ hạng khác nhau → tie-break đang dùng tiêu chí gì?

Có thể đang dùng:
- `total_questions_answered` (số câu đã làm)
- `last_active_at` (ai active gần nhất)
- `account_created_at` (ai tham gia trước)

Nhưng UI không hiện ra → user confused.

**Fix:**
Thêm sub-text dưới điểm số khi có tie:
```
Test Tier 3
0 điểm · 20 câu      ← tie-break info hiện ra
```

Hoặc tooltip on hover/long-press giải thích.

**Acceptance:**
- [ ] Tie-break criteria documented trong code (comment hoặc README)
- [ ] User thấy được tại sao mình ở rank đó (nếu tie)

---

## 🟡 P2 — Improvements

### LB-P2-1: Mỗi row leaderboard quá phẳng — thiếu social context
**Severity:** Low · **Type:** Enhancement · **Effort:** 2-3h

**Triệu chứng:**
Mỗi row chỉ có: rank · avatar · name · điểm

Đáng lẽ phải có thêm:
- **Tier badge** (Tân Tín Hữu / Người Tìm Kiếm / ...)
- **Streak indicator** (🔥 7 ngày)
- **Trend** (▲ tăng 2 hạng / ▼ giảm 1 / — giữ nguyên)
- **Group badge** nếu user thuộc church group nào đó

**Đề xuất layout row:**
```
#3   [Avatar tier-color]   TAI THANH    [Tân Tín Hữu]    🔥3   ▲2     0 điểm
```

**Acceptance:**
- [ ] Row có tier badge + streak (ít nhất)
- [ ] Trend chỉ hiển thị nếu có data so sánh với period trước
- [ ] Mobile responsive (có thể bỏ trend trên màn hình nhỏ)

---

### LB-P2-2: Empty state cho daily leaderboard chưa có
**Severity:** Low · **Type:** UX · **Effort:** 1h

**Triệu chứng:**
TAI THANH 0 điểm xếp #4 — đang ở Daily tab và user chưa chơi hôm nay. Trải nghiệm awkward: "Mình đang ở leaderboard nhưng chưa làm gì".

**Đề xuất:**
- Top of daily tab khi user chưa chơi: banner "Hôm nay bạn chưa chơi câu nào — [Bắt đầu Daily Challenge →]"
- Hoặc auto-switch sang tab "Tuần"/"Mùa" nếu daily empty cho user
- Hoặc empty state với illustration + CTA

**Acceptance:**
- [ ] Daily tab có empty/inactive state cho user chưa chơi
- [ ] CTA dẫn về Daily Challenge clear

---

### LB-P2-3: Section "Xếp Hạng Mùa" thiếu purpose statement
**Severity:** Low · **Type:** Content · **Effort:** 30min

**Triệu chứng:**
Section dưới cùng có 4 cards tier mùa, nhưng **không có header copy giải thích section này là gì:**
- Đây là badge user đang có?
- Đây là explainer "đạt rank X được tier Y"?
- Đây là rewards sẽ nhận khi season kết thúc?

**Fix:**
Thêm 1 dòng subtitle dưới header "Xếp Hạng Mùa":

Option 1 (explainer): "Cuối Mùa Xuân 2026, top 3 mỗi tier sẽ nhận badge độc quyền"

Option 2 (status): "Bạn đang ở tier: **Tân Tín Hữu** · Còn 919 XP đến tier kế"

Option 3 (reward): "Phần thưởng dành cho 4 tier cao nhất khi mùa kết thúc"

**Acceptance:**
- [ ] Subtitle rõ purpose
- [ ] Highlighted card user đang ở (nếu Option 2)

---

## 🟢 P3 — Polish (defer)

### LB-P3-1: Sidebar content trùng với Home
**Severity:** Very Low · **Type:** UX · **Effort:** 2h

**Triệu chứng:**
Sidebar có Streak widget + Daily Mission card — y hệt sidebar Home. Sidebar không tận dụng được context của page Leaderboard.

**Đề xuất:**
Sidebar Leaderboard nên có content **đặc thù:**
- "Around you" mini widget (5 người trên + 5 người dưới bạn)
- "Group leaderboard preview" nếu user có group
- "Season countdown" (còn X ngày đến hết mùa)

**Acceptance:**
- [ ] Sidebar có ít nhất 1 widget đặc thù cho Leaderboard
- [ ] Generic widgets (Streak, Mission) có thể giữ ở footer sidebar

---

### LB-P3-2: Header "Bảng Xếp Hạng" font hierarchy chênh
**Severity:** Very Low · **Type:** Visual · **Effort:** 30min

**Triệu chứng:**
Header dùng serif font lớn, subtitle dùng sans-serif khác → cảm giác **2 font không cùng family**.

**Fix:**
- Verify cả 2 dùng cùng font family (Be Vietnam Pro)
- Hoặc giảm size header để tỷ lệ hài hoà hơn
- Cần check `tailwind.config.js` font config

**Acceptance:**
- [ ] Header + subtitle nhất quán về font family
- [ ] Typography hierarchy rõ nhưng không jarring

---

## 📊 Tổng kết

| Severity | Count | Total effort |
|---|---|---|
| 🔴 P0 (blocker) | 4 | 3-5h |
| 🟠 P1 (UX) | 5 | 5-7h |
| 🟡 P2 (improve) | 3 | 4-5h |
| 🟢 P3 (polish) | 2 | 2-3h |
| **Total** | **14** | **~14-20h** |

---

## 🎯 Đề xuất thứ tự thực hiện

### Sprint 1 — Production blockers (do trước)
1. **LB-P0-1** — fix i18n keys (30min) — nhanh nhất, impact rõ
2. **LB-P0-2** — decide tier season naming (1h) — cần Bui quyết
3. **LB-P0-3** — debug duplicate TAI THANH (1-2h) — cần data investigation

### Sprint 2 — UX core
4. **LB-P0-4** — tier colors (sau khi xong PROMPT_COLOR_FIXES Task 1)
5. **LB-P1-1 + LB-P1-2** — podium redesign (3h, gộp luôn)
6. **LB-P1-4** — thêm tab Mùa (1h)

### Sprint 3 — Enhancement
7. **LB-P1-3** — crown celebration (2h)
8. **LB-P1-5** — tie-break transparency (1h)
9. **LB-P2-1** — row content rich (2-3h)

### Backlog
10. P2 còn lại + tất cả P3

---

## 🔗 Related artifacts

- `docs/COLOR_AUDIT.md` — màu sắc audit (LB-P0-4 phụ thuộc)
- `PROMPT_COLOR_FIXES.md` — Task 1 sẽ fix tier colors
- `SPEC_USER_v3.md` mục 3.3 + 9.2 + 17.11 — tier season + leaderboard API spec
- `docs/DECISIONS.md` — cần ghi LB-P0-2 decision

---

## 🤔 Questions cần Bui quyết

1. **Tier season naming** (LB-P0-2): A / B / C?
2. **Podium redesign** (LB-P1-1): chiều cao thật hay bỏ podium dùng avatar size?
3. **Around-me logic** (LB-P0-3): khi user ở rank #50, có muốn hiển thị "5 trên + 5 dưới" thay vì cả list?
4. **Sprint order**: làm Sprint 1 ngay, hay đợi xong PROMPT_COLOR_FIXES rồi gộp?

---

*Generated 2026-04-30 — Living document, cập nhật khi có thêm finding.*
