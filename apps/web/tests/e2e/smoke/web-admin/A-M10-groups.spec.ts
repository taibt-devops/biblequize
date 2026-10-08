/**
 * A-M10 — Church Groups Admin (L1 Smoke)
 *
 * Routes: /admin/groups
 * Spec ref: SPEC_ADMIN S10
 */

import { test, expect } from '../../fixtures/auth'

// ────────────────────────────────────────────────────────────────
// A-M10 Church Groups Admin — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M10 Church Groups Admin — L1 Smoke', () => {
  // ── A-M10-L1-001 ── admin ──────────────────────────────────
  test('A-M10-L1-001: Groups admin page render dung @smoke @admin @groups @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/groups')
    await adminPage.waitForSelector('[data-testid="admin-groups-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/groups')
    await expect(adminPage.getByTestId('admin-groups-page')).toBeVisible()
    await expect(adminPage.getByTestId('admin-groups-list')).toBeVisible()
  })

})
