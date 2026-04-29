/**
 * W-M12 — Notifications (L2 Happy Path)
 *
 * Routes: AppLayout notification bell
 * Spec ref: SPEC_USER §12
 * Note: Notification panel NOT IMPL — limited L2 coverage.
 */

import { test, expect } from '../../fixtures/auth'

const BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

// ── Tests ───────────────────────────────────────────────────────────

test.describe('W-M12 Notifications — L2 Happy Path @happy-path @notifications', () => {

  test('W-M12-L2-001: Notification bell visible on all authenticated pages @parallel-safe', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const routes = ['/', '/practice', '/ranked', '/profile']

    for (const route of routes) {
      await page.goto(route)

      // ============================================================
      // SECTION 3: UI ASSERTIONS
      // ============================================================
      await expect(page.getByTestId('nav-notification-bell')).toBeVisible({
        timeout: 5_000,
      })
    }
  })

  test('W-M12-L2-002: GET /api/notifications returns user notifications array @parallel-safe', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const res = await page.request.get('/api/notifications')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.ok()).toBe(true)
    const notifications = await res.json()
    expect(Array.isArray(notifications)).toBe(true)

    // Each notification has required fields
    for (const n of notifications) {
      expect(n).toHaveProperty('id')
      expect(n).toHaveProperty('type')
      expect(n).toHaveProperty('title')
      expect(n).toHaveProperty('read')
      expect(n).toHaveProperty('createdAt')
    }

    // Sorted by createdAt desc
    for (let i = 1; i < notifications.length; i++) {
      const prev = new Date(notifications[i - 1].createdAt).getTime()
      const curr = new Date(notifications[i].createdAt).getTime()
      expect(prev).toBeGreaterThanOrEqual(curr)
    }
  })

})
