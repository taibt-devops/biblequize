/**
 * W-M09 — Church Groups (L1 Smoke)
 *
 * Routes: /groups, /groups/:id, /groups/:id/analytics
 * Spec ref: SPEC_USER §9
 */

import { test, expect } from '../../fixtures/auth'

test.describe('W-M09 Church Groups — L1 Smoke @smoke @groups', () => {

  test('W-M09-L1-004: Group Detail page render @smoke @groups', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — fetch groupId from test3's groups (seeded in global-setup)
    // ============================================================
    const page = tier3Page
    const groupsRes = await page.request.get(`${process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'}/api/groups/my-groups`)
    const groups = (await groupsRes.json()) as Array<{ id: string }>
    if (!groups.length) {
      test.skip(true, 'No groups for test3 — global-setup seed-group failed')
    }
    const groupId = groups[0].id

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.goto(`/groups/${groupId}`)
    await page.waitForSelector('[data-testid="group-detail-page"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL(/\/groups\/.+/)
    await expect(page.getByTestId('group-detail-page')).toBeVisible()
    await expect(page.getByTestId('group-detail-name')).toBeVisible()
    await expect(page.getByTestId('group-detail-members')).toBeVisible()
  })

})
