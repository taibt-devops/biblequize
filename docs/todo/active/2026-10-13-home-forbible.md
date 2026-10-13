# Trang chủ Làng nhỏ ở forbible.org, Bible Quiz sang quiz.forbible.org — HOM-1..6

Spec ở repo forbible-home: `docs/07-ra-mat-forbible-org.md` (chủ dự án duyệt 13/10/2026). Kế hoạch: `forbible-home/docs/superpowers/plans/2026-10-13-lang-nho-ra-mat.md`, M1.

- HOM-1 Đăng nhập Google `?app=home` quay về `APP_HOME_URL/auth/callback` — Status: [x] DONE
- HOM-2 `HomeService`: huy hiệu việc hôm nay, nút Đi tiếp, sổ tay; ngày theo giờ VN; chỉ đọc bảng có sẵn — Status: [x] DONE
- HOM-3 `GET /api/home/me` (no-store, 401 khi chưa đăng nhập) — Status: [x] DONE
- HOM-4 Trang chia sẻ dùng `APP_FRONTEND_URL` thay vì viết cứng forbible.org — Status: [x] DONE
- HOM-5 Web sang `quiz.forbible.org` (canonical, OG, sitemap, prerender); Thêm câu nhận `?book=&chapter=&from=&to=` — Status: [x] DONE
- HOM-6 Cả bộ test (API 1552, web 1652), boot jar + smoke `/api/home/me` 10/10, deploy prod và chuyển tên miền (M3) — Status: [~] IN PROGRESS (chờ M3)
