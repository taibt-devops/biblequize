/**
 * A-M11 + A-M12 + A-M13 + A-M14 — Utilities Admin (L1 Smoke)
 *
 * Routes: /admin/notifications, /admin/config, /admin/export, /admin/question-quality
 * Spec ref: SPEC_ADMIN S11-14
 */

import { test, expect } from '../../fixtures/auth'

// ────────────────────────────────────────────────────────────────
// A-M11 Notifications Broadcast — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M11 Notifications Broadcast — L1 Smoke', () => {
  // ── A-M11-L1-001 ── admin ──────────────────────────────────
  test('A-M11-L1-001: Notifications admin page render dung @smoke @admin @notifications @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/notifications')
    await adminPage.waitForSelector('[data-testid="admin-notifications-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/notifications')
    await expect(
      adminPage.getByTestId('admin-notifications-page'),
    ).toBeVisible()
    await expect(
      adminPage.getByTestId('notifications-broadcast-form'),
    ).toBeVisible()
    await expect(adminPage.getByTestId('notifications-history')).toBeVisible()
  })

  // ── A-M11-L1-002 ── admin ──────────────────────────────────
  test('A-M11-L1-002: Broadcast form fill va submit @smoke @admin @notifications @write', async ({
    adminPage,
  }) => {
    // [NOT IMPLEMENTED: broadcast endpoint dung setTimeout placeholder — chua co real API]
    test.skip()

    // ── Actions ──
    await adminPage.goto('/admin/notifications')
    await adminPage.waitForSelector(
      '[data-testid="notifications-broadcast-form"]',
    )
    await adminPage
      .getByTestId('notifications-title-input')
      .fill('Test Broadcast')
    await adminPage
      .getByTestId('notifications-content-input')
      .fill('Thong bao E2E test')
    await adminPage.getByTestId('notifications-send-btn').click()

    // ── UI Assertions ──
    await expect(
      adminPage.getByTestId('notifications-success-toast'),
    ).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────
// A-M12 Configuration — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M12 Configuration — L1 Smoke', () => {

  // ── A-M12-L1-002 ── admin ──────────────────────────────────
  test('A-M12-L1-002: Thay doi gia tri — Save N changes button active @smoke @admin @config', async ({
    adminPage,
  }) => {
    // [NOT IMPLEMENTED: save endpoint /api/admin/config chua implement — button la stub]
    test.skip()

    // ── Actions ──
    await adminPage.goto('/admin/config')
    await adminPage.waitForSelector('[data-testid="config-game-panel"]')
    await adminPage.getByTestId('config-daily-energy-input').fill('90')
    await adminPage.waitForSelector('[data-testid="config-save-btn"]')

    // ── UI Assertions ──
    await expect(adminPage.getByTestId('config-save-btn')).toBeEnabled()
    await expect(adminPage.getByTestId('config-save-btn')).toContainText(
      /Save 1 change/i,
    )
  })
})

// ────────────────────────────────────────────────────────────────
// A-M13 Export Center — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M13 Export Center — L1 Smoke', () => {
  // ── A-M13-L1-001 ── admin ──────────────────────────────────
  // SKIP: UI component [export-questions-card] not implemented yet
  test.skip('A-M13-L1-001: Export Center page render dung @smoke @admin @export @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/export')
    await adminPage.waitForSelector('[data-testid="admin-export-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/export')
    await expect(adminPage.getByTestId('admin-export-page')).toBeVisible()
    await expect(adminPage.getByTestId('export-questions-card')).toBeVisible()
    await expect(adminPage.getByTestId('export-users-card')).toBeVisible()
  })

  // ── A-M13-L1-002 ── admin ──────────────────────────────────
  // SKIP: UI component [export-questions-card, export-btn-csv] not implemented yet
  test.skip('A-M13-L1-002: Export format buttons visible tren moi card @smoke @admin @export', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/export')
    await adminPage.waitForSelector('[data-testid="export-questions-card"]')

    // ── UI Assertions ──
    await expect(
      adminPage
        .getByTestId('export-questions-card')
        .getByTestId('export-btn-csv'),
    ).toBeVisible()
    await expect(
      adminPage
        .getByTestId('export-questions-card')
        .getByTestId('export-btn-json'),
    ).toBeVisible()
  })
})

// ────────────────────────────────────────────────────────────────
// A-M14 Question Quality — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M14 Question Quality — L1 Smoke', () => {

})
