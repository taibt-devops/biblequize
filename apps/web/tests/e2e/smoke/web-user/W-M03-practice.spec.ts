/**
 * W-M03 — Practice Mode (L1 Smoke)
 *
 * Routes: /practice, /quiz, /review
 * Spec ref: SPEC_USER §5.1
 */

import { test, expect } from '../../fixtures/auth'
import { PracticePage } from '../../pages/PracticePage'
import { QuizPage } from '../../pages/QuizPage'
import { QuizResultsPage } from '../../pages/QuizResultsPage'
import { LoginPage } from '../../pages/LoginPage'

test.describe('W-M03 Practice Mode — L1 Smoke @smoke @practice', () => {

  test('W-M03-L1-001: Trang Practice Selection render dung @smoke @practice', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const practicePage = new PracticePage(page)
    await practicePage.goto()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/practice')
    await expect(practicePage.bookSelect).toBeVisible()
    await expect(practicePage.difficultyBtn('all')).toBeVisible()
    await expect(practicePage.countBtn(10)).toBeVisible()
    await expect(practicePage.startBtn).toBeVisible()
    await expect(practicePage.startBtn).toBeEnabled()
  })

  test('W-M03-L1-002: Chon difficulty Easy va bat dau quiz @smoke @practice', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const practicePage = new PracticePage(page)
    await practicePage.goto()
    await practicePage.selectDifficulty('easy')
    await practicePage.selectCount(5)
    await practicePage.startQuiz()
    await page.waitForURL('/quiz')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/quiz')
    const quizPage = new QuizPage(page)
    await expect(quizPage.questionText).toBeVisible()
    await expect(quizPage.option(0)).toBeVisible()
    await expect(quizPage.option(1)).toBeVisible()
    await expect(quizPage.option(2)).toBeVisible()
    await expect(quizPage.option(3)).toBeVisible()
  })

  test('W-M03-L1-003: Quiz chon dap an nhan feedback @smoke @practice @critical', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const practicePage = new PracticePage(page)
    await practicePage.goto()
    await practicePage.selectDifficulty('easy')
    await practicePage.selectCount(5)
    await practicePage.startQuiz()
    await page.waitForURL('/quiz')

    const quizPage = new QuizPage(page)
    await quizPage.questionText.waitFor({ state: 'visible' })
    await quizPage.answerOption(0)

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(quizPage.answerFeedback).toBeVisible()
    await expect(quizPage.nextBtn).toBeVisible()
    await expect(quizPage.option(0)).toBeVisible()
  })

})
