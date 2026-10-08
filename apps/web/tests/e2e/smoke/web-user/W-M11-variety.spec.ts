/**
 * W-M11 — Variety Modes (L1 Smoke)
 *
 * Routes: /weekly-quiz, /mystery-mode, /speed-round
 * Spec ref: SPEC_USER §5.4
 */

import { test, expect } from '../../fixtures/auth'
import { QuizPage } from '../../pages/QuizPage'

test.describe('W-M11 Variety Modes — L1 Smoke @smoke @variety', () => {

  // ── Weekly Quiz ─────────────────────────────────────────────────

  test('W-M11-L1-001: Weekly Quiz page render dung @smoke @variety @weekly-quiz', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/weekly-quiz')
    await page.waitForSelector('[data-testid="weekly-page"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/weekly-quiz')
    await expect(page.getByTestId('weekly-page')).toBeVisible()
    await expect(page.getByTestId('weekly-quiz-theme-card')).toBeVisible()
    await expect(page.getByTestId('weekly-quiz-countdown')).toBeVisible()
    await expect(page.getByTestId('weekly-start-btn')).toBeVisible()
  })

  test('W-M11-L1-002: Weekly Quiz click Start vao quiz mode weekly @smoke @variety @weekly-quiz', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/weekly-quiz')
    await page.waitForSelector('[data-testid="weekly-start-btn"]')
    await page.getByTestId('weekly-start-btn').click()
    await page.waitForURL('/quiz')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/quiz')
    const quizPage = new QuizPage(page)
    await expect(quizPage.questionText).toBeVisible()
  })

  // ── Mystery Mode ────────────────────────────────────────────────

  test('W-M11-L1-004: Mystery Mode click Start vao quiz @smoke @variety @mystery', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/mystery-mode')
    await page.waitForSelector('[data-testid="mystery-start-btn"]')
    await page.getByTestId('mystery-start-btn').click()
    await page.waitForURL('/quiz')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/quiz')
    const quizPage = new QuizPage(page)
    await expect(quizPage.questionText).toBeVisible()
  })

  // ── Speed Round ─────────────────────────────────────────────────

  test('W-M11-L1-006: Speed Round click Start vao quiz voi timer @smoke @variety @speed-round', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/speed-round')
    await page.waitForSelector('[data-testid="speed-round-start-btn"]')
    await page.getByTestId('speed-round-start-btn').click()
    await page.waitForURL('/quiz')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/quiz')
    const quizPage = new QuizPage(page)
    await expect(quizPage.questionText).toBeVisible()
    await expect(quizPage.timer).toBeVisible()
  })

})
