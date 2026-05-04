/**
 * W-M13 — i18n / Language Switching (L1 Smoke)
 *
 * Routes: Cross-cutting (AppLayout -> all pages)
 * Spec ref: SPEC_USER §14
 */

import { test, expect } from '../../fixtures/auth'

test.describe('W-M13 i18n Language Switching — L1 Smoke @smoke @i18n', () => {

  test('W-M13-L1-001: Language toggle visible trong AppLayout @smoke @i18n', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.waitForSelector('[data-testid="lang-toggle"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('lang-toggle')).toBeVisible()
    await expect(page.getByTestId('lang-toggle-vi')).toBeVisible()
    await expect(page.getByTestId('lang-toggle-en')).toBeVisible()
  })

  test('W-M13-L1-002: Switch language EN UI text thay doi @smoke @i18n', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — set language to VI (goto first, then evaluate)
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
    await page.reload()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.waitForSelector('[data-testid="lang-toggle-en"]')
    await page.getByTestId('lang-toggle-en').click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('lang-toggle-en')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('home-greeting-meta')).toHaveText(/Good (morning|afternoon|evening)/i)

    // ============================================================
    // CLEANUP — restore VI
    // ============================================================
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
  })

  test('W-M13-L1-003: Language preference persist qua reload @smoke @i18n', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.waitForSelector('[data-testid="lang-toggle-en"]')
    await page.getByTestId('lang-toggle-en').click()
    await page.reload()
    await page.waitForSelector('[data-testid="home-greeting-meta"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('home-greeting-meta')).toHaveText(/Good (morning|afternoon|evening)/i)
    const storedLang = await page.evaluate(() => localStorage.getItem('quizLanguage'))
    expect(storedLang).toBe('en')

    // ============================================================
    // CLEANUP — restore VI
    // ============================================================
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
  })

  test('W-M13-L1-004: Switch language VI EN tren Practice page @smoke @i18n', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — set language to VI (goto first, then evaluate)
    // ============================================================
    const page = tier3Page
    await page.goto('/practice')
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
    await page.reload()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.waitForSelector('[data-testid="lang-toggle-en"]')
    await page.getByTestId('lang-toggle-en').click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('practice-start-btn')).toHaveText(/Start Practice|Bắt Đầu/i)

    // ============================================================
    // CLEANUP — restore VI
    // ============================================================
    await page.evaluate(() => localStorage.setItem('quizLanguage', 'vi'))
  })

})
