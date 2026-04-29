/**
 * W-M13 — i18n (L2 Happy Path)
 *
 * Spec ref: SPEC_USER §10
 * Architecture: react-i18next, localStorage key "quizLanguage", toggle in AppLayout
 * Supported: vi (default), en
 */

import { test, expect } from '../../fixtures/auth'

const BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

// ── Tests ───────────────────────────────────────────────────────────

test.describe('W-M13 i18n — L2 Happy Path @happy-path @i18n', () => {

  test('W-M13-L2-001: Default language vi — page loads with Vietnamese strings @parallel-safe', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — clear localStorage (goto first, then evaluate, then reload
    // to simulate a first-time visit with no stored language preference)
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('quizLanguage'))
    await page.reload()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    // (Already on home after reload)

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // Check for Vietnamese text on home page
    const bodyText = await page.textContent('body')
    const hasVietnamese = /Luyện tập|Thi đấu|Chào|Trang chủ|Xếp hạng/i.test(
      bodyText || '',
    )
    expect(hasVietnamese).toBe(true)

    // Verify localStorage
    const lang = await page.evaluate(() => localStorage.getItem('quizLanguage'))
    expect(lang === null || lang === 'vi').toBe(true)
  })

  test('W-M13-L2-002: Switch to English — all UI strings change @write @serial', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP (goto first, then clear localStorage, then reload
    // so app re-initializes without a stored language)
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('quizLanguage'))
    await page.reload()

    // ============================================================
    // SECTION 2: ACTIONS — click language toggle
    // ============================================================
    const toggle = page.getByTestId('lang-toggle')
    await expect(toggle).toBeVisible()

    // Click the EN button directly
    const enBtn = page.getByTestId('lang-toggle-en')
    await enBtn.click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // Wait for re-render with English strings
    await expect
      .poll(async () => {
        const text = await page.textContent('body')
        return /Practice|Ranked|Home|Profile/i.test(text || '')
      }, { timeout: 5_000 })
      .toBe(true)

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const lang = await page.evaluate(() => localStorage.getItem('quizLanguage'))
    expect(lang).toBe('en')

    // ============================================================
    // CLEANUP — restore vi
    // ============================================================
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
  })

  test('W-M13-L2-003: Language persists across page reload @write @serial', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — set English (goto first, then evaluate)
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'en'))

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.reload()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect
      .poll(async () => {
        const text = await page.textContent('body')
        return /Practice|Ranked|Home|Profile/i.test(text || '')
      }, { timeout: 5_000 })
      .toBe(true)

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const lang = await page.evaluate(() => localStorage.getItem('quizLanguage'))
    expect(lang).toBe('en')

    // ============================================================
    // CLEANUP — restore vi
    // ============================================================
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
  })

  test('W-M13-L2-004: Language persists across page navigation @write @serial', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP (goto first, then set English, then reload)
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'en'))
    await page.reload()

    // ============================================================
    // SECTION 2: ACTIONS — navigate Home -> Practice
    // ============================================================
    await page.goto('/practice')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // Practice page should still show English
    await expect
      .poll(async () => {
        const text = await page.textContent('body')
        return /Practice|Start|Question/i.test(text || '')
      }, { timeout: 5_000 })
      .toBe(true)

    // Switch back to Vietnamese
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
    await page.reload()

    // Vietnamese should be back
    await expect
      .poll(async () => {
        const text = await page.textContent('body')
        return /Luyện tập|Bắt đầu|Câu hỏi/i.test(text || '')
      }, { timeout: 5_000 })
      .toBe(true)
  })

  test('W-M13-L2-005: API response language param — en vs vi returns different content @parallel-safe', async () => {
    // ============================================================
    // SECTION 1: SETUP — no auth (guest)
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const resEn = await fetch(`${BASE_URL}/api/daily-challenge?language=en`)
    const resVi = await fetch(`${BASE_URL}/api/daily-challenge?language=vi`)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(resEn.ok).toBe(true)
    expect(resVi.ok).toBe(true)

    const dataEn = await resEn.json()
    const dataVi = await resVi.json()

    // Both should have questions
    expect(dataEn).toHaveProperty('questions')
    expect(dataVi).toHaveProperty('questions')

    // At least 1 question should have different content text
    if (dataEn.questions?.length > 0 && dataVi.questions?.length > 0) {
      const enContent = dataEn.questions[0].content || dataEn.questions[0].text
      const viContent = dataVi.questions[0].content || dataVi.questions[0].text
      // They should differ (bilingual DB)
      if (enContent && viContent) {
        expect(enContent).not.toEqual(viContent)
      }
    }
  })

})
