/**
 * A-M03 + A-M04 — Questions CRUD + Duplicate Detection (L1 Smoke)
 *
 * Routes: /admin/questions
 * Spec ref: SPEC_ADMIN S3, S4
 */

import { test, expect } from '../../fixtures/auth'

// ────────────────────────────────────────────────────────────────
// A-M03 + A-M04 Questions CRUD + Duplicate Detection — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M03 + A-M04 Questions CRUD — L1 Smoke', () => {
  // ── A-M03-L1-001 ── admin ──────────────────────────────────
  test('A-M03-L1-001: Questions list page render dung @smoke @admin @questions @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/questions')
    await adminPage.waitForSelector('[data-testid="admin-questions-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/questions')
    await expect(adminPage.getByTestId('admin-questions-page')).toBeVisible()
    await expect(adminPage.getByTestId('admin-questions-table')).toBeVisible()
    await expect(adminPage.getByTestId('admin-questions-add-btn')).toBeVisible()
  })

})
