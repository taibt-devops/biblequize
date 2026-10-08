/**
 * W-M04 — Ranked Mode (L1 Smoke)
 *
 * Routes: /ranked, /quiz (mode=ranked)
 * Spec ref: SPEC_USER §5.2, §4.4
 */

import { test, expect } from '../../fixtures/auth'
import { RankedPage } from '../../pages/RankedPage'
import { QuizPage } from '../../pages/QuizPage'
import { LoginPage } from '../../pages/LoginPage'

test.describe('W-M04 Ranked Mode — L1 Smoke @smoke @ranked', () => {

  test('W-M04-L1-001: Trang Ranked render dung voi energy display @smoke @ranked @critical', async ({
    tier3Page,
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    await testApi.refillEnergy('test3@dev.local')

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const rankedPage = new RankedPage(page)
    await rankedPage.goto()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/ranked')
    await expect(rankedPage.container).toBeVisible()
    await expect(rankedPage.energyDisplay).toBeVisible()
    // `ranked-energy-display` wraps the energy number only; the "/ max" is a
    // sibling span in the redesigned card.
    await expect(rankedPage.energyDisplay).toHaveText(/^\d+$/)
    await expect(rankedPage.startBtn).toBeVisible()
    await expect(rankedPage.startBtn).toBeEnabled()
  })

  test('W-M04-L1-002: Today Progress section hien thi dung @smoke @ranked', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const rankedPage = new RankedPage(page)
    await rankedPage.goto()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('ranked-today-progress')).toBeVisible()
    await expect(rankedPage.questionsCounted).toBeVisible()
    await expect(rankedPage.pointsToday).toBeVisible()
    // Rank #N display removed from "Today" row in R3 redesign — rank now
    // appears only in the Season card (assertion in W-M04-L1-005).
  })

  // SUPERSEDED: the legacy OT/NT "current book" card was removed in the
  // Liturgical Coverage redesign (sprint 2026-05-21) — it is now CoverageCard,
  // which is feature-flag gated. Re-enable as a coverage-card test once the
  // flag is on by default.
  test.skip('W-M04-L1-003: Current book section hien thi @smoke @ranked', async ({
    tier3Page,
  }) => {
    const page = tier3Page
    const rankedPage = new RankedPage(page)
    await rankedPage.goto()
    await expect(rankedPage.currentBook).toBeVisible()
  })

  test('W-M04-L1-006: Trang thai het energy button bi disable @smoke @ranked', async ({
    page,
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — drain energy to 0 via setState
    // ============================================================
    await testApi.setState('test1@dev.local', {
      livesRemaining: 0,
    })

    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.loginWithCredentials('test1@dev.local', 'Test@123456')
    await page.waitForURL('/')

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const rankedPage = new RankedPage(page)
    await page.goto('/ranked')
    await rankedPage.waitForLoaded()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // When energy=0, ranked-start-btn is removed from DOM, replaced by ranked-no-energy-msg
    await rankedPage.expectStartDisabled()
    await expect(rankedPage.energyDisplay).toBeVisible()

    // ============================================================
    // CLEANUP — restore energy
    // ============================================================
    await testApi.refillEnergy('test1@dev.local')
  })

  test('W-M04-L1-007: Energy countdown timer cap nhat theo thoi gian thuc @smoke @ranked', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const rankedPage = new RankedPage(page)
    await rankedPage.goto()

    const timerLocator = page.getByTestId('ranked-reset-timer')
    await timerLocator.waitFor({ state: 'visible' })
    const timerValue1 = await timerLocator.textContent()

    // Use expect.poll to wait for timer to change (avoids waitForTimeout)
    await expect.poll(
      async () => {
        const current = await timerLocator.textContent()
        return current !== timerValue1
      },
      { timeout: 5_000, message: 'Timer should update within 5 seconds' },
    ).toBeTruthy()

    const timerValue2 = await timerLocator.textContent()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    expect(timerValue1).not.toEqual(timerValue2)
    expect(timerValue1).toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(timerValue2).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

})
