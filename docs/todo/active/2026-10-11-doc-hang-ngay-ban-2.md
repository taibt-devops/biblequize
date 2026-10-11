# 2026-10-11 — App Đọc hằng ngày bản 2: chữ RVV11, đăng nhập Google, đồng bộ tiến độ

> **Source**: user 11/10: "làm tiếp phần api cho hoàn thiện" (app doc.forbible.org, repo taibt-devops/forbible-doc) · **Scope**: apps/api (security, bible, reading mới, migration V76) · Spec: forbible-doc `docs/04-kien-truc.md` mục Bản 2; kế hoạch forbible-doc `docs/superpowers/plans/2026-10-11-ban-2-doc-trong-app.md`

### Tasks
- RDG-1 Đăng nhập Google bắt đầu bằng `/oauth2/authorization/google?app=doc` quay về `app.doc-url` (`APP_DOC_URL`)
  - Status: [x] DONE · `OAuthReturnAppFilter` (trước `OAuth2AuthorizationRequestRedirectFilter`, chỉ nhận đúng `doc`, ghi vào phiên) + `OAuthReturnApp.resolve` + `OAuth2SuccessHandler` đọc một lần rồi xóa; không bao giờ nhận URL từ tham số · Test: `OAuthReturnAppFilterTest` (4), `OAuth2SuccessHandlerReturnAppTest` (4)
  - **Spec impact**: [x] None (Bible Quiz) — spec nằm ở forbible-doc
- RDG-2 `GET /api/public/bible/range?book=&from=c:v&to=c:v` — chữ RVV11 theo đoạn, tối đa 4 chương, `Cache-Control: public, max-age=86400`; 400 tham chiếu sai, 404 chưa có chữ
  - Status: [x] DONE · `BibleVerseRepository.findChapterRange` (JPQL) + `BiblePassageService.getRange` (khối gộp bắt đầu trước `from` vẫn trả nguyên) + `BibleStatusController.range` · Test: `BiblePassageServiceTest` +4, `BibleVerseRepositoryTest` (schema-lock), `BibleStatusControllerTest` +3
  - **Spec impact**: [x] None — toàn văn RVV11 đã được cho dùng công khai (DECISIONS 09/10)
- RDG-3 `GET/PUT /api/reading/me` cất tiến độ cả khối + V76 `reading_progress`, `reading_log`
  - Status: [x] DONE · module `modules/reading` (entity UTC, `ReadingProgressService` kiểm `1-nam`≤366/`2-nam`≤731, `lap` 0..1000, giờ trả dạng `.SSS'Z'`; ghi `reading_log` khi plan/next/lap đổi) + `ReadingController` · CORS dev thêm `http://localhost:5175` · Test: `ReadingProgressServiceTest` (5), `ReadingControllerTest` (5)
  - **Spec impact**: [x] None (Bible Quiz)
- RDG-4 Sửa sau review: `/api/auth/exchange` và `/api/auth/refresh` nhận `rememberMe` → cookie refresh 30 ngày (không gửi thì vẫn cookie phiên); `OAuth2FailureHandler` đưa đăng nhập bắt đầu từ app đọc về `app.doc-url/auth/callback?error=oauth2`
  - Status: [x] DONE · Test: `AuthControllerTest` +3, `OAuth2FailureHandlerTest` (3); full suite xanh
  - **Spec impact**: [x] None (Bible Quiz)
- Prod: `APP_DOC_URL=https://doc.forbible.org` + thêm `https://doc.forbible.org` vào `CORS_ORIGINS` (compose.yml + .env trên cura)
