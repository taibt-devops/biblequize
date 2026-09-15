# TODO

> Task tracker. Active TODOs ở dưới. DONE/SUPERSEDED đã chuyển sang [`docs/todo/archive/`](docs/todo/archive/).
> Format mỗi task file theo template CLAUDE.md §Quy trình quản lý Task.

## Active (26)

> Dọn 2026-06-22: 23 task ghi "TODO/DONE" nhưng đã verify hoàn thành → archive (xem git log + Archive bên dưới). Bảng này giờ chỉ còn việc THỰC SỰ đang mở.

| Date | Title | Status | Detail |
|---|---|---|---|
| 2026-09-15 | Flyway drift: thêm migration idempotent cho cột `user_daily_progress.asked_question_ids` (FWD-1..2) | DONE | [detail](docs/todo/active/2026-09-15-flyway-udp-asked-question-ids.md) |
| 2026-09-15 | Favicon cache-busting: vite plugin gắn `?v=<hash>` vào favicon/manifest href (FCB-1) | DONE | [detail](docs/todo/active/2026-09-15-favicon-cache-busting.md) |
| 2026-07-11 | Soạn câu hỏi 5 sách Thơ Ca (Gióp/Thi Thiên/Châm Ngôn 100, Truyền Đạo 60, Nhã Ca 40) — fan-out 40 agent (PB-1..4) | DONE | [detail](docs/todo/active/2026-07-11-poetry-books-questions.md) |
| 2026-07-11 | PWA đầy đủ: thêm Service Worker (vite-plugin-pwa) — installable + offline cache, guard bản Capacitor (PWA-1..2) | IN PROGRESS | [detail](docs/todo/active/2026-07-11-pwa-service-worker.md) |
| 2026-07-11 | Bỏ Tutorial Overlay ở Home (tour giới thiệu "Đã hiểu" lần đầu) — gỡ + dọn store/i18n/test + spec §18 (RTO-1) | DONE | [detail](docs/todo/active/2026-07-11-remove-home-tutorial-overlay.md) |
| 2026-06-24 | Soạn 100 câu Dân Số Ký mới + bản EN (Haladyna × Bloom) qua skill bible-quiz-authoring (N100-1..4) | DONE | [detail](docs/todo/active/2026-06-24-numbers-100-questions.md) |
| 2026-06-24 | Soạn 100 câu/sách cho 12 sách Lịch Sử (Giô-suê…Ê-xơ-tê) qua skill bible-quiz-authoring (HB-1..12) | DONE | [detail](docs/todo/active/2026-06-24-historical-books-100-questions.md) |
| 2026-06-24 | Soạn 100 câu Phục Truyền Luật Lệ Ký mới (Haladyna × Bloom) qua skill bible-quiz-authoring (D100-1..FINAL) | IN PROGRESS | [detail](docs/todo/active/2026-06-24-deuteronomy-100-questions.md) |
| 2026-06-24 | Soạn 100 câu Lê-vi Ký mới (Haladyna × Bloom) qua skill bible-quiz-authoring (L100-1..FINAL) | IN PROGRESS | [detail](docs/todo/active/2026-06-24-leviticus-100-questions.md) |
| 2026-06-24 | Soạn 100 câu Xuất Ê-díp-tô Ký mới (Haladyna × Bloom) qua skill bible-quiz-authoring (EX100-1..FINAL) | IN PROGRESS | [detail](docs/todo/active/2026-06-24-exodus-100-questions.md) |
| 2026-06-24 | Soạn 100 câu Sáng Thế Ký mới (Haladyna × Bloom) qua skill bible-quiz-authoring (G100-1..10) | IN PROGRESS | [detail](docs/todo/active/2026-06-24-genesis-100-questions.md) |
| 2026-06-24 | Ranked: bỏ phễu 1-sách → rút toàn 66 sách + cross-day exclude + bỏ gate tiến-sách chết (RWP-1..4) | DONE | [detail](docs/todo/active/2026-06-24-ranked-whole-pool-question-selection.md) |
| 2026-06-24 | Result screen head-to-head ≤2 người + parity host Quản trò (RES-1..3, HRP-1..2) | DONE | [detail](docs/todo/active/2026-06-24-results-head-to-head.md) |
| 2026-06-24 | Multiplayer: chat ở màn kết quả + giữ lịch sử lobby (MPC-1..9) | DONE | [detail](docs/todo/active/2026-06-24-multiplayer-results-chat.md) |
| 2026-06-24 | Quiz: badge độ khó theo câu — tất cả chế độ (Luyện Tập/Daily/Ranked/Multiplayer) (DTAG-1..2) | DONE | [detail](docs/todo/active/2026-06-24-room-quiz-difficulty-badge.md) |
| 2026-06-23 | Create Room: toggle "Tôi cũng chơi" (host plays) — opt-in, default Quản trò không chơi (HPT-1..2) | DONE | [detail](docs/todo/active/2026-06-23-host-plays-toggle-create-room.md) |
| 2026-06-22 | Ranked scoring rework A+B+C (BL-26, LOCKED): additive situational cap 2.0 + accuracy bonus + speed timer 90s + comeback (ABC-1..7) | IN PROGRESS | [detail](docs/todo/active/2026-06-22-ranked-scoring-rework-abc.md) |
| 2026-06-22 | BL-16 retire group leaderboard (Q-A sunset → 410 Gone) + supersede BL-2/BL-12 (BL16-1..2) | TODO | [detail](docs/todo/active/2026-06-22-bl16-retire-group-leaderboard.md) |
| 2026-06-19 | Wire online presence (OnlineService) — `setOnline()` 0 caller, chưa nối Redis presence vào lifecycle (ONL-1..4) | TODO | [detail](docs/todo/active/2026-06-19-wire-online-presence.md) |
| 2026-06-17 | Mobile app (Capacitor wrap web) — chỉ trang User (MOB-0..5; code DONE, AAB built, store/iOS owner-gated) | IN PROGRESS | [detail](docs/todo/active/2026-06-17-mobile-capacitor.md) |
| 2026-06-12 | Optimize trang chủ (Home) (HO-1/2/3/5/7 DONE; HO-4 density + HO-6 consistency cố ý defer) (HO-1..7) | PARTIAL | [detail](docs/todo/active/2026-06-12-home-optimize.md) |
| 2026-05-22 | Liturgical Coverage follow-ups (verify/QA/rollout/FMC/cleanup — checklist vận hành, không phải code) | TODO | [detail](docs/todo/active/2026-05-22-liturgical-coverage-followups.md) |
| 2026-05-20 | Group Detail mobile redesign (compact header + 3-dot menu + drop Phân tích) — chưa làm | TODO | [detail](docs/todo/active/2026-05-20-group-detail-mobile-redesign.md) |
| 2026-05-20 | Quiz Set Editor i18n (group + personal shared, 8 files) — chưa thêm namespace, còn hardcode VN | TODO | [detail](docs/todo/active/2026-05-20-quizset-editor-i18n.md) |
| 2026-05-18 | Fix Daily Challenge "Vào chơi" còn hiện sau khi hoàn thành — mobile DONE; **web còn**: BE 409 guard + FE catch + staleTime 60s→10s | PARTIAL | [detail](docs/todo/active/2026-05-18-fix-daily-challenge-stale-cta.md) |
| 2026-05-13 | ⚠️ Disable test data seed on prod + harden guard — `APP_TEST_DATA_ENABLED:"true"` vẫn bật trên prod, thiếu FRONTEND_URL guard (SEC-1..2) | PARTIAL | [detail](docs/todo/active/2026-05-13-disable-seed-on-prod-and-harden-guard.md) |
| 2026-05-13 | Code Quality Audit follow-up (BE + FE Web) | PARTIALLY DONE | [detail](docs/todo/active/2026-05-13-code-quality-audit-follow-up-be-fe-web.md) |
| 2026-05-10 | Quiz Set card: action buttons (Chơi cùng nhau / Đặt lịch) — ModePickerModal đã tách; wiring footer card chưa rõ | PARTIAL | [detail](docs/todo/active/2026-05-10-quiz-set-card-them-action-buttons-choi-cung-nhau-dat-lich.md) |
| 2026-05-06 | Practice screen redesign + new settings | IN PROGRESS | [detail](docs/todo/active/2026-05-06-practice-screen-redesign-new-settings.md) |
| 2026-05-05 | Quiz Mobile Redesign theo `quiz_mobile_redesign_mockup.html` | IN PROGRESS | [detail](docs/todo/active/2026-05-05-quiz-mobile-redesign-theo-quiz-mobile-redesign-mockup-html.md) |
| 2026-05-05 | Home Redesign theo mockup `home_redesign_mockup.html` | IN PROGRESS | [detail](docs/todo/active/2026-05-05-home-redesign-theo-mockup-home-redesign-mockup-html.md) |
| 2026-04-30 | Ranked Page Redesign (Sacred Modernist v2) | IN PROGRESS | [detail](docs/todo/active/2026-04-30-ranked-page-redesign-sacred-modernist-v2.md) |
| 2026-04-29 | Bible Basics Catechism Quiz | IN PROGRESS | [detail](docs/todo/active/2026-04-29-bible-basics-catechism-quiz.md) |
| 2026-04-27 | V3 Tier B/C Quality Expansion: 14 books | IN PROGRESS | [detail](docs/todo/active/2026-04-27-v3-tier-b-c-quality-expansion-14-books.md) |
| 2026-04-19 | Global audience migration: SQL → JSON + i18n prep | PARTIALLY DONE | [detail](docs/todo/active/2026-04-19-global-audience-migration-sql-json-i18n-prep.md) |

