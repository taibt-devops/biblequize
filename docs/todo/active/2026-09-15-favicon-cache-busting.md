# 2026-09-15 — Favicon cache-busting (tự refresh icon, không cần user clear cache)

> **Source**: user — sau khi đổi favicon (commit 53151631) phải clear cache browser mới thấy icon mới · **Scope**: apps/web build (vite plugin) + index.html

### Tasks
- FCB-1 Vite plugin gắn `?v=<content-hash>` vào href favicon/apple-touch/manifest trong index.html lúc build
  - Status: [x] DONE · Files: `apps/web/vite-plugins/assetVersion.ts`, `apps/web/vite.config.ts` · Test: `src/__tests__/asset-version.test.ts`
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
  - Checklist: impl · Tầng 1+2+3 pass · commit · deploy FE
- FCB-2 Service worker: bỏ precache HTML + navigateFallback → NetworkFirst cho navigation (loại /api, /oauth2)
  - Root cause: SW (PWA-1) phục vụ `index.html` precache cũ → lần mở đầu sau deploy vẫn HTML cũ (favicon cũ, UI cũ); SW mới chỉ activate sau khi trang đã render.
  - Status: [x] DONE · Files: `apps/web/vite.config.ts` · Test: Playwright vs `vite preview` — SW-controlled page nhận HTML mới sau 1 reload; build → `dist/sw.js` không còn precache html + có NetworkFirst route
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
  - Checklist: impl · Tầng 3 pass · commit · deploy FE
