/**
 * W-M13 — i18n coverage across admin pages (L1 Smoke)
 *
 * Parallel ratchet to W-M13-i18n-all-pages.spec.ts but for the 13 admin
 * routes (Dashboard, Users, Questions, Feedback, Rankings, Events, AI
 * Generator, Review Queue, Groups, Notifications, Configuration, Export
 * Center, Question Quality). Forces quizLanguage=en and asserts the
 * rendered page body contains no Vietnamese diacritics.
 *
 * Admin login is required — uses the adminPage fixture which already
 * carries a Bearer token + storageState for admin@biblequiz.test.
 */

import { test, expect } from '../../fixtures/auth'

const VI_DIACRITIC =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

interface RouteCase {
  id: string
  path: string
  testid: string
  name: string
}

const ROUTES: RouteCase[] = [
  { id: 'dashboard',   path: '/admin',                  testid: 'admin-dashboard-page',   name: 'Dashboard' },
  { id: 'users',       path: '/admin/users',            testid: 'admin-users-page',       name: 'Users' },
  { id: 'questions',   path: '/admin/questions',        testid: 'admin-questions-page',   name: 'Questions' },
  { id: 'feedback',    path: '/admin/feedback',         testid: 'admin-feedback-page',    name: 'Feedback' },
  { id: 'rankings',    path: '/admin/rankings',         testid: 'admin-rankings-page',    name: 'Rankings' },
  { id: 'events',      path: '/admin/events',           testid: 'admin-events-page',      name: 'Events' },
  { id: 'ai-generator', path: '/admin/ai-generator',    testid: 'ai-generator-page',      name: 'AI Generator' },
  { id: 'review-queue', path: '/admin/review-queue',    testid: 'review-queue-page',      name: 'Review Queue' },
  { id: 'groups',      path: '/admin/groups',           testid: 'admin-groups-page',      name: 'Groups' },
  { id: 'notifications', path: '/admin/notifications', testid: 'admin-notifications-page', name: 'Notifications' },
  { id: 'config',      path: '/admin/config',           testid: 'admin-config-page',      name: 'Configuration' },
  { id: 'export',      path: '/admin/export',           testid: 'admin-export-page',      name: 'Export Center' },
  { id: 'question-quality', path: '/admin/question-quality', testid: 'admin-quality-page', name: 'Question Quality' },
]

test.describe('W-M13 i18n coverage across admin pages @smoke @i18n @admin @regression', () => {
  for (const route of ROUTES) {
    test(`W-M13-L1-ADMIN-${route.id}: ${route.name} has no Vietnamese diacritics when language=en`, async ({
      adminPage,
    }) => {
      const page = adminPage

      // Force English before navigation. Admin storage-state may default to en-US;
      // force it explicitly so this spec is locale-deterministic.
      await page.goto(`${BASE}/`)
      await page.evaluate(() => {
        localStorage.setItem('quizLanguage', 'en')
        localStorage.setItem('i18nextLng', 'en')
      })
      await page.goto(`${BASE}${route.path}`)

      try {
        await page.waitForSelector(`[data-testid="${route.testid}"]`, { timeout: 8000 })
      } catch {
        await page.waitForLoadState('networkidle')
      }

      const bodyText = await page.locator('body').innerText()
      const offendingLines = bodyText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && VI_DIACRITIC.test(line))

      if (offendingLines.length > 0) {
        console.log(
          `\n[admin/${route.id}] ${offendingLines.length} Vietnamese line(s) leaked on ${route.path}:`
        )
        offendingLines.slice(0, 10).forEach(l => console.log(`  • ${l}`))
      }

      expect(
        offendingLines,
        `Expected no Vietnamese diacritics on admin ${route.path} when lang=en, got ${offendingLines.length} lines`
      ).toEqual([])
    })
  }
})