> **Chưa reconcile:** ~50 row cũ đã đánh DONE/SUPERSEDED + ~15 file trong `active/` không có row (vd `ks-w0..w10`, `profile-sprint-5/6/7`, `tablet-responsive`, `home-game-redesign`…) — cần 1 đợt audit riêng để verify rồi archive (xem ghi chú cuối phiên 2026-06-22).

## Archive (98)

> 98 task DONE/SUPERSEDED đã chuyển sang [`docs/todo/archive/`](docs/todo/archive/) — duyệt folder theo ngày để tra cứu.
> **Batch 2026-06-22:** archive thêm 23 task đã verify hoàn thành (TVT tie-break, 3 MP test suites, MP page i18n, group announcement BL-24, group page A/B, daily scoring rework, ranked play fixes, quiz screen redesign sprint-1, home hide daily card, questions content-hash dedup, seed distractor Haladyna, AI error_type, AI CSS polish, liturgical coverage sprint, practice book-select, guest practice, favicon, rebrand forbible.org, avatar preset Bible chars, profile sprint-4, fix rank score-delta flicker SDF-1).

<details>
<summary>Xem inline list (tuỳ chọn)</summary>

- 2026-05-18..20 — **Mobile RN app rewrite (S0–S6 + ranked/daily/quiz fixes, 19 file)** · SUPERSEDED 2026-06-17 — `apps/mobile` đã gỡ để viết lại bản mới · [folder](docs/todo/archive/)

