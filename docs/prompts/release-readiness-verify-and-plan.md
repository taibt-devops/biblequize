# Prompt — Verify release readiness gaps + propose fix plan

> **Mode**: 2 phase — Phase 1 VERIFY (read-only, không edit code), Phase 2 PLAN
> (đề xuất, không execute fix). KHÔNG được fix code trong session này.
>
> **Context**: Trong session trước với product owner, agent assistant đã
> liệt kê 23 gap để release. Prompt này yêu cầu Claude Code verify lại
> từng claim độc lập (không trust assistant) — sau đó nếu confirm true
> thì propose plan fix theo priority.
>
> **Output expected**: 1 verification report (~600 từ) + 1 fix plan
> (~800 từ). KHÔNG có code change.

---

# PROMPT FOR CLAUDE CODE

```
# Verify release readiness assessment + propose fix plan

## Background

Project: BibleQuiz (Spring Boot 3.3 + React 18 + MySQL + Flyway).
Trạng thái: post-MVP, đang đánh giá đã sẵn sàng release public chưa.

Một assistant đã list 23 gap. Claim của assistant đôi khi sai (ví dụ
trước đây đã từng claim Practice grant XP nhưng thực tế code không
wire). Bạn cần verify TỪNG claim một cách độc lập, không trust assistant.

## Read FIRST (Think Before Code)

1. CLAUDE.md — operational rules + "Known Issues & Tech Debt" section
2. SPEC_v4.md — current feature spec, đặc biệt §6 (Streak wired vs
   spec-only) và §13 (Deferred features)
3. DECISIONS.md — ADRs cho context

KHÔNG đọc các file source code chi tiết trước — chỉ verify khi cần
check một claim cụ thể.

## PHASE 1 — VERIFICATION (read-only)

Cho mỗi claim dưới đây, verify bằng cách đọc/grep file thực tế.
Output mỗi claim với 1 trong 4 verdict:

- ✅ **CONFIRMED** — Claim đúng. Đính kèm evidence (file:line hoặc grep result).
- ❌ **REFUTED** — Claim sai. Đính kèm counter-evidence + explanation.
- ⚠️ **PARTIAL** — Đúng một phần. Mô tả phần đúng vs phần sai.
- ❓ **UNVERIFIABLE** — Không đủ info trong codebase để verify (vd: cần check infra deploy).

### Hard blockers (claims #1-12)

#### Infrastructure
1. **No `docker-compose.yml` cho production** at repo root.
   - Verify: `ls *.yml docker-compose*` ở root + `find . -name "docker-compose*" -not -path "*/node_modules/*"`
   - Lưu ý: CLAUDE.md có mention `docker compose up -d mysql redis` — phải có file đâu đó cho dev.

2. **No web Dockerfile** at `apps/web/Dockerfile`.
   - Verify: `ls apps/web/Dockerfile* apps/api/Dockerfile*`

3. **No reverse proxy / SSL config** in repo.
   - Verify: `find . -name "nginx*" -o -name "Caddyfile" -not -path "*/node_modules/*"`

4. **No DB backup strategy** documented or scripted.
   - Verify: `find . -name "*backup*" -o -name "mysqldump*" -not -path "*/node_modules/*"`

#### Known Issues từ CLAUDE.md (claim chính xác hay đã fix?)
5. **CSP có `unsafe-inline` + `unsafe-eval` trong script-src** (CLAUDE.md issue #4).
   - Verify: đọc `apps/web/vite.config.ts` — search "unsafe-inline" và "unsafe-eval".

6. **`useWebSocket.ts` không gửi JWT token** (CLAUDE.md issue #6).
   - Verify: `grep -n "token\|jwt\|Authorization" apps/web/src/hooks/useWebSocket.ts`
   - Compare với `useStomp.ts` pattern.

7. **`useWebSocket.ts` useEffect dependency `[]` thiếu `[url]`** (CLAUDE.md issue #7).
   - Verify: đọc useEffect array trong useWebSocket.ts.

8. **`localStorageClearDetector.ts` monkeypatch + polling không cleanup** (CLAUDE.md issue #8).
   - Verify: `apps/web/src/utils/localStorageClearDetector.ts` có setInterval / monkey patch không cleanup không.

9. **`RequireAdmin.tsx` role check case-sensitive bug** (CLAUDE.md issue #9).
   - Verify: `apps/web/src/contexts/RequireAdmin.tsx` — check toUpperCase normalization.

#### Content
10. **23 books thiếu hoàn toàn** (chỉ 43/66 sách có VI seed).
    - Verify: `ls apps/api/src/main/resources/seed/questions/*_quiz.json | grep -v "_en\." | wc -l`
    - Compare với 66 books table trong PROMPT_GENERATE_QUESTIONS.md.

11. **28/43 books thiếu EN pair** (chỉ 15 sách có EN file).
    - Verify: `ls apps/api/src/main/resources/seed/questions/*_quiz_en.json | wc -l`

#### Testing
12. **Playwright E2E chưa setup**.
    - Verify: `ls apps/web/playwright.config.ts apps/web/tests/e2e/ 2>/dev/null`
    - Check `package.json` scripts có `playwright` không.

### Soft blockers (claims #13-23)

#### Feature gaps
13. **Daily Challenge không tăng streak**.
    - Verify: `grep -n "StreakService\|recordActivity" apps/api/src/main/java/com/biblequiz/modules/daily/service/DailyChallengeService.java`
    - Confirm `markCompleted` không call `recordActivity`.

14. **Daily Challenge không grant XP**.
    - Verify: `grep -n "setPointsCounted\|UserDailyProgress" apps/api/src/main/java/com/biblequiz/modules/daily/`

15. **`StreakService.getStreakBonusPercent` exists nhưng never called**.
    - Verify: `grep -rn "getStreakBonusPercent" apps/api/src/main/java/`
    - Đếm số call sites. Nếu chỉ có declaration → confirmed.

16. **Streak milestone badges (7/30/100 days) không được award**.
    - Verify: `grep -n "perfect_20\|streak_7\|streak_30\|streak_100" apps/api/src/main/java/com/biblequiz/modules/achievement/service/AchievementService.java`
    - List achievements được grant — có badge cho 7/30/100 day daily streak không?

#### Observability + Operational
17. **Không có Sentry/error tracking integration**.
    - Verify: `grep -rn "@sentry\|Sentry\|datadog" apps/web/src apps/web/package.json apps/api/pom.xml`

18. **Không có analytics (GA/PostHog)**.
    - Verify: `grep -rn "gtag\|google-analytics\|posthog\|mixpanel" apps/web/src apps/web/package.json apps/web/index.html`

19. **Không có email service integration**.
    - Verify: `grep -rn "JavaMailSender\|@Email\|sendgrid\|resend\|amazon-ses" apps/api/src/main/java apps/api/pom.xml`
    - NotificationService có gọi email không?

20. **Không có rate limiting cho REST endpoints** (chỉ WebSocket có).
    - Verify: `grep -rn "Bucket4j\|RateLimit\|rate.limit\|@RateLimited" apps/api/src/main/java`
    - Compare với `WebSocketRateLimitInterceptor` (đã có cho WS).

21. **Không có cookie consent** (GDPR requirement nếu serve EU).
    - Verify: `grep -rn "cookie.consent\|gdpr\|CookieConsent" apps/web/src`

22. **Account deletion endpoint** — claim "mention trong Terms but không biết wired chưa".
    - Verify: `grep -rn "deleteAccount\|DELETE.*me\|deleteUser" apps/api/src/main/java/com/biblequiz/api/`
    - Có endpoint `DELETE /api/me` không? Có UI button trong Settings không?

23. **Không có data export endpoint** (GDPR right to portability).
    - Verify: `grep -rn "exportUserData\|/api/me/export\|GDPR" apps/api/src/main/java`

## Output format Phase 1

```markdown
# Verification Report

| # | Claim (rút gọn) | Verdict | Evidence | Notes |
|---|----|----|----|----|
| 1 | No prod docker-compose | ✅ CONFIRMED | `find` returns 0 files | Dev compose có thể nằm ngoài repo |
| 2 | No web Dockerfile | ... | ... | ... |
...
| 23 | No data export endpoint | ... | ... | ... |

## Summary

- Total claims: 23
- ✅ CONFIRMED: X
- ❌ REFUTED: Y  (list nào sai để assistant rút kinh nghiệm)
- ⚠️ PARTIAL: Z
- ❓ UNVERIFIABLE: W
```

## PHASE 2 — FIX PLAN (chỉ chạy sau Phase 1)

DỰA TRÊN verdict từ Phase 1, propose fix plan. Bỏ qua các claim REFUTED.
Cho các claim CONFIRMED + PARTIAL, group lại theo:

### Tier A — Pre-internal-beta (1-2 tuần effort)

Items phải fix TRƯỚC khi mời 10-20 user trusted test:
- Production deploy minimal (docker-compose prod, web Dockerfile, SSL)
- 9 known issues critical từ CLAUDE.md (claims 5-9)
- Sentry hoặc minimal error tracking
- Daily extends streak (prompt sẵn `docs/prompts/daily-challenge-extends-streak.md`)

Mỗi item: filename(s), effort estimate (giờ), dependency với items khác.

### Tier B — Pre-closed-beta (1 tháng)

Items phải fix TRƯỚC khi mở rộng 100-200 user qua invite:
- 23 books missing (content)
- EN pair cho 5 core books
- Playwright E2E setup + 5 critical paths
- Email service
- Rate limiting REST endpoints
- Account deletion + data export (legal)

### Tier C — Pre-public launch (1 tháng sau closed beta)

Items có thể defer nhưng phải có khi mở public:
- Cookie consent banner
- Analytics integration
- DB backup automation
- Streak score bonus wire-up
- Streak milestone badges
- Marketing landing page content polish

## Output format Phase 2

```markdown
# Fix Plan

## Tier A — Pre-internal-beta (Z weeks)

### A1: Production deploy minimal
- Files: docker-compose.prod.yml (NEW), apps/web/Dockerfile (NEW), nginx.conf (NEW)
- Effort: 2-3 ngày
- Dependencies: cần biết domain + hosting choice trước
- Acceptance: `curl https://staging.biblequize.com/api/me` trả 401 (work)
...

## Tier B — Pre-closed-beta

...

## Tier C — Pre-public launch

...

## Total estimate

- Tier A: X weeks
- Tier B: Y weeks
- Tier C: Z weeks
- Total to public launch: ~3-4 months realistic

## Risk callouts

- (list any items có risk lớn — vd domain/SSL phụ thuộc external, content gen
  phụ thuộc AI quota, etc.)
```

## Quy tắc phải tuân theo

1. **KHÔNG fix code** trong session này. Chỉ verify + plan.
2. **KHÔNG tin assistant claim** — verify từng item.
3. **KHÔNG suy đoán** — nếu unverifiable thì mark ❓, không guess.
4. **Bằng chứng cụ thể** — mỗi verdict phải có file:line hoặc grep
   command result, không nói "tôi nghĩ vậy".
5. **Effort estimate** dựa trên kinh nghiệm thực — không inflate cũng
   không underestimate. Mark "unknown" nếu không chắc.
6. **Không mở scope** — các "nice-to-have" outside 23 claims (vd PWA,
   mobile native, premium tier) KHÔNG đưa vào plan này. Tạo issue riêng
   nếu cần discuss.

## Output expected

Gửi report ngắn:
1. **Verification table** (23 rows + summary).
2. **Fix plan** chia 3 tier với effort estimate.
3. **Top 3 surprises** — claim nào assistant sai khá nhiều / không ngờ
   tới? Hoặc gap NÀO không trong list 23 mà bạn phát hiện thêm?

KHÔNG kèm code diff. KHÔNG tạo TODO entries. Pure analysis output.
```

---

## Ghi chú thêm (cho người đọc lại)

- Prompt này thiết kế để assistant đã chạy NHIỀU sessions và có thể đã
  drift khỏi reality. Phase 1 verify là safety net.
- Sau khi Claude Code return Phase 1 + 2, mới decide:
  - Fix Tier A items qua từng prompt riêng (mỗi item 1 prompt)
  - Hoặc nếu prefer, gộp Tier A vào 1 mega-prompt
- Các prompt deferred khác (`daily-challenge-extends-streak.md`,
  `church-group-websocket-realtime.md`) sẽ map vào Tier A/B tự nhiên.
- Effort estimate sẽ giúp PM đưa go/no-go decision cho beta launch date.

## Acceptance của session này

Session Claude Code thành công nếu:
- Output có cả Phase 1 + Phase 2.
- Không có code change.
- Effort estimate có defensive (range thay vì điểm số 1 chính xác).
- Top 3 surprises section có ít nhất 1 item assistant chưa biết.
