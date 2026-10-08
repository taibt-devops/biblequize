/**
 * A-M07 — Feedback & Moderation (L1 Smoke)
 *
 * Routes: /admin/feedback
 * Spec ref: SPEC_ADMIN S7
 */

import { test, expect } from '../../fixtures/auth'

// ────────────────────────────────────────────────────────────────
// A-M07 Feedback & Moderation — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M07 Feedback & Moderation — L1 Smoke', () => {
  // ── A-M07-L1-001 ── admin ──────────────────────────────────
  test('A-M07-L1-001: Feedback page render dung @smoke @admin @feedback @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/feedback')
    await adminPage.waitForSelector('[data-testid="admin-feedback-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/feedback')
    await expect(adminPage.getByTestId('admin-feedback-page')).toBeVisible()
    await expect(adminPage.getByTestId('feedback-stats-cards')).toBeVisible()
    await expect(adminPage.getByTestId('feedback-table')).toBeVisible()
  })

  // ── A-M07-L1-002 ── admin ──────────────────────────────────
  // SKIP: UI component [feedback-stat-pending, feedback-stat-resolved] not implemented yet
  test.skip('A-M07-L1-002: Stats cards hien thi du trang thai @smoke @admin @feedback', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/feedback')
    await adminPage.waitForSelector('[data-testid="feedback-stats-cards"]')

    // ── UI Assertions ──
    await expect(adminPage.getByTestId('feedback-stat-pending')).toBeVisible()
    await expect(adminPage.getByTestId('feedback-stat-resolved')).toBeVisible()
    await expect(adminPage.getByTestId('feedback-stat-rejected')).toBeVisible()
  })

  // ── A-M07-L1-004 ── admin ──────────────────────────────────
  test('A-M07-L1-004: Click feedback mo detail modal + update status @smoke @admin @feedback @write', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/feedback')
    await adminPage.waitForSelector('[data-testid="feedback-row"]')
    await adminPage.getByTestId('feedback-row').first().click()
    await adminPage.waitForSelector('[data-testid="feedback-detail-modal"]')

    // ── UI Assertions ── (modal visible)
    await expect(adminPage.getByTestId('feedback-detail-modal')).toBeVisible()

    // ── Update status — feedback-status-select is a div with buttons, not <select> ──
    await adminPage
      .getByTestId('feedback-status-select')
      .locator('button')
      .filter({ hasText: /in progress|Đang xử lý/i })
      .first()
      .click()

    // ── UI Assertions ── (status updated)
    await expect(adminPage.getByTestId('feedback-detail-modal')).toContainText(
      /in_progress|đang xử lý/i,
    )
  })
})
