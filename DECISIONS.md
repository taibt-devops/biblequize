# Decisions Log

---

## 2026-05-01 — Leaderboard redesign: mockup là design reference, content theo Option A
- Quyết định: 2 mockup `docs/leaderboard/biblequiz_leaderboard_redesign.html` + `_mobile.html` là **source of truth về visual/layout** (podium hybrid, crown #1, list rich content, sidebar widgets, 4 tabs, section title "Vinh Quang Mùa Xuân 2026"). Section "Xếp Hạng Mùa" content **OVERRIDE** mockup: dùng nguyên 6 tier tôn giáo (Tân Tín Hữu → Sứ Đồ) thay vì 4 reward tier Bible-themed (Vinh Quang/Hào Quang/Ánh Sáng/Tia Lửa) mockup vẽ.
- Lý do split: mockup design hợp lý ở 90% phần (đã solve LB-P1-1/2/3/4/5, LB-P2-1/3) — không nên redraw. Nhưng phần tier season reward 4-tier mâu thuẫn với decision 2026-04-19 "Keep OLD religious tier naming" + tạo dual-tier-system phức tạp. Giữ 6 tier có sẵn → 1 hệ thống tier duy nhất, badge "Vinh Quang Mùa Xuân 2026" cho top 3 mỗi tier (SPEC mục 9.2).
- Cách render section: 6 cards (3x2 desktop / 2x3 mobile) với tier name + colorHex + threshold + badge "BẠN" trên tier user hiện tại. Reuse `data/tiers.ts` (TIERS array + getTierByPoints).
- Trade-off: Mockup phải override 1 section khi code → designer cần biết để update mockup nếu redraw lần sau. Layout 6 cards cần adjust grid 4-col → 3x2 (desktop) hoặc 2x3 (mobile) — minor visual change.
- Impact: LB-P0-1 (i18n keys raw) — KHÔNG thêm `tierGold/Silver/Bronze/Iron*` keys; reuse `tiers.{newBeliever|seeker|disciple|sage|prophet|apostle}` đã có. LB-P0-4 (tier colors) — section "Xếp Hạng Mùa" dùng cùng 6 màu `colorHex` từ `data/tiers.ts`.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## 2026-05-01 — Quiz redesign Sprint 2: energy display = compact + keep score badge (hybrid)
- Quyết định: Energy widget render **inline** (label "NĂNG LƯỢNG" + 5 bars + số `100/100`) khớp mockup, NHƯNG giữ nguyên score badge "⚡ {score}" ở header top-right.
- Lý do: Mockup chỉ vẽ energy compact, không có score visible. Bug report đề xuất Option A (compact). Tuy nhiên score là metric quan trọng cho user trong-quiz (xem progress) — bỏ score sẽ giảm feedback loop. Hybrid giữ cả 2: energy inline (visual gọn), score badge header (consistent với app pattern).
- Trade-off: Header hơi đông (close + book + score badge), nhưng đã có pattern này từ trước (line 585-589 Quiz.tsx) — không phá tone.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-05-01 — Quiz redesign Sprint 2: background = radial gradient subtle
- Quyết định: Quiz screen background dùng `radial-gradient(ellipse at center, rgba(50,52,64,0.3) 0%, rgba(17,19,30,1) 70%)` thay vì 2 blob blurs hiện tại.
- Lý do: Mockup chứng minh radial gradient không phá Sacred Modernist tone — center sáng nhẹ giúp focus mắt vào câu hỏi (center-aligned). 2 blob blurs hiện tại scatter attention. Bug report (QZ-P2-4) cũng recommend radial.
- Trade-off: 1 lớp gradient thay 2 blob → giảm GPU work nhẹ. Lệch khỏi Home/Ranked pattern (dùng blobs), nhưng Quiz là task-focus screen, deserve khác biệt.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-05-01 — Quiz redesign Sprint 2: bookmark có 2 entry points (header + reveal panel)
- Quyết định: Giữ bookmark button trong reveal panel (sau khi sai, hiện tại) + thêm bookmark icon ở header top-right (mockup) — cùng endpoint `POST /api/me/bookmarks`.
- Lý do: Header bookmark cho "câu khó muốn ôn lại trước khi trả lời" (user nhìn thấy biết khó). Reveal panel bookmark cho "câu đã sai, muốn ôn" (sau context). 2 use cases khác nhau, không trùng. SPEC v3 mục 4.5 chỉ nói reveal panel, nhưng không cấm header.
- Trade-off: 2 entry points → user có thể bookmark 1 câu 2 lần (BE phải idempotent — verify `POST /api/me/bookmarks` đã handle dedupe). FE: `bookmarked` state shared giữa 2 buttons (1 store hoặc 1 query key).
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## 2026-05-01 — Home mode-card live hints (HM-P1-1) — 2 BE endpoints added

- Quyết định: Add `GET /api/groups/me` (current user's primary group) + `GET /api/tournaments/upcoming` (count + next LOBBY tournament) để power live hints cho 2 mode cards còn thiếu (Nhóm Giáo Xứ + Giải Đấu) trong H4 grid.
- Lý do: HM-P1-1 trong `docs/BUG_REPORT_HOME_POST_IMPL.md` — 2/6 mode cards render generic subtitle thay vì live data, làm giảm "này-có-gì-mới" feel của Home page. Mockup dụng ý 6/6 cards có live hint.
- "Upcoming" semantics cho tournament: trong entity `Tournament` không có field `startsAt` (chỉ có `startedAt` set khi bắt đầu thực sự). "Upcoming" maps sang `Status.LOBBY` (open for joining), `next` = lobby tournament tạo gần nhất. FE render "{count} đấu trường đang mở".
- Group endpoint trả về primary group (first by joined-at order) khi user thuộc nhiều nhóm — Home card chỉ cần 1 tên để render "Trong {groupName}". Khi không có nhóm → `{ hasGroup: false }`, FE render "Bạn chưa có nhóm".
- Trade-off:
  - 2 endpoints mới đều auth-required (consistent với rest of app, dù `/upcoming` về lý có thể public). Trade-off: unauthenticated visitors không thấy hint — chấp nhận được vì Home toàn bộ behind auth.
  - Lobby ordering "most recent first" thay vì "soonest startsAt": entity hiện không có `startsAt` field, không refactor schema cho task nhỏ. Khi BE add scheduled tournaments later → swap ordering ở 1 method (`TournamentService.getUpcomingTournaments`).
- Implementation:
  - BE: 1 commit thêm 2 controller endpoints + 2 service methods + 5 unit tests (3 group + 2 tournament).
  - FE: 1 commit thêm 2 TanStack queries + i18n keys (`home.modeHint.groupNone/groupIn/tournamentOpen`) + 4 unit tests trong `GameModeGrid.test.tsx`.
- Tests: BE 274/255 pass (1 fail + 17 errors all pre-existing baseline). FE 1045/1045 pass (zero failures).
- Closes HM-P1-1. BACKEND_GAPS_HOME_V2.md updated to "ALL WIRED".

---

## 2026-05-01 — AppLayout responsive, Direction B (drop desktop top bar)

- Quyết định: Trên desktop (≥ md) bỏ top bar; sidebar mang đầy đủ identity (logo "Bible Quiz" + notification bell + user card với 5-item dropdown + nav + Streak/Mission widgets footer). Trên mobile (< md) sidebar ẩn, dùng `MobileTopBar` (logo + bell + avatar dropdown) + `MobileBottomTabs` (4 tabs).
- Lý do: top bar trên desktop trùng với sidebar (avatar render 2 lần, identity thừa) — flagged HM-P0-1 trong `docs/BUG_REPORT_HOME_POST_IMPL.md`. Top bar chiếm ~80px chiều cao mà chỉ chứa logo + avatar.
- Trade-off:
  - Tăng số file layout (4 component mới: SidebarHeader / SidebarUserCard / MobileTopBar / MobileBottomTabs) + 2 reusable extract (NotificationBell / UserDropdown). Đối lại AppLayout.tsx giảm 284 → 115 LOC, thoải mái dưới ngưỡng 300 LOC của CLAUDE.md.
  - Notification bell trên desktop nay nằm cạnh logo trong sidebar (Option A) — mất một chỗ "rest" cho mắt (top bar trống) nhưng giải quyết duplicate identity.
  - Mobile bottom tabs giữ nguyên 4 mục (`Trang chủ / Xếp hạng / Nhóm / Cá nhân`) — labels đã đủ ngắn cho viewport 320px (HM-MB-2).
- Implementation (6 commits trên branch `feat/home-redesign-v2`):
  - `c2fe8fb chore(layout): scaffold components` — Task 1
  - `d4c877f feat(layout): NotificationBell + UserDropdown extracted, SidebarHeader + SidebarUserCard wired` — Task 2
  - `b2929bf feat(layout): MobileTopBar + MobileBottomTabs` — Task 3
  - `7f4da66 refactor(layout): AppLayout responsive` — Task 4
  - `baa3631 test(layout): visual regression baseline + i18n cleanup` — Task 5
  - cleanup commit này — Task 6
- Backend changes: ZERO (FE-only refactor).
- Reuse: notification panel logic + click-outside handler đã được port từ `components/Header.tsx` orphan (chỉ test files import, không production mount). Polished UX (timeAgo formatter, mark-as-read on click, mark-all-read header button, type-based routing) survive vào `NotificationBell.tsx` mới. Header.tsx + Header.module.css + Header.test.tsx đã được xóa trong Task 6 cleanup.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới.

---

## 2026-04-29 — Soft-pivot from Progressive Unlock to Open Access (game modes)

- Quyết định: Bỏ tier-based gates trên UI cho Tournament + Multiplayer + Mystery + Speed Round. Mọi user (kể cả tier 1) đều thấy đầy đủ 9 game mode cards. Tier không còn quyết định **access**, chỉ ảnh hưởng **perks** (XP×, energy regen, streak freeze) per §3.2.2. Ranked giữ tier-2 gate vì BE thực sự enforce trong `SessionService` (có early-unlock alternative đẹp).
- Lý do:
  - **Step 0 grep** phát hiện BE chỉ enforce 1 tier gate (Ranked trong `SessionService.java:82`). Tournament + Multiplayer + Mystery + Speed: BE accept mọi user, FE đang fake locks → UX misleading ("locked" but click vẫn vào được).
  - Target user là cộng đồng Tin Lành rộng (không chỉ thành viên hội thánh hiện tại). Lock 5/8 modes cho user mới = barrier quá cao cho launch v1.
  - Reference apps phù hợp: YouVersion / Bible Project (open access). Duolingo có CEFR tree thật sự lock — không match BibleQuiz scope.
- Trade-off:
  - Tier 1 user vào Tournament (bracket 1v1) hoặc Multiplayer Battle Royale có thể gặp tier 4+ → trải nghiệm thua liên tục. Mitigated bằng **subtle info icon hint** trên Tournament + Multiplayer cards: "Đối thủ có thể đã chơi lâu hơn bạn — chuẩn bị tinh thần!". KHÔNG dùng modal/scary warning — user ownership over choice.
  - Spec §3.2.3 ("Game mode unlocks per tier") nay outdated — flag TODO update spec sau launch.
- Implementation (5 commits + 2 fixes):
  - `e8cca0a feat(home): TierPerksTeaser` — aspirational next-tier perks card (XP×, energy regen, streak freeze) thay LockedModesTeaser ("5 modes locked")
  - `7ec1ab2 refactor(home): open Tournament + matchmaking hint` — bỏ Tournament `requiredTier:4`, thêm info icon trên Tournament/Multiplayer
  - `64e4353 refactor(home): wire TierPerksTeaser, drop LockedModesTeaser + tier-1 layout` — Home.tsx replace, GameModeGrid bỏ `layout` prop, xóa LockedModesTeaser
  - `aeb24a3 i18n: drop dead home.lockedTeaser keys` — cleanup
  - `b04dbe8 fix(auth): guard OAuth callback against StrictMode double-invoke` — phát hiện trong manual smoke test
  - `4e5b47d fix(security): exclude CORS preflight from rate limit` — phát hiện trong manual smoke test
- Backend changes: ZERO — soft pivot là FE-only refactor. BE tier gate cho Ranked giữ nguyên với early-unlock alternative.
- Net: -277 LOC LockedModesTeaser, +250 LOC TierPerksTeaser + tierPerks data, full FE regression 1001/1001 pass.
- Follow-ups (TODO post-launch):
  - **MATCHMAKING v1.1**: tier-based seeding cho Tournament/Multiplayer thay info icon
  - **SPEC v1.1**: rewrite §3.2.3 theo Open Access philosophy
  - **PRESTIGE v1.2**: TierPerksTeaser hiện trả null khi tier 6 — Prestige system slot vào đây
- KHÔNG thay đổi khi refactor trừ khi user feedback cho thấy lockout pattern là cần thiết (e.g., toxic competitive behavior).

---

## 2026-04-20 — Daily Challenge as secondary XP path (+50 XP per completion)

- Quyết định: Hoàn thành Daily Challenge = **+50 XP** vào `user_daily_progress.points_counted`, bổ sung cho Ranked là primary XP source. Superseds **partially** ADR "XP source of truth: Ranked only" ngay dưới — Ranked vẫn primary, Daily trở thành secondary casual path.
- Lý do: Early-unlock (≥80% / 10 câu Practice) chỉ phục vụ user có accuracy cao. User 70-79% mắc kẹt vô hạn — không đủ accuracy, không thể vào Ranked để tích XP. Daily +50 XP × 20 ngày = 1,000 XP → Tier 2 unlock theo retention loop, không phụ thuộc accuracy.
- Trade-off: Ranked không còn là nguồn XP duy nhất. Nhưng Daily cap ở 50 XP/ngày (1,500/tháng) vs Ranked 100-500/session → Ranked vẫn là primary progression driver. Daily chỉ phá thế bế tắc cho user casual.
- Idempotency: `DailyChallengeController.complete` đã guard bằng `hasCompletedToday` trước khi gọi `markCompleted`. XP credit nằm trong `markCompleted` → credit đúng 1 lần/ngày/user, không cần thêm guard mới.
- Scope: **CHỈ Daily Challenge** (endpoint `/api/daily-challenge/complete`). Practice, Weekly, Mystery, Speed vẫn KHÔNG grant XP — giữ Ranked + Daily là 2 XP sources duy nhất.
- Architecture note: Prompt ban đầu gợi ý detect completion trong `SessionService.submitAnswer` với `mode=daily`. Reality: Daily không đi qua `QuizSession` (dùng fake sessionId, FE-side scoring, dedicated `/api/daily-challenge/*` path). Chọn cho credit chạy ở `markCompleted` thay vì refactor cả Daily infrastructure qua QuizSession — tôn trọng boundary hiện có, giảm surface area.
- KHÔNG thay đổi khi refactor trừ khi metrics cho thấy rate sai (nếu quá nhiều user unlock Tier 2 qua Daily mà không play Ranked, cân nhắc giảm còn 30 XP/ngày).

---

## 2026-04-19 — XP source of truth: Ranked only (Practice không grant XP)
- Quyết định: **Chỉ Ranked mode tích XP** vào `user_daily_progress.points_counted`. Practice (và các mode khác như Daily / Weekly / Mystery / Speed) KHÔNG write pointsCounted. `totalPoints = SUM(points_counted)` qua tất cả ngày — do đó chỉ Ranked mới contribute tier progression.
- Luồng XP: `/api/ranked/sessions/{id}/answer` → trả `pointsToday` → FE gọi `/api/ranked/sync-progress` → BE (`RankedController`) write `user_daily_progress.points_counted`. Đây là single source of truth.
- Practice chỉ tích 2 thứ:
  1. `users.practice_correct_count` + `practice_total_count` (early-unlock accuracy path — xem ADR "Early Ranked unlock" ở dưới)
  2. `answers` + `quiz_session_questions` (history cho streak, smart question selection, weakness analysis)
- Lý do:
  - Tránh Practice (không tốn năng lượng, không timer) trở thành đường farm XP dễ hơn Ranked → leaderboard distort, Ranked mất ý nghĩa.
  - Ranked giữ vai trò "competitive progression" — tier tăng qua performance thực trong điều kiện áp lực (energy cost + timer).
  - Practice vẫn có giá trị rõ ràng: (a) onboarding path (unlock Ranked sớm qua accuracy), (b) learn without stakes, (c) tick streak + history.
- Trade-off:
  - User mới chưa unlock Ranked không có cách tích XP chuẩn — phải dựa early-unlock path.
  - FAQ và UI phải nói rõ "Practice không cho XP" để tránh confusion (đã update keys `help.items.howToPlay.a`, `howUnlockRanked.a`, `howEarnXp.a` vi+en).
- Thực thi: `SessionService.submitAnswer` KHÔNG gọi bất kỳ write UDP nào cho non-ranked modes. `SessionServiceTest.submitAnswer_practiceMode_doesNotWriteUserDailyProgress` là regression guard.
- KHÔNG thay đổi khi refactor trừ khi product thay đổi economy model.

---

## 2026-04-19 — Early Ranked unlock via Practice accuracy (≥80% / 10 questions)
- Quyết định: Tier-1 user có thể bypass ngưỡng 1,000 XP để chơi Ranked **nếu** đạt ≥80% accuracy qua ≥10 câu Practice (cumulative, không phải single-session). Flag permanent — không reset.
- Lý do: Users experienced với Kinh Thánh cảm thấy gate XP 1,000 quá chậm. Cho phép "earn your way fast" qua performance, không skip miễn phí. Nếu user chơi tốt = đủ kỹ năng cho Ranked. Nếu không → tiếp tục Practice path bình thường.
- Trade-off: Thêm column user (`earlyRankedUnlock` + 2 counters), thêm logic trong SessionService. Nhưng phức tạp chấp nhận được vì reward engaged users đúng mức + không phá economy tier (Tournament vẫn giữ tier 4 gate).
- Orthogonal design: flag này KHÔNG đổi XP threshold tier 2. User unlock sớm vẫn có tier=1 visible, chỉ là Ranked gate bypass.
- Policy thresholds: `EarlyRankedUnlockPolicy.MIN_QUESTIONS=10`, `MIN_ACCURACY_PCT=80`. Adjustable.
- Scope: Chỉ Ranked. Tournament (tier 4), Battle Royale, etc. vẫn gate bình thường.
- KHÔNG thay đổi khi refactor trừ khi có kết quả metrics cho thấy ngưỡng sai

---

## 2026-04-19 — Target audience expanded: Tin Lành toàn cầu (VN + English-speaking Protestants)
- Quyết định: Mở rộng target audience từ "Tin Lành Việt Nam" sang **Tin Lành toàn cầu** — cả người nói tiếng Việt và tiếng Anh. i18n cho seed data KHÔNG defer nữa mà là priority.
- Lý do: Product owner xác định scope. Bible Quiz là concept universal với Protestant audience toàn cầu; chỉ hỗ trợ VN giới hạn addressable market nghiêm trọng.
- Implications:
  - Seed data cần cả VI + EN versions cho mỗi câu hỏi
  - Backend query filter theo `language` đã có sẵn — OK
  - Frontend i18n (UI text) đã support EN — OK
  - Question content: 300 câu VI hiện tại cần EN translation
  - SQL legacy files (~915 câu VI) cần convert → JSON → translate → EN JSON
- Scope v1:
  - Convert existing SQL → VI JSON files (preserve curated content)
  - Document EN translation workflow (AI-assisted)
  - Ship VI first; roll out EN progressively per book
- Trade-off: Work lớn hơn (~2-3x content effort). Chấp nhận để unlock 10x addressable audience.
- Supersedes ADR v1 "target Tin Lành VN" (implicit — tier naming ADR remains valid, religious naming works for both).
- KHÔNG thay đổi trừ khi product owner rollback scope

---

## 2026-04-19 — Bible canon: Protestant only (66 books), NO Catholic deuterocanonical
- Quyết định: App support **Protestant canon** với 66 books. KHÔNG thêm 7 deuterocanonical books (Tobit, Judith, Wisdom of Solomon, Sirach/Ecclesiasticus, Baruch, 1-2 Maccabees) cũng như additions to Esther/Daniel.
- Lý do: Product owner chốt audience chính là Tin Lành. Religious tier naming (Tân Tín Hữu → Sứ Đồ) có thể đọc được với cả Công Giáo nhưng nội dung Kinh Thánh stick với 66 books Protestant.
- Scope: `data/bibleData.ts` giữ nguyên 66 entries. Backend question generation chỉ reference 66 books. Admin seed data không cần thêm Deuterocanonical questions.
- Trade-off: User Công Giáo sẽ miss Tô-bia, Huấn Ca... — product chấp nhận không target demographic này cho v1. Nếu mở rộng sau, option: thêm canon config (Protestant/Catholic) ở onboarding + filter books.
- KHÔNG thay đổi khi refactor trừ khi product owner thay đổi audience strategy.

---

## 2026-04-19 — Keep OLD religious tier naming (audience-driven), supersede SPEC_USER_v3 §3.1
- Quyết định: Giữ **OLD religious tier naming** — Tân Tín Hữu / Người Tìm Kiếm / Môn Đồ / Hiền Triết / Tiên Tri / Sứ Đồ. **Supersede** bảng tên light-themed (Tia Sáng / Ánh Bình Minh / Ngọn Đèn / Ngọn Lửa / Ngôi Sao / Vinh Quang) trong SPEC_USER_v3.md section 3.1.
- Lý do: Target audience là tín đồ Tin Lành + Công Giáo. Hệ tên religious mirror hành trình đức tin (tân tín hữu → người tìm kiếm → môn đồ → hiền triết → tiên tri → sứ đồ) — có semantic depth với user, tạo cảm giác "tiến bước trong đức tin". Hệ light-themed neutral hơn (phù hợp app đại chúng) nhưng mất nuance với audience chính.
- Trade-off: Hệ religious specific hơn → hạn chế expand audience ra non-religious user. Chấp nhận vì tên app "BibleQuiz" đã tự filter audience.
- Implementation state: Code đã ở trạng thái "half-migration" (i18n có duplicate keys `newBeliever` + `spark` cùng map về "Tân Tín Hữu"). Cleanup: bỏ NEW keys (`spark/dawn/lamp/flame/star/glory`), update `pages/Home.tsx`, `Ranked.tsx`, `LandingPage.tsx` dùng OLD keys consistently.
- Backend: `RankTier` enum constants giữ nguyên (TAN_TIN_HUU, NGUOI_TIM_KIEM...) — code identifier, không ảnh hưởng user.
- SPEC_USER_v3.md §3.1 sẽ được đánh dấu SUPERSEDED với tham chiếu ADR này.
- KHÔNG thay đổi khi refactor trừ khi product owner đổi audience strategy

---

## 2026-04-19 — Home game-mode recommendation: priority cascade (not scoring/ML)
- Quyết định: Highlight 1 card "most valuable" trên Home game-mode grid bằng priority-cascade rules (5 rule: streakAboutToBreak / onboarding / dailyAvailable / fullEnergy / default). Pure function client-side, không endpoint mới, không ML.
- Lý do: Uniform grid 9 card → Hick's Law choice paralysis. Smart highlight giúp user hành động đúng chỗ đúng lúc. Priority cascade thay vì scoring tổng vì: explainable (1 rule = 1 reason message), testable (mỗi branch 1 test), tunable (threshold là constant plain).
- Trade-off: Rules cứng sẽ miss edge case mà ML/scoring sẽ bắt được. Đổi lại: KHÔNG cần training data, KHÔNG cần analytics infra, KHÔNG cần model versioning. Khi có metrics → tune threshold (90 → 85) mà không relaunch.
- Signal sources: tái dùng TanStack Query từ `/api/me` (streak, totalPoints) + GameModeGrid's existing fetches (`/api/me/ranked-status` energy, `/api/daily-challenge` completed). Zero endpoint mới.
- Scope giới hạn 3 mode (practice/ranked/daily): các mode khác (groups/tournament/multiplayer/weekly/mystery/speed) KHÔNG vào recommendation v1 vì signal không local-only (cần friends / event data / WebSocket) — v2 cân nhắc.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## 2026-04-18 — Lifeline v1: Hint only, defer AskOpinion to v2
- Quyết định: Ship Lifeline Hint đầy đủ trong v1 (với adaptive algorithm + random fallback). Bỏ hoàn toàn UI AskOpinion button. Entity + enum giữ `ASK_OPINION` để v2 không cần migration.
- Lý do: AskOpinion phụ thuộc community answer data (≥10 samples/câu). Với DAU thấp giai đoạn đầu, tích lũy đủ data mất nhiều tuần/tháng → user click vô sẽ toàn "insufficient data" → UX bug. Hint degrades gracefully (fallback random), AskOpinion không.
- Trade-off: v1 chỉ có 1 lifeline thay vì 2. Đổi lại ship nhanh hơn 1 ngày, tránh feature feel broken. Data từ `Answer.answer` vẫn thu thập tự động → v2 activate chỉ cần add CommunityPollService + API endpoint + FE button (không cần backfill).
- Trigger activate v2: avg(samples per question, 90-day rolling) ≥ 30, hoặc DAU ≥ 1000 trong 7 ngày liên tiếp.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-18 — Lifeline Hint algorithm: Adaptive (eliminate lowest pick-rate) + random fallback
- Quyết định: Khi community data ≥ threshold (default 10 samples, last 90 ngày), eliminate wrong option có **lowest pick rate** (least-commonly chosen). Dưới threshold → random pick từ wrong candidates.
- Lý do: Eliminate obvious wrong TRƯỚC giữ tempting distractor → user vẫn phải suy nghĩ giữa correct và strong distractor. Giá trị giáo dục cao hơn 50-50 truyền thống (vốn loại cả obvious + distractor luôn → quá dễ). Random fallback đảm bảo feature work ngày 1 cho câu mới.
- Trade-off: Thêm 1 query aggregation mỗi lần gọi hint (cần index `answers(question_id, created_at)` đã add trong V28). Chi phí nhẹ (<50ms với cache warm).
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-18 — Lifeline quota mỗi mode, qua ConfigurationService (runtime override)
- Quyết định: Quota hint theo mode session: practice unlimited, ranked/single/weekly/mystery = 2, speed_round = 0 (disabled). Store dưới config keys `lifeline.hint.quota.<mode>` trong ConfigurationService (dynamic map, không DB).
- Lý do: Cho phép admin tuning mà không cần redeploy. Quota thấp đảm bảo strategic gameplay, không làm ranked quá dễ. Speed round disabled vì timer quá gấp, hint break flow.
- Trade-off: Config không persist qua restart (ConfigurationService là in-memory). Acceptable cho v1 vì default values làm tốt. Nếu cần persistence → migrate sang DB config table sau.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## 2026-04-05 — Mobile Auth: 3 endpoints riêng, không sửa web
- Quyết định: Tạo 3 endpoints mới `/api/auth/mobile/*` (login, refresh, google) trả refreshToken trong response body. Giữ nguyên 100% web endpoints (cookie-based refresh).
- Lý do: Mobile không có httpOnly cookie. Web dùng cookie an toàn hơn → không đổi. Mobile cần refresh token trong body để lưu AsyncStorage.
- Trade-off: 2 set endpoints cho cùng logic auth → duplicate code nhỏ (MobileAuthService reuse AuthService methods). Đổi lại, zero risk break web flow.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-05 — Google Mobile Auth: ID Token verification (không dùng auth code)
- Quyết định: Mobile Google login nhận Google ID Token trực tiếp (từ Google Sign-In SDK), verify bằng google-api-client library server-side. Khác web flow (authorization code → redirect).
- Lý do: Mobile không có browser redirect flow. Google Sign-In SDK trên mobile trả ID Token trực tiếp → backend verify chữ ký + audience.
- Trade-off: Thêm dependency google-api-client 2.7.0. Nhưng đây là official Google library, production-ready.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## 2026-04-04 — React Native: Expo + monorepo apps/mobile/
- Quyết định: Dùng Expo (blank-typescript template) thay vì bare React Native CLI. Đặt project trong `apps/mobile/` theo monorepo pattern (cùng level với `apps/web/` và `apps/api/`).
- Lý do: Expo đơn giản hơn cho prototype, không cần native build tools ban đầu. Monorepo pattern nhất quán với cấu trúc hiện tại. Có thể migrate sang bare workflow sau nếu cần native modules (Firebase, deep links).
- Trade-off: Expo có giới hạn với một số native modules (push notification cần expo-notifications thay vì @react-native-firebase). Đổi lại, dev cycle nhanh hơn nhiều, hot reload tốt, dễ test trên device thật qua Expo Go.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-04 — React Native: AsyncStorage cho refresh token (thay httpOnly cookie)
- Quyết định: RN không có httpOnly cookie → lưu refresh token trong AsyncStorage, gửi qua request body thay vì cookie. Access token vẫn in-memory.
- Lý do: React Native không có browser cookie mechanism. AsyncStorage là standard cho RN persistent storage. Backend cần endpoint variant chấp nhận refresh token trong body.
- Trade-off: AsyncStorage kém an toàn hơn httpOnly cookie (accessible by JS). Mitigation: Expo SecureStore có thể dùng sau cho production.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## 2026-04-03 — Test Data Strategy
- Quyết định: Spring Profile-based seeder + API trigger, NOT Flyway
- Lý do: Flyway chạy mọi env, test data chỉ cần dev/test. Seeder dùng @Profile("!prod") nên endpoint không tồn tại trong production
- Approach: TestDataAutoSeeder (@Order 200) chạy sau Flyway, idempotent (skip nếu admin@biblequiz.test đã tồn tại). Cleanup dùng email suffix @biblequiz.test
- Trade-off: Phải maintain seeder code khi schema thay đổi, nhưng an toàn hơn data.sql hoặc Flyway
- Key finding: User.Role enum chỉ có USER, ADMIN — không có GROUP_LEADER, CONTENT_MOD. Seeder chỉ dùng 2 roles này

---

## Naming & Conventions

## 2026-04-02 — Giữ livesRemaining/dailyLives thay vì rename sang energyRemaining/dailyEnergy
- Quyết định: Giữ nguyên field names `livesRemaining`/`dailyLives` trong DB, Entity, API response, và Frontend. KHÔNG rename sang `energyRemaining`/`dailyEnergy` dù SPEC-v2 dùng thuật ngữ "energy".
- Lý do: Code hiện tại FE ↔ BE đã consistent (cùng dùng `livesRemaining`/`dailyLives`). Rename sẽ touch 1 entity + 1 service + 1 controller + 4 FE files + Flyway migration + tất cả tests. Entity đã có comment `// SPEC-v2: "energy" system (stored as lives_remaining column for backward compat)` giải thích mapping. Semantic meaning giống nhau (100/day, -5 per wrong).
- Trade-off: Naming không match spec 100%, nhưng tránh được migration risk và multi-file refactor không cần thiết. Nếu cần rename trong tương lai → tạo task riêng với đầy đủ regression.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Cleanup & Dead Code

## 2026-03-28 — Xóa 8 dead infrastructure classes (1,649 lines)
- Quyết định: Xóa CircuitBreakerService, DistributedTransactionManager, EventSourcingService, InterServiceCommunicationService, PerformanceMonitoringService, BusinessRulesEngine, ServiceRegistry, PerformanceMonitoringAspect. Sửa HealthCheckController bỏ serviceRegistry khỏi health response.
- Lý do: Grep toàn bộ codebase xác nhận 0 references đến 7/8 class. ServiceRegistry chỉ dùng bởi HealthCheckController nhưng luôn trả `totalServices: 0, status: DOWN` gây nhầm lẫn. PerformanceMonitoringAspect pointcut trỏ đến packages cũ (`com.biblequiz.service`, `com.biblequiz.repository`) không còn tồn tại.
- Trade-off: Nếu sau này cần circuit breaker/distributed transactions, phải viết lại. Nhưng các class này là skeleton không có logic thật, viết lại từ đầu sẽ tốt hơn dùng code cũ.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Architecture & Code Structure

## 2026-03-15 — Tách package: api/ vs modules/ vs infrastructure/ vs shared/
- Quyết định: Code backend chia 4 top-level packages: `api/` (controllers + DTOs), `modules/` (business logic theo domain), `infrastructure/` (cross-cutting concerns), `shared/` (utilities dùng chung).
- Lý do: Tách biệt responsibilities — controller chỉ handle HTTP, business logic nằm trong modules, infrastructure (security, cache, exception, audit) độc lập domain. Mỗi module tự chứa entity/repository/service → dễ tìm, dễ test riêng biệt.
- Trade-off: Nhiều package hơn so với flat structure. Nhưng khi project lớn (12 modules), tổ chức theo domain giúp navigate nhanh hơn nhiều so với tổ chức theo layer (all entities in one folder, all services in another).
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-15 — Mỗi module = entity/ + repository/ + service/
- Quyết định: Mỗi module trong `modules/` follow pattern: `entity/` (JPA entities), `repository/` (Spring Data interfaces), `service/` (business logic). Controller nằm ngoài ở `api/`.
- Lý do: Module tự chứa (self-contained) — khi đọc module `room/`, thấy ngay tất cả entities, repos, services liên quan. Controller tách ra `api/` vì 1 controller có thể dùng nhiều module services.
- Trade-off: Controller phải import cross-module. Đổi lại, không có circular dependency giữa modules.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Game Modes & Scoring

## 2026-04-02 — WebSocket rate limit: Redis sliding window, fail-open
- Quyết định: Implement ChannelInterceptor (`WebSocketRateLimitInterceptor`) sử dụng Redis `INCREMENT` + `EXPIRE` cho sliding window counter. Mỗi user+event type có key riêng. Khi Redis unavailable → fail open (allow message).
- Lý do: STOMP interceptor chặn tại inbound channel trước khi message đến @MessageMapping. Redis counter đảm bảo consistent across server restarts. Fail-open tránh block gameplay khi Redis tạm down.
- Trade-off: Sliding window dạng fixed (không phải true sliding) — có thể burst 2x limit tại boundary giữa 2 windows. Chấp nhận được vì rate limits chủ yếu chống spam, không cần chính xác tuyệt đối.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-02 — Sudden Death tie-break: server-side resolution with max 5 rounds
- Quyết định: Implement sudden death logic trong TournamentMatchService. Server nhận cả 2 player answers cùng lúc qua `resolveSuddenDeathRound()`, resolve theo bảng: correct>wrong, both correct→compare elapsedMs (>200ms diff → faster wins), both wrong→continue. Max 5 rounds, sau đó so total elapsedMs, cuối cùng random.
- Lý do: Server-authoritative đảm bảo không cheat timing. Cả 2 answers submit cùng lúc tránh race condition. 200ms threshold tránh network jitter ảnh hưởng kết quả.
- Trade-off: Frontend/WebSocket controller cần collect cả 2 answers trước khi gọi resolve (thay vì xử lý từng answer riêng). Đổi lại, logic đơn giản và deterministic.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-20 — Tách riêng scoring engine cho mỗi game mode
- Quyết định: Mỗi multiplayer game mode có service riêng: `SpeedRaceScoringService`, `BattleRoyaleEngine`, `TeamScoringService`, `SuddenDeathMatchService`. Ranked mode có `ScoringService` riêng.
- Lý do: Mỗi mode có rules hoàn toàn khác nhau — Speed Race tính điểm theo tốc độ (100-150 pts), Battle Royale dùng elimination, Team vs Team có perfect round bonus +50, Sudden Death dùng king-of-the-hill queue. Gộp vào 1 class sẽ tạo god class với quá nhiều if/else.
- Trade-off: 5 service classes thay vì 1. Nhưng mỗi class < 100 lines, dễ test riêng, dễ thêm mode mới mà không sợ break mode cũ.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-20 — Ranked scoring: quadratic speed bonus + combo multiplier
- Quyết định: Công thức điểm ranked: `base (8/12/18) + floor(base * 0.5 * speedRatio²)`, combo x1.2 (5-streak) / x1.5 (10-streak), daily first x2. Time limit = 30s.
- Lý do: Quadratic curve (thay vì linear) tạo cảm giác rewarding hơn cho câu trả lời nhanh — khác biệt lớn giữa 3s và 10s, nhưng ít khác biệt giữa 25s và 30s. Combo khuyến khích chơi liên tục thay vì random guess.
- Trade-off: Phức tạp hơn cho user hiểu, nhưng feel tốt hơn khi chơi. Max score per question = 18 + 9 = 27 (hard, instant) * 1.5 (combo) * 2 (daily) = 81 pts.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-20 — Battle Royale: không loại ai nếu TẤT CẢ trả lời sai
- Quyết định: Trong Battle Royale, nếu tất cả active players đều trả lời sai hoặc không trả lời → không ai bị loại, round tiếp tục.
- Lý do: Tránh stalemate — nếu câu hỏi quá khó, loại tất cả sẽ kết thúc game đột ngột. Giữ game tiếp tục cho đến khi ít nhất 1 người trả lời đúng.
- Trade-off: Có thể kéo dài game nếu nhiều câu khó liên tiếp. Nhưng UX tốt hơn so với game kết thúc đột ngột không ai thắng.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-20 — Sudden Death: king-of-the-hill thay vì bracket
- Quyết định: Sudden Death mode dùng queue — champion giữ vị trí, challenger mới lên thách đấu. Winner stays, loser out.
- Lý do: Thú vị hơn bracket thông thường — tạo "king" narrative, khán giả có thể cổ vũ, winning streak có giá trị. Đơn giản hơn bracket elimination cho 1v1 liên tiếp.
- Trade-off: Player vào sau queue bất lợi (champion đã warm-up). Đổi lại, tạo drama và excitement tự nhiên.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Data & Persistence

## 2026-03-15 — Flyway migration-first, không dùng Hibernate ddl-auto (production)
- Quyết định: Schema changes qua Flyway migrations (V1-V12). Production: `ddl-auto: none`. Dev: `ddl-auto: update` + Flyway enabled.
- Lý do: Flyway versioned migrations đảm bảo schema nhất quán giữa environments, có thể review SQL trước khi apply, rollback bằng cách tạo migration mới. `ddl-auto: create-drop` đã gây bug (mất data, column mismatch với SQL seed files).
- Trade-off: Phải viết SQL migration thủ công. Đổi lại, an toàn cho production deploys, không bao giờ mất data.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-15 — FlywayConfig: auto-repair trước khi migrate
- Quyết định: `FlywayConfig.java` gọi `flyway.repair()` trước `flyway.migrate()` mỗi lần app start.
- Lý do: Nếu migration fail giữa chừng (ví dụ: V9), flyway_schema_history bị corrupt → app không start được. Auto-repair fix checksum mismatch tự động.
- Trade-off: Có thể mask underlying migration bugs. Nhưng trong dev environment, tốt hơn so với manual repair mỗi lần DB bị lỗi.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-15 — UUID string cho primary keys, không dùng auto-increment
- Quyết định: Tất cả entity dùng `String id` (`VARCHAR(36)`), generate bằng `UUID.randomUUID().toString()` trong service layer.
- Lý do: UUID không predictable (security — tránh IDOR), không cần DB sequence (distributed-friendly), merge data giữa environments không conflict.
- Trade-off: Larger index size (36 bytes vs 8 bytes BIGINT), slightly slower joins. Nhưng với quy mô app này, không ảnh hưởng đáng kể.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-15 — JSON columns cho list fields (correctAnswer, questionIds, tags)
- Quyết định: Dùng `@Convert(converter = JsonListConverter.class)` để lưu `List<String>` / `List<Integer>` dưới dạng JSON string trong DB column.
- Lý do: Đơn giản hơn normalized table (không cần join table cho correctAnswer chỉ có 1-4 elements). MySQL 8.0 hỗ trợ JSON natively.
- Trade-off: Không query được bên trong JSON bằng standard SQL (cần JSON_CONTAINS). Nhưng app chỉ cần read/write toàn bộ list, không query partial.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Cache & State Management

## 2026-03-15 — Redis cho game state, MySQL cho persistent data
- Quyết định: Game state (room state, ranked session, current question) lưu Redis với TTL. User data, scores, achievements lưu MySQL.
- Lý do: Game state là ephemeral — chỉ cần trong lúc chơi, tự cleanup sau game end. Redis O(1) read/write phù hợp real-time game loop. MySQL cho data cần persist lâu dài.
- Trade-off: Mất game state nếu Redis restart. Nhưng game session chỉ 5-30 phút, player có thể rejoin/restart.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-20 — RankedSessionService TTL 26 giờ
- Quyết định: Ranked session trong Redis có TTL 26h (thay vì 24h).
- Lý do: 26h buffer cho timezone — user ở UTC+7 chơi lúc 23:00, session phải tồn tại đến khi daily reset ở UTC midnight + buffer. 24h chính xác sẽ expire trước khi user kịp sync progress.
- Trade-off: 2h extra memory usage. Negligible cost.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-20 — RoomStateService: comma-separated strings cho queue
- Quyết định: Sudden Death queue lưu trong Redis dưới dạng comma-separated user IDs (ví dụ: `"user-1,user-2,user-3"`).
- Lý do: Đơn giản, human-readable khi debug Redis trực tiếp. Queue operations (poll, peek) dễ implement bằng string split/join.
- Trade-off: Không type-safe, manual parsing, giới hạn bởi max string size. Nhưng queue hiếm khi > 32 players → không vấn đề.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Security

## 2026-03-15 — JWT stateless + Redis blacklist cho logout
- Quyết định: Auth bằng JWT (access 15 phút + refresh 30 ngày). Logout invalidate bằng Redis blacklist (key = JTI, TTL = remaining expiration).
- Lý do: JWT stateless = không cần session store cho mỗi request. Blacklist chỉ cần cho tokens chưa expired khi user logout — nhỏ hơn nhiều so với session store.
- Trade-off: Token vẫn valid trong window giữa issue và blacklist check (milliseconds). Acceptable risk.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-15 — STOMP simple broker thay vì external broker
- Quyết định: WebSocket dùng Spring built-in simple message broker, không dùng RabbitMQ/Redis Pub/Sub.
- Lý do: Single server deployment — không cần distributed message routing. Simple broker = zero infrastructure overhead, latency thấp nhất.
- Trade-off: Không horizontal scale được (2 server instances sẽ không share WS state). Khi cần scale, migrate sang Redis Pub/Sub hoặc RabbitMQ.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-28 — JWT secret phải là base64-encoded
- Quyết định: Tất cả JWT secret trong config phải là base64-encoded string, thêm test validate config secret.
- Lý do: Bug production — `application-dev.yml` có JWT secret plaintext (chứa `-`), JwtService dùng `Decoders.BASE64.decode()` → crash khi OAuth login. Unit test không phát hiện vì dùng hardcoded valid base64 secret khác config thật.
- Trade-off: Dev cần encode secret trước khi đặt vào config. Đổi lại, tránh runtime crash hoàn toàn.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-28 — Secrets qua env vars + spring-dotenv
- Quyết định: Google OAuth credentials chỉ lưu trong `.env` files (gitignored). Config files dùng `${GOOGLE_CLIENT_ID}` không có default value. Dùng `spring-dotenv` để Spring Boot tự đọc `.env`.
- Lý do: GitHub Push Protection chặn push vì phát hiện secrets hardcode. Từ đó, mọi secret chỉ qua env vars.
- Trade-off: Dev mới cần tạo `.env` file thủ công. Đổi lại, không bao giờ leak secrets vào git history.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Frontend

## 2026-04-02 — Deprecate Rooms.tsx, redirect /rooms → /multiplayer
- Quyết định: Rooms.tsx chỉ còn `<Navigate to="/multiplayer" replace />`. Multiplayer.tsx thay thế hoàn toàn.
- Lý do: Multiplayer đã có đầy đủ: room discovery, join by code, create room, game mode filter. Rooms.tsx là phiên bản cũ với inline SVG icons, old design.
- Trade-off: URL `/rooms` vẫn hoạt động (redirect).
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-02 — Merge JoinRoom vào Multiplayer, redirect /room/join
- Quyết định: JoinRoom.tsx chỉ còn `<Navigate to="/multiplayer" replace />`. Multiplayer.tsx đã có join-by-code input (Stitch design).
- Lý do: Multiplayer đã có đầy đủ join flow (input code, validate, navigate to lobby). JoinRoom là page cũ duplicate functionality.
- Trade-off: URL `/room/join` vẫn hoạt động (redirect), không break bookmarks.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-02 — Applied SPEC-v2 Errata [FIX-001 through FIX-012]
- Quyết định: Apply 12 errata amendments to SPEC-v2.md. Key changes: Java 21→17 (FIX-001), abandoned session energy penalty (FIX-002), tournament bye/seeding rules (FIX-003), sudden death tie resolution (FIX-004), friend system deferred to v2.5 (FIX-005), share card Phase 1 = frontend canvas (FIX-006), daily challenge UTC timezone (FIX-010), WebSocket rate limits (FIX-011).
- Lý do: Errata fixes spec gaps found during implementation. Each fix documented in SPEC_V2_ERRATA.md.
- Trade-off: Some fixes (FIX-003, FIX-004) add complexity. Deferred features (FIX-005 friend, FIX-007 offline) reduce scope but clarify deliverables.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-04-02 — Share Card Phase 1: Frontend canvas, không Puppeteer
- Quyết định: Share card render bằng frontend Canvas → toBlob() → upload S3. Không dùng Puppeteer container.
- Lý do: Puppeteer container là premature optimization cho current scale. Frontend canvas đủ cho Phase 1.
- Trade-off: Image quality khác nhau giữa devices. Khi scale lên → migrate sang Puppeteer server-side.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-29 — Accent colors riêng cho mỗi Game Mode card
- Quyết định: Mỗi game mode card dùng accent color riêng: Practice #4a9eff (blue), Ranked #e8a832 (gold), Daily #ff8c42 (orange), Multiplayer #9b59b6 (purple)
- Lý do: Giúp user phân biệt nhanh giữa các mode qua visual cue. Stitch design system cho phép accent colors ngoài palette chính cho functional differentiation.
- Trade-off: Thêm 3 màu ngoài design system chính, nhưng chỉ dùng cho game mode cards.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-29 — Practice + Ranked tự thiết kế (không có Stitch screen)
- Quyết định: Tạo Practice.tsx và Ranked.tsx theo design tokens từ DESIGN_STATUS.md thay vì chờ Stitch design
- Lý do: Hai routes cần hoàn thành để Game Mode Hub hoạt động end-to-end. Design system đã đủ mature.
- Trade-off: Có thể cần update lại nếu Stitch tạo design chính thức, nhưng logic/data flow giữ nguyên.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-29 — GameModeGrid tách thành component riêng
- Quyết định: Tạo GameModeGrid.tsx riêng thay vì inline trong Home.tsx
- Lý do: Component có logic riêng (4 API calls, countdown timer, state management), tách ra giữ Home.tsx clean.
- Trade-off: Thêm 1 file, nhưng separation of concerns tốt hơn.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-03-28 — Migrate AuthContext → Zustand store
- Quyết định: Chuyển AuthContext (global state) sang Zustand store (`src/store/authStore.ts`). Giữ ErrorContext vì nó là tree-scoped UI concern (render toasts trong React tree).
- Lý do: CLAUDE.md rule: "State global dùng Zustand — không dùng Context cho global state". AuthContext quản lý user/auth state toàn app = global state thuần. ErrorContext render `<ErrorToast>` components = cần React tree context.
- Trade-off: Zustand store không có Provider wrapper → cần gọi `checkAuth()` manually khi app mount. Đổi lại, state accessible ngoài React components (middleware, interceptors).
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Dependencies

## 2026-03-15 — Chọn stack chính
- Quyết định: Spring Boot 3.3 + MySQL 8.0 + Redis 7 + Vite/React 18.
- Lý do:
  - **Spring Boot**: Ecosystem lớn nhất Java, OAuth2/WebSocket/JPA built-in, production-ready.
  - **MySQL 8.0**: JSON support, UTF8MB4 cho tiếng Việt, phổ biến → dễ tìm hosting.
  - **Redis 7**: Sub-millisecond latency cho game state, built-in TTL, pub/sub sẵn cho future scaling.
  - **JJWT 0.11.5**: Lightweight JWT library, không cần full Spring Security OAuth2 resource server.
  - **Flyway**: Industry standard DB migration, tốt hơn Liquibase cho SQL-first approach.
  - **spring-dotenv**: Load `.env` files mà không cần external tools (dotenv-java alternative phức tạp hơn).
  - **springdoc-openapi**: Auto-generate Swagger UI từ annotations, zero config.
- Trade-off: Java verbose hơn Kotlin/Go. Nhưng team quen, ecosystem mature, hiring dễ.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

---

## Testing

## 2026-03-28 — Unit test phải dùng config values thật
- Quyết định: Test không được mock/hardcode config values khác với config thật. Phải có integration test hoặc config validation test kiểm tra config file thật.
- Lý do: JwtServiceTest dùng base64 secret hardcode khác `application-dev.yml` → JWT decode crash ở runtime nhưng test pass. Gap giữa test và reality.
- Trade-off: Test setup phức tạp hơn (cần sync với config). Đổi lại, phát hiện config bugs sớm.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới


---

## 2026-05-01 — Ranked redesign V2: defer seasonRankDelta to v1.1 (Option C)
- Quyết định: `seasonRank trend` column trong R5 SeasonCard render placeholder (`em-dash`) thay vì ship snapshot infrastructure.
- Lý do:
  - Option A (daily snapshot table) cần Flyway migration `season_ranking_snapshots` + cron job 00:00 UTC + cleanup logic. ~4-6h work cho 1 column phụ.
  - Option B (compute on-the-fly) cần thêm `points_at_eod` field trên `UserDailyProgress` + back-fill query. Vẫn ~3-4h.
  - Option C (defer): BE trả `seasonRankDelta = null`, FE render em-dash với `data-testid="ranked-season-trend"`. Khi v1.1 thêm snapshot → flip 1 field, FE auto picks up.
- Trade-off: Một column trong 3-col Season card không có nội dung động cho launch. Bù lại unblock 12 fix khác (R1-R11) ship đúng deadline tiền-launch.
- KHÔNG thay đổi khi refactor trừ khi có lý do mới

## 2026-05-01 — Ranked redesign V2: useRankedPage hook owns page-level data
- Quyết định: Trích `fetchStatus + fetchMyRank + fetchTierProgress + countdown ticker + visibility refresh` từ Ranked.tsx vào `hooks/useRankedPage.ts`. Page chỉ orchestrate JSX (161 LOC, từ 698).
- Lý do:
  - 698 LOC vi phạm 300-LOC component ceiling (CLAUDE.md).
  - 3 fetch funcs + 2 useEffects + 7 useState là page-specific concerns, không component-specific → không nên ở trong page tsx.
  - Sub-components R1-R8 đã extract → page giờ là pure orchestrator, hook là natural place cho data logic.
- Trade-off: Một file thêm để maintain. Nhưng: testable hook (sẽ viết unit test ở R12 v1.1), Ranked.tsx giờ readable trong 1 màn hình, các page tương lai có thể follow pattern này (ví dụ Home dashboard).
- KHÔNG thay đổi khi refactor trừ khi có lý do mới
