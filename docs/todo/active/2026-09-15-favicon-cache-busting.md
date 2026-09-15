# 2026-09-15 — Favicon cache-busting (tự refresh icon, không cần user clear cache)

> **Source**: user — sau khi đổi favicon (commit 53151631) phải clear cache browser mới thấy icon mới · **Scope**: apps/web build (vite plugin) + index.html

### Tasks
- FCB-1 Vite plugin gắn `?v=<content-hash>` vào href favicon/apple-touch/manifest trong index.html lúc build
  - Status: [x] DONE · Files: `apps/web/vite-plugins/assetVersion.ts`, `apps/web/vite.config.ts` · Test: `src/__tests__/asset-version.test.ts`
  - **Spec impact**: [x] None
  - **Spec strategy**: [x] (c) [no-spec-impact]
  - Checklist: impl · Tầng 1+2+3 pass · commit · deploy FE
