# API cho app Cầu nguyện (doc.forbible.org/cau-nguyen) — PRA-1..6

Spec ở repo forbible-doc: `docs/cau-nguyen/` (chủ dự án duyệt 13/10/2026). Kế hoạch: `forbible-doc/docs/superpowers/plans/2026-10-13-cau-nguyen.md`, M1.

- PRA-1 Kiểm đầu vào (`PrayerInput`) — Status: [x] DONE
- PRA-2 V79 bốn bảng `prayer_*`, entity, repository; sổ của tôi gộp theo từng điều — Status: [x] DONE
- PRA-3 Link nhờ cầu thay, người cầu thay, trang người nhận (service) — Status: [x] DONE
- PRA-4 `PrayerController` `/api/prayer/me/*`, `PublicPrayerController` `/api/public/prayer/shares/*` — Status: [x] DONE
- PRA-5 Rate limit `prayer-public` 300 POST/IP/giờ (review: 30 dễ chặn cả nhóm dùng chung Wi-Fi/NAT); việc đêm xóa bia mộ quá 90 ngày — Status: [x] DONE
- PRA-6 Cả bộ test, boot jar thật + smoke (`smoke_prayer.mjs`), deploy prod cùng app ở M3 — Status: [x] DONE (prod 13/10: api 61780613, V79; dump `biblequiz-20261013-1002-pre-v79.sql.gz`)
