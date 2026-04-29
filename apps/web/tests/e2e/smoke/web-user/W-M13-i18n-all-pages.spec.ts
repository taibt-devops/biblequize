/**
 * W-M13 — i18n coverage across all user pages (L1 Smoke)
 *
 * Ratchet test: switches the app to English and visits every major user
 * route. Fails when the page body still contains Vietnamese diacritics,
 * which means a string escaped the i18n migration. Tests are expected to
 * fail against HEAD as of the i18n migration kick-off (~578 hardcoded
 * strings reported by `npm run validate:i18n`) and should turn green
 * page-by-page as Phase 1-4 lands.
 */

import { test, expect } from '../../fixtures/auth'

const VI_DIACRITIC =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

interface RouteCase {
  id: string
  path: string
  testid: string // data-testid that marks "page loaded"
  name: string
}

const ROUTES: RouteCase[] = [
  { id: 'home',        path: '/',            testid: 'home-page',        name: 'Home' },
  { id: 'daily',       path: '/daily',       testid: 'daily-page',       name: 'Daily Challenge' },
  { id: 'practice',    path: '/practice',    testid: 'practice-page',    name: 'Practice' },
  { id: 'ranked',      path: '/ranked',      testid: 'ranked-page',      name: 'Ranked' },
  { id: 'profile',     path: '/profile',     testid: 'profile-page',     name: 'Profile' },
  { id: 'groups',      path: '/groups',      testid: 'groups-page',      name: 'Church Groups' },
  { id: 'multiplayer', path: '/multiplayer', testid: 'multiplayer-page', name: 'Multiplayer' },
  { id: 'leaderboard', path: '/leaderboard', testid: 'leaderboard-page', name: 'Leaderboard' },
  { id: 'achievements', path: '/achievements', testid: 'achievements-page', name: 'Achievements' },
]

test.describe('W-M13 i18n coverage across user pages @smoke @i18n @regression', () => {
  for (const route of ROUTES) {
    test(`W-M13-L1-ALL-${route.id}: ${route.name} has no Vietnamese diacritics when language=en`, async ({
      tier3Page,
    }) => {
      const page = tier3Page

      // Force English locale via localStorage, then navigate
      await page.goto(`${BASE}/`)
      await page.evaluate(() => {
        localStorage.setItem('quizLanguage', 'en')
        localStorage.setItem('i18nextLng', 'en')
      })
      await page.goto(`${BASE}${route.path}`)

      // Wait for the page marker — if it's not present, look for any headline
      try {
        await page.waitForSelector(`[data-testid="${route.testid}"]`, { timeout: 8000 })
      } catch {
        await page.waitForLoadState('networkidle')
      }

      // Scrape visible body text and flag any Vietnamese diacritic
      const bodyText = await page.locator('body').innerText()
      const offendingLines = bodyText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && VI_DIACRITIC.test(line))

      // Print offenders to make the failure actionable without a screenshot
      if (offendingLines.length > 0) {
        console.log(
          `\n[${route.id}] ${offendingLines.length} Vietnamese line(s) leaked on ${route.path}:`
        )
        offendingLines.slice(0, 10).forEach(l => console.log(`  • ${l}`))
      }

      expect(
        offendingLines,
        `Expected no Vietnamese diacritics on ${route.path} when lang=en, got ${offendingLines.length} lines`
      ).toEqual([])
    })
  }
})
