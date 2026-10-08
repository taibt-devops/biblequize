/**
 * A-M06 — Review Queue (L1 Smoke)
 *
 * Routes: /admin/review-queue
 * Spec ref: SPEC_ADMIN S6
 */

import { test, expect } from '../../fixtures/auth'

// ────────────────────────────────────────────────────────────────
// A-M06 Review Queue — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M06 Review Queue — L1 Smoke', () => {
  // ── A-M06-L1-001 ── admin ──────────────────────────────────
  test('A-M06-L1-001: Review Queue page render dung @smoke @admin @review @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/review-queue')
    await adminPage.waitForSelector('[data-testid="review-queue-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/review-queue')
    await expect(adminPage.getByTestId('review-queue-page')).toBeVisible()
    await expect(adminPage.getByTestId('review-queue-stats')).toBeVisible()
  })

})