- 2026-06-16 — Quét i18n admin: dịch chuỗi VI còn English + tên sách coverage (AIS-1..2) · DONE · [detail](docs/todo/archive/2026-06-16-admin-i18n-sweep.md)
- 2026-06-16 — Sửa câu hỏi: chuyển PAGE + AI đề xuất đáp án (QPG-1..4) · DONE · [detail](docs/todo/archive/2026-06-16-question-edit-page-ai-suggest.md)
- 2026-06-16 — Edit câu hỏi: dùng chung modal cho Questions + Review Queue (QED-1..2) · DONE · [detail](docs/todo/archive/2026-06-16-edit-in-review-queue.md)
- 2026-06-16 — Sửa câu hỏi: wrap đáp án + nút đánh giá chất lượng tức thời (QEV-1..2; QEV-3 AI defer) · DONE · [detail](docs/todo/archive/2026-06-16-question-edit-quality-tools.md)
- 2026-06-16 — Admin panel: cắt về core (ẩn Tier C, dashboard số liệu thật, review 1-approval, ban REST, xoá trang placeholder) (ADM-1..5) · DONE · [detail](docs/todo/archive/2026-06-16-admin-panel-trim-to-core.md)
- 2026-05-23 — E2E tests cho Đấu Nhanh Quick Match (4 modes, smoke+happy-path+per-mode L2; L3 realtime deferred) · DONE · [detail](docs/todo/archive/2026-05-23-e2e-quickmatch-4modes.md)

