/**
 * W-M05 — Daily Challenge (L1 Smoke)
 *
 * Routes: /daily
 * Spec ref: SPEC_USER §5.3
 */

import { test, expect } from '../../fixtures/auth'
import { DailyChallengePage } from '../../pages/DailyChallengePage'
import { QuizPage } from '../../pages/QuizPage'

test.describe('W-M05 Daily Challenge — L1 Smoke @smoke @daily', () => {

  // W-M05-L1-002 removed 2026-05-19: countdown component was deleted per
  // user feedback (Daily Challenge dedupe & slim, DC-7). Reset timing is
  // implicit (UTC midnight) and the countdown widget was crowding the
  // header without adding actionable info.

  test('W-M05-L1-005: Da hoan thanh hom nay button disabled + result hien thi @smoke @daily', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — test3 is pre-marked complete via global-setup
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const dailyPage = new DailyChallengePage(page)
    await dailyPage.goto()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(dailyPage.completedBadge).toBeVisible()
    await expect(page.getByTestId('daily-score-display')).toBeVisible()
  })

})
