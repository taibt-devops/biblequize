/**
 * A-M09 — Events & Tournaments Admin (L1 Smoke)
 *
 * Routes: /admin/events
 * Spec ref: SPEC_ADMIN S9
 */

import { test, expect } from '../../fixtures/auth'

// ────────────────────────────────────────────────────────────────
// A-M09 Events & Tournaments Admin — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M09 Events & Tournaments — L1 Smoke', () => {
  // ── A-M09-L1-001 ── admin ──────────────────────────────────
  test('A-M09-L1-001: Events page render dung @smoke @admin @events @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/events')
    await adminPage.waitForSelector('[data-testid="admin-events-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/events')
    await expect(adminPage.getByTestId('admin-events-page')).toBeVisible()
  })

  // ── A-M09-L1-003 ── admin ──────────────────────────────────
  test('A-M09-L1-003: Create tournament button visible @smoke @admin @events', async ({
    adminPage,
  }) => {
    // [NOT IMPLEMENTED: create tournament form chua implement — hien chi read-only list]
    test.skip()

    // ── Actions ──
    await adminPage.goto('/admin/events')
    await adminPage.waitForSelector('[data-testid="admin-events-page"]')

    // ── UI Assertions ──
    await expect(adminPage.getByTestId('create-tournament-btn')).toBeVisible()
  })

})