- 2026-05-22 — Daily Challenge: wire "Hạng toàn cầu" + bỏ "Trong nhóm" (HeroCard) · DONE · [detail](docs/todo/archive/2026-05-22-daily-challenge-wire-global-group-rank.md)
- 2026-05-19 — Fix Daily Challenge AnswerButton flashes 'wrong' state khi trả lời đúng · DONE · [detail](docs/todo/archive/2026-05-19-fix-daily-answer-button-flash-wrong.md)
- 2026-05-19 — Fix Daily Challenge feedback flashes "Sai rồi!" trước khi hiện đúng · DONE · [detail](docs/todo/archive/2026-05-19-fix-daily-answer-feedback-flash-wrong.md)
- 2026-05-19 — Daily Challenge explanation panel — click outside to close · DONE · [detail](docs/todo/archive/2026-05-19-daily-explanation-click-outside-to-close.md)
- 2026-05-19 — Fix Daily Challenge explanation panel auto-shows + covers answer options · DONE · [detail](docs/todo/archive/2026-05-19-fix-daily-challenge-explanation-hidden-by-default.md)
- 2026-05-18 — Fix FeaturedDailyCard CTA + label wrap xấu ở 360px · DONE · [detail](docs/todo/archive/2026-05-18-fix-featured-daily-card-mobile-button-wrap.md)
- 2026-05-18 — Fix seed VN: thay từ "text" tiếng Anh sang "Kinh Thánh"/"đoạn" · DONE · [detail](docs/todo/archive/2026-05-18-fix-seed-vn-text-wording.md)
- 2026-05-15 — Multiplayer Quick Match (Đấu Nhanh) pivot · DONE · [detail](docs/todo/archive/2026-05-15-multiplayer-quickmatch-pivot.md)
- 2026-05-15 — Multiplayer Lobby patch theo canonical prompt · DONE · [detail](docs/todo/archive/2026-05-15-multiplayer-lobby-patch-canonical.md)
- 2026-05-15 — Multiplayer Lobby redesign (MOCKUP_MULTIPLAYER_LOBBY.html) · DONE · [detail](docs/todo/archive/2026-05-15-multiplayer-lobby-redesign.md)
- 2026-05-15 — Create Room redesign (create_room_redesign.html) · DONE · [detail](docs/todo/archive/2026-05-15-create-room-redesign.md)
- 2026-05-15 — Personal Quiz Set AI (Phase 2) · DONE · [detail](docs/todo/archive/2026-05-15-personal-quiz-set-ai-phase-2.md)
- 2026-05-14 — Personal Quiz Set parity with Group (Phase 1 MVP) · DONE · [detail](docs/todo/archive/2026-05-14-personal-quiz-set-parity-phase-1.md)
- 2026-05-14 — Season overlap: defensive read + admin write guard · DONE · [detail](docs/todo/archive/2026-05-14-season-overlap-defensive-read-write-guard.md)

