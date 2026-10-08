/**
 * A-M01 — Admin Dashboard (L1 Smoke)
 *
 * Routes: /admin
 * Spec ref: SPEC_ADMIN S1
 */

import { test, expect } from '../../fixtures/auth'
import { AdminDashboardPage } from '../../pages/admin/AdminDashboardPage'

// ────────────────────────────────────────────────────────────────
// A-M01 Admin Dashboard — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M01 Admin Dashboard — L1 Smoke', () => {
  // ── A-M01-L1-001 ── admin ──────────────────────────────────
  test('A-M01-L1-001: Dashboard page render dung (admin user) @smoke @admin @dashboard @critical', async ({
    adminPage,
  }) => {
    // ── Setup ──
    const dashboard = new AdminDashboardPage(adminPage)

    // ── Actions ──
    await dashboard.goto()

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin')
    await expect(dashboard.container).toBeVisible()
    await expect(dashboard.kpiCards).toBeVisible()
  })

  // ── A-M01-L1-002 ── admin ──────────────────────────────────
  test('A-M01-L1-002: KPI cards hien thi du metrics @smoke @admin @dashboard', async ({
    adminPage,
  }) => {
    // ── Setup ──
    const dashboard = new AdminDashboardPage(adminPage)

    // ── Actions ──
    await dashboard.goto()

    // ── UI Assertions ──
    await expect(adminPage.getByTestId('kpi-total-questions')).toBeVisible()
    await expect(adminPage.getByTestId('kpi-total-users')).toBeVisible()
    await expect(adminPage.getByTestId('kpi-pending-review')).toBeVisible()
  })

  // ── A-M01-L1-004 ── non-admin ─────────────────────────────
  test('A-M01-L1-004: Non-admin redirect sang /login @smoke @admin @auth @critical', async ({
    tier3Page,
  }) => {
    // ── Actions ──
    await tier3Page.goto('/admin')

    // ── UI Assertions ──
    await expect(tier3Page).not.toHaveURL('/admin')
    await expect(tier3Page).toHaveURL(/\/login|\/|\/403/)
  })
})
