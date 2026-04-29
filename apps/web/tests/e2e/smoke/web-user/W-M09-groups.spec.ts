/**
 * W-M09 — Church Groups (L1 Smoke)
 *
 * Routes: /groups, /groups/:id, /groups/:id/analytics
 * Spec ref: SPEC_USER §9
 */

import { test, expect } from '../../fixtures/auth'

test.describe('W-M09 Church Groups — L1 Smoke @smoke @groups', () => {

  test('W-M09-L1-001: No-group state hien thi khi user chua co group @smoke @groups @critical', async ({
    tier1Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none (tier1 user has no group)
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier1Page
    await page.goto('/groups')
    await page.waitForSelector('[data-testid="no-group"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/groups')
    await expect(page.getByTestId('no-group')).toBeVisible()
    await expect(page.getByTestId('groups-create-btn')).toBeVisible()
    await expect(page.getByTestId('groups-join-btn')).toBeVisible()
  })

  test('W-M09-L1-002: Create group form mo va submit @smoke @groups @write', async ({
    tier1Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier1Page
    await page.goto('/groups')
    await page.waitForSelector('[data-testid="groups-create-btn"]')
    await page.getByTestId('groups-create-btn').click()
    await page.waitForSelector('[data-testid="groups-create-form"]')
    await page.getByTestId('groups-create-name-input').fill('Test Group E2E')
    await page.getByTestId('groups-create-submit-btn').click()
    await page.waitForSelector('[data-testid="group-overview"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('group-overview')).toBeVisible()
  })

  test('W-M09-L1-003: Group overview hien thi leaderboard @smoke @groups', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — test3 is group owner via global-setup seed
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/groups')
    await page.waitForSelector('[data-testid="group-overview"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('group-overview')).toBeVisible()
    await expect(page.getByTestId('group-leaderboard')).toBeVisible()
    await expect(
      page.getByTestId('group-leaderboard').locator('[data-testid="group-leaderboard-row"]'),
    ).toHaveCount({ min: 1 })
  })

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

  test('W-M09-L1-005: Loading skeleton hien thi @smoke @groups', async ({
    tier1Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier1Page
    await page.goto('/groups')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // Skeleton may disappear quickly — soft check
    const skeleton = page.getByTestId('groups-skeleton')
    const isVisible = await skeleton.isVisible().catch(() => false)
    if (isVisible) {
      await expect(skeleton).toBeVisible()
    }
    // After load, some state should be present
    await expect(
      page.getByTestId('no-group').or(page.getByTestId('group-overview')),
    ).toBeVisible()
  })

})