- 2026-05-10 — Group Detail redesign · DONE · [detail](docs/todo/archive/2026-05-10-group-detail-redesign.md)
- 2026-05-10 — Fix: Quản trò mất isHost sau WS ROOM_STATE event · DONE · [detail](docs/todo/archive/2026-05-10-fix-quan-tro-mat-ishost-sau-ws-room-state-event.md)
- 2026-05-09 — Multiplayer Sprint 4: Host-Organizer separation · DONE · [detail](docs/todo/archive/2026-05-09-multiplayer-sprint-4-host-organizer-separation.md)
- 2026-05-07 — Profile Redesign Phase 1 · DONE · [detail](docs/todo/archive/2026-05-07-profile-redesign-phase-1.md)
- 2026-05-07 — Multiplayer page mobile redesign · DONE · [detail](docs/todo/archive/2026-05-07-multiplayer-page-mobile-redesign.md)
- 2026-05-07 — Multiplayer Lobby Redesign · DONE · [detail](docs/todo/archive/2026-05-07-multiplayer-lobby-redesign.md)
- 2026-05-07 — BasicQuiz UX parity (sound + haptic + full review) · DONE · [detail](docs/todo/archive/2026-05-07-basicquiz-ux-parity-sound-haptic-full-review.md)
- 2026-05-06 — v1 implementation gaps (per SPEC v1.1 §15.2) · DONE · [detail](docs/todo/archive/2026-05-06-v1-implementation-gaps-per-spec-v1-1-15-2.md)
- 2026-05-06 — Spec v1.1 alignment · DONE · [detail](docs/todo/archive/2026-05-06-spec-v1-1-alignment.md)
- 2026-05-06 — Spec compliance follow-ups (sau review SPEC_GROUP_v1) · SUPERSEDED · [detail](docs/todo/archive/2026-05-06-spec-compliance-follow-ups-sau-review-spec-group-v1.md)
- 2026-05-06 — Group → Live Room flow audit fixes · DONE · [detail](docs/todo/archive/2026-05-06-group-live-room-flow-audit-fixes.md)
- 2026-05-05 — Daily Challenge Redesign theo `daily_challenge_mockup.html` · DONE · [detail](docs/todo/archive/2026-05-05-daily-challenge-redesign-theo-daily-challenge-mockup-html.md)
- 2026-05-02 — Variety Modes Leaderboard Fix (Option A) · DONE · [detail](docs/todo/archive/2026-05-02-variety-modes-leaderboard-fix-option-a.md)
- 2026-05-01 — Leaderboard LB-2 Sprint: 3 tabs + 4 liturgical seasons · DONE · [detail](docs/todo/archive/2026-05-01-leaderboard-lb-2-sprint-3-tabs-4-liturgical-seasons.md)
- 2026-05-01 — Leaderboard Redesign Sprint 1 (P0 + P1 mockup) · DONE · [detail](docs/todo/archive/2026-05-01-leaderboard-redesign-sprint-1-p0-p1-mockup.md)
- 2026-05-01 — Home Redesign Sacred Modernist v2 (H1-H8) · DONE · [detail](docs/todo/archive/2026-05-01-home-redesign-sacred-modernist-v2-h1-h8.md)
- 2026-05-01 — Pre-launch Critical Fixes (B1 + B2 + V1) · DONE · [detail](docs/todo/archive/2026-05-01-pre-launch-critical-fixes-b1-b2-v1.md)
- 2026-04-30 — Color Audit (read-only) · DONE · [detail](docs/todo/archive/2026-04-30-color-audit-read-only.md)
- 2026-04-27 — V2 Go-Live Tier A leftover: 5 core books to target · DONE · [detail](docs/todo/archive/2026-04-27-v2-go-live-tier-a-leftover-5-core-books-to-target.md)
- 2026-04-26 — V2 Go-Live Phase 2: Easy/Medium expansion (5 sách core) · DONE · [detail](docs/todo/archive/2026-04-26-v2-go-live-phase-2-easy-medium-expansion-5-sach-core.md)
- 2026-04-26 — V2 Go-Live: Hard-only priority (5 sách core) · DONE · [detail](docs/todo/archive/2026-04-26-v2-go-live-hard-only-priority-5-sach-core.md)
- 2026-04-25 — Seed questions P1 Tier 1 (4 sách missing còn lại) · DONE · [detail](docs/todo/archive/2026-04-25-seed-questions-p1-tier-1-4-sach-missing-con-lai.md)
- 2026-04-25 — Room chat over STOMP/WebSocket · DONE · [detail](docs/todo/archive/2026-04-25-room-chat-over-stomp-websocket.md)
- 2026-04-20 — Daily Challenge as secondary XP path (+50 XP) · DONE · [detail](docs/todo/archive/2026-04-20-daily-challenge-as-secondary-xp-path-50-xp.md)
- 2026-04-19 — Dual-path progress indicator on locked Ranked card · DONE · [detail](docs/todo/archive/2026-04-19-dual-path-progress-indicator-on-locked-ranked-card.md)
- 2026-04-19 — Early Ranked unlock (80% accuracy Practice path) · DONE · [detail](docs/todo/archive/2026-04-19-early-ranked-unlock-80-accuracy-practice-path.md)
- 2026-04-19 — FAQ / Help page · DONE · [detail](docs/todo/archive/2026-04-19-faq-help-page.md)
- 2026-04-19 — Actionable locked card UX · DONE · [detail](docs/todo/archive/2026-04-19-actionable-locked-card-ux.md)
- 2026-04-19 — Remove duplicate top-nav + sidebar-nav · DONE · [detail](docs/todo/archive/2026-04-19-remove-duplicate-top-nav-sidebar-nav.md)
- 2026-04-19 — JSON Question Seeder (production source of truth) · DONE · [detail](docs/todo/archive/2026-04-19-json-question-seeder-production-source-of-truth.md)
- 2026-04-19 — Consolidate tiers data single source of truth · DONE · [detail](docs/todo/archive/2026-04-19-consolidate-tiers-data-single-source-of-truth.md)
- 2026-04-19 — Cleanup half-migration tier naming (keep OLD) · DONE · [detail](docs/todo/archive/2026-04-19-cleanup-half-migration-tier-naming-keep-old.md)
- 2026-04-19 — Fix i18n interpolation bug in Activity Feed · DONE · [detail](docs/todo/archive/2026-04-19-fix-i18n-interpolation-bug-in-activity-feed.md)
- 2026-04-19 — Fix Leaderboard duplicate "Bạn" row · DONE · [detail](docs/todo/archive/2026-04-19-fix-leaderboard-duplicate-ban-row.md)
- 2026-04-19 — UX Fix: Tier Gating + Overload + Text Mismatch · DONE · [detail](docs/todo/archive/2026-04-19-ux-fix-tier-gating-overload-text-mismatch.md)
- 2026-04-19 — Game Mode Tier Layout + Stronger Highlight · DONE · [detail](docs/todo/archive/2026-04-19-game-mode-tier-layout-stronger-highlight.md)
- 2026-04-19 — Game Mode Recommendation (smart highlight) · DONE · [detail](docs/todo/archive/2026-04-19-game-mode-recommendation-smart-highlight.md)
- 2026-04-19 — Practice XP persistence bug fix · DONE · [detail](docs/todo/archive/2026-04-19-practice-xp-persistence-bug-fix.md)
- 2026-04-18 — Lifeline v1 (Hint only) · DONE · [detail](docs/todo/archive/2026-04-18-lifeline-v1-hint-only.md)
- 2026-04-18 — Move Pages into AppLayout · DONE · [detail](docs/todo/archive/2026-04-18-move-pages-into-applayout.md)
- 2026-04-18 — Multiplayer Width Fix · DONE · [detail](docs/todo/archive/2026-04-18-multiplayer-width-fix.md)

</details>
