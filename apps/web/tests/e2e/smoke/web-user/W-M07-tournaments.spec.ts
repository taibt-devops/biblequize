/**
 * W-M07 — Tournaments (L1 Smoke)
 *
 * Routes: /tournaments, /tournaments/:id, /tournaments/:id/match/:matchId
 * Spec ref: SPEC_USER §7
 */

import { test, expect } from '../../fixtures/auth'

test.describe('W-M07 Tournaments — L1 Smoke @smoke @tournaments', () => {

  test('W-M07-L1-006: Empty state khi khong co tournament @smoke @tournaments', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — mock API to return empty list
    // ============================================================
    const page = tier3Page
    await page.route('**/api/tournaments*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    )

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.goto('/tournaments')
    await page.waitForSelector('[data-testid="tournaments-empty"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('tournaments-empty')).toBeVisible()

    // ============================================================
    // CLEANUP
    // ============================================================
    await page.unroute('**/api/tournaments*')
  })

})
