// @ts-nocheck -- config file; node globals are runtime-only
import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Auto-load .env.e2e.<E2E_ENV> then .env.e2e (fallback) — no dotenv dep.
// Existing process.env values take precedence (explicit CLI env beats file).
// E2E_ENV picks the env: local | dev | prod | <custom>. Default 'local'.
// Use cases:
//   - Switch dev↔prod target without retyping vars each run
//   - Per-env secrets in .env.e2e.<env> (gitignored), shared base in .env.e2e
const envName = process.env.E2E_ENV || 'local'
const candidateFiles = [
  path.join(__dirname, `.env.e2e.${envName}`),
  path.join(__dirname, '.env.e2e'),
]
for (const envFile of candidateFiles) {
  if (!fs.existsSync(envFile)) continue
  for (const line of fs.readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
console.log(`[playwright.config] E2E_ENV=${envName} baseURL=${process.env.PLAYWRIGHT_BASE_URL || '(default)'}`)

// PLAYWRIGHT_BASE_URL = URL để target tests:
//   unset → http://localhost:5173 (dev local, Playwright tự bật `npm run dev`)
//   http://localhost:3000 → docker compose deploy
//   https://staging.example.com → remote env (CI, staging)
// Khi URL không phải dev local :5173, tự tắt webServer để không clash với
// server đang chạy ở nơi khác.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
const shouldStartDevServer = baseURL === 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  outputDir: path.join(__dirname, 'test-results', envName),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 1,
  reporter: [['html', { open: 'never', outputFolder: path.join(__dirname, 'playwright-report', envName) }]],
  timeout: 30_000,

  expect: { timeout: 5_000 },

  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'smoke-parallel',
      testMatch: /smoke\/.*\.spec\.ts/,
      fullyParallel: true,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'happy-path-serial',
      testMatch: /happy-path\/.*\.spec\.ts/,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: shouldStartDevServer
    ? [
        {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 30_000,
        },
      ]
    : undefined,
})
