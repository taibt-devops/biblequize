# 2026-10-11 — Màn đăng nhập chỉ mời Google, email/mật khẩu cất sau nút nhỏ

> **Source**: user 11/10: "phần đăng nhập với email pasword để vào 1 button nhỏ là login bằng cách khác, chỉ để phần login by google account thôi" · **Scope**: apps/web Login

### Tasks
- LGF-1 Ẩn form email/mật khẩu và link đăng ký sau nút "Đăng nhập bằng cách khác"
  - Status: [x] DONE · `src/pages/Login.tsx` (state `showOtherMethods`, nút `login-other-methods-btn`, form + "Chưa có tài khoản? Đăng ký ngay" chỉ hiện sau khi bấm, ô email tự focus) · i18n `auth.otherLoginMethods` (vi/en) · Test: `Login.test.tsx` 2 test mới (thay 2 test cũ "renders email/password input"), web 1546/1546 xanh · E2E: `LoginPage.goto()` + W-M01 L1-001/L1-004 + W-M02 L1-009 bấm nút trước khi điền
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
