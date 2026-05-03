# BibleQuiz Web (apps/web)

Vite 5 + React 18 + TypeScript 5.4. Port `5173`.

## Dev

```bash
cd apps/web
npm install
npm run dev          # Vite dev server, hot reload
```

Backend phải chạy ở `:8080` và Docker (MySQL `:3307`, Redis `:6379`) phải up. Xem `Local Dev Start` trong `CLAUDE.md` ở root.

## Test

### Unit (Vitest)
```bash
npm test                  # watch mode
npx vitest run            # single run (CI)
npx vitest run src/pages/ # chỉ pages
```

### E2E (Playwright) — multi-environment

Test runner tự load env file theo target. Wrapper script (`scripts/e2e.mjs`) set `E2E_ENV` rồi spawn Playwright — chạy được trên mọi OS, không cần `cross-env`.

| Lệnh | Env | Target |
|---|---|---|
| `npm run test:e2e` | `local` | `http://localhost:5173` (default) |
| `npm run test:e2e:dev` | `dev` | đọc `PLAYWRIGHT_BASE_URL` từ `.env.e2e.dev` |
| `npm run test:e2e:prod` | `prod` | `.env.e2e.prod`, mặc định chỉ chạy `@smoke` |
| `npm run test:e2e:headed` | `local` | mở browser UI |
| `npm run test:e2e:report` | — | mở HTML report của lần chạy local |
| `npm run test:e2e:report:dev` | — | mở HTML report của lần chạy dev |
| `npm run test:e2e:report:prod` | — | mở HTML report của lần chạy prod |

Pass thêm Playwright args sau `--`:
```bash
npm run test:e2e:dev -- --grep @ranked
npm run test:e2e -- --headed --debug
npm run test:e2e -- tests/e2e/smoke/web-user/W-M03-practice.spec.ts
```

#### Setup env file mới

```bash
cp .env.e2e.example .env.e2e.dev   # hoặc .env.e2e.prod
# Sửa PLAYWRIGHT_BASE_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD
```

Mọi `.env.e2e.*` đều **gitignored**, trừ `.env.e2e.example` (template, committed).

#### Loading order (config: `playwright.config.ts:14`)
1. `.env.e2e.<E2E_ENV>` (cụ thể trước)
2. `.env.e2e` (fallback nếu có)
3. CLI env vars override file vars

Khi run, config in:
```
[playwright.config] E2E_ENV=dev baseURL=https://dev.biblequiz.com
```
→ verify đang target đúng env trước khi tests bắt đầu.

#### Webserver auto-start

Chỉ start `npm run dev` khi `PLAYWRIGHT_BASE_URL=http://localhost:5173`. Khi target dev/prod remote → không clash với local server.

#### Test artifacts (tách theo env)

| Loại | Đường dẫn |
|---|---|
| HTML report | `apps/web/playwright-report/<env>/` |
| Traces, screenshots, videos (chỉ khi fail) | `apps/web/test-results/<env>/` |

`<env>` = `local` / `dev` / `prod` (theo `E2E_ENV`). Run dev không ghi đè report local — debug song song được.

Cả 2 folder đều gitignored.

## Build

```bash
npm run build           # production build → dist/
npm run preview         # serve dist/ local
npm run type-check      # tsc --noEmit
npm run validate:i18n   # check hardcoded Vietnamese / missing keys
```

## Tham khảo
- Project root: `CLAUDE.md` (workflow, regression rules, design tokens)
- E2E conventions: `PLAYWRIGHT_CODE_CONVENTIONS.md` (root)
- Test catalog: `tests/e2e/INDEX.md`, `tests/e2e/TC-TODO.md` (root)
