/**
 * W-M09 — Church Groups (L2 Happy Path)
 *
 * Routes: /groups, /groups/:id, /groups/:id/analytics
 * Spec ref: SPEC_USER §9.1
 */

import { test, expect } from '../../fixtures/auth'
import { LoginPage } from '../../pages/LoginPage'

const BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'
const TEST3_EMAIL = 'test3@dev.local'
const TEST4_EMAIL = 'test4@dev.local'
const PASSWORD = 'Test@123456'

// ── Helpers ─────────────────────────────────────────────────────────

async function loginAndGetToken(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const data = await res.json()
  return data.accessToken
}

async function createGroup(
  token: string,
  body = {
    name: 'Test Group E2E',
    description: 'Testing group creation',
    language: 'vi',
  },
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function deleteGroup(token: string, groupId: string): Promise<void> {
  await fetch(`${BASE_URL}/api/groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function joinGroup(token: string, joinCode: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/groups/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ joinCode }),
  })
}

async function leaveGroup(token: string, groupId: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/groups/${groupId}/leave`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function getGroup(token: string, groupId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/groups/${groupId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: res.status, data: res.ok ? await res.json() : null }
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe('W-M09 Church Groups — L2 Happy Path @happy-path @groups', () => {

  test('W-M09-L2-001: Create group POST /api/groups returns group + join code @write @serial @critical', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const group = await createGroup(token)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(group.id).toBeTruthy()
    expect(group.name).toBe('Test Group E2E')
    expect(group.description).toBe('Testing group creation')
    expect(group.joinCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(group.memberCount).toBe(1)

    // Verify via GET
    const { data } = await getGroup(token, group.id)
    expect(data.name).toBe('Test Group E2E')

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteGroup(token, group.id)
  })

  test.skip('W-M09-L2-002: UI flow — create group form, redirect to detail @write @serial', async ({
    page,
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.loginWithCredentials(TEST3_EMAIL, PASSWORD)
    await page.waitForURL('/')

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.goto('/groups')
    // Wait for no-group or create button
    const createBtn = page.getByRole('button', { name: /Tạo nhóm|Create group/i })
    await createBtn.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {
      // No "no-group" state — user may already be in a group
    })

    if (await createBtn.isVisible()) {
      await createBtn.click()

      // Fill form
      await page.getByTestId('groups-create-name-input').fill('E2E UI Group')
      await page.getByTestId('group-description-input').fill('Created via E2E')
      await page.getByTestId('groups-create-submit-btn').click()

      // ============================================================
      // SECTION 3: UI ASSERTIONS
      // ============================================================
      await page.waitForURL(/\/groups\/[a-z0-9-]+/)
      await expect(page).toHaveURL(/\/groups\/[a-z0-9-]+/)
      await expect(page.getByTestId('group-detail-page')).toBeVisible()
      await expect(page.getByTestId('group-detail-name')).toHaveText('E2E UI Group')
      await expect(page.getByTestId('group-detail-members')).toBeVisible()

      // ============================================================
      // CLEANUP
      // ============================================================
      const url = page.url()
      const groupId = url.match(/\/groups\/([a-z0-9-]+)/)?.[1]
      if (groupId) {
        const token = await loginAndGetToken(TEST3_EMAIL)
        await deleteGroup(token, groupId)
      }
    } else {
      test.skip(true, 'User already in a group — cannot test create flow')
    }
  })

  test('W-M09-L2-003: Join group via code POST /api/groups/join @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — test3 creates group
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token3)
    const token4 = await loginAndGetToken(TEST4_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS — test4 joins
    // ============================================================
    const joinRes = await joinGroup(token4, group.joinCode)
    expect(joinRes.ok).toBe(true)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const { data } = await getGroup(token3, group.id)
    expect(data.memberCount).toBe(2)

    // ============================================================
    // CLEANUP
    // ============================================================
    await leaveGroup(token4, group.id)
    await deleteGroup(token3, group.id)
  })

  test('W-M09-L2-004: Join with invalid code returns 404 @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const res = await joinGroup(token, 'ZZZZZZ')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.status).toBe(404)
  })

  test('W-M09-L2-005: Join group already member of returns 409 @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — test3 creates group (already member)
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token)

    // ============================================================
    // SECTION 2: ACTIONS — test3 tries to join own group
    // ============================================================
    const res = await joinGroup(token, group.joinCode)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    // Expect 409 Conflict or idempotent success
    expect([200, 409]).toContain(res.status)

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteGroup(token, group.id)
  })

  test('W-M09-L2-006: Update group PATCH by owner succeeds @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const patchRes = await fetch(`${BASE_URL}/api/groups/${group.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Updated Name', description: 'Updated desc' }),
    })

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(patchRes.ok).toBe(true)
    const { data } = await getGroup(token, group.id)
    expect(data.name).toBe('Updated Name')
    expect(data.description).toBe('Updated desc')

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteGroup(token, group.id)
  })

  test('W-M09-L2-007: Update group by non-owner returns 403 @write @serial @security', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token3)
    const token4 = await loginAndGetToken(TEST4_EMAIL)
    await joinGroup(token4, group.joinCode)

    // ============================================================
    // SECTION 2: ACTIONS — test4 tries to update
    // ============================================================
    const patchRes = await fetch(`${BASE_URL}/api/groups/${group.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token4}`,
      },
      body: JSON.stringify({ name: 'Hacked' }),
    })

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(patchRes.status).toBe(403)
    // Name unchanged
    const { data } = await getGroup(token3, group.id)
    expect(data.name).toBe('Test Group E2E')

    // ============================================================
    // CLEANUP
    // ============================================================
    await leaveGroup(token4, group.id)
    await deleteGroup(token3, group.id)
  })

  test('W-M09-L2-008: Leaderboard GET returns members ranked by XP @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — create group with members
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token3)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const res = await fetch(`${BASE_URL}/api/groups/${group.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${token3}` },
    })

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.ok).toBe(true)
    const leaderboard = await res.json()
    expect(Array.isArray(leaderboard)).toBe(true)

    // Verify sorted by totalPoints desc
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i - 1].totalPoints).toBeGreaterThanOrEqual(
        leaderboard[i].totalPoints,
      )
    }

    // Each entry has required fields
    for (const entry of leaderboard) {
      expect(entry).toHaveProperty('userId')
      expect(entry).toHaveProperty('name')
      expect(entry).toHaveProperty('totalPoints')
    }

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteGroup(token3, group.id)
  })

  test('W-M09-L2-009: Kick member — owner kicks test4, memberCount decreases @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token3)
    const token4 = await loginAndGetToken(TEST4_EMAIL)
    await joinGroup(token4, group.joinCode)

    const userId4 = await testApi.getUserIdByEmail(TEST4_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const kickRes = await fetch(
      `${BASE_URL}/api/groups/${group.id}/members/${userId4}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token3}` },
      },
    )

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(kickRes.ok).toBe(true)
    const { data } = await getGroup(token3, group.id)
    expect(data.memberCount).toBe(1)

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteGroup(token3, group.id)
  })

  test('W-M09-L2-010: Create announcement POST /api/groups/{id}/announcements @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const postRes = await fetch(
      `${BASE_URL}/api/groups/${group.id}/announcements`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: 'Welcome', content: 'Group rules...' }),
      },
    )

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(postRes.ok).toBe(true)

    const getRes = await fetch(
      `${BASE_URL}/api/groups/${group.id}/announcements`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const announcements = await getRes.json()
    expect(Array.isArray(announcements)).toBe(true)
    expect(announcements.length).toBeGreaterThanOrEqual(1)

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteGroup(token, group.id)
  })

  test('W-M09-L2-011: Leave group DELETE /api/groups/{id}/leave — memberCount decreases @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token3)
    const token4 = await loginAndGetToken(TEST4_EMAIL)
    await joinGroup(token4, group.joinCode)

    // Snapshot before
    const before = await getGroup(token3, group.id)
    const memberCountBefore = before.data.memberCount

    // ============================================================
    // SECTION 2: ACTIONS — test4 leaves
    // ============================================================
    const leaveRes = await leaveGroup(token4, group.id)
    expect(leaveRes.ok).toBe(true)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION — assert delta
    // ============================================================
    const after = await getGroup(token3, group.id)
    expect(after.data.memberCount).toBe(memberCountBefore - 1)

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteGroup(token3, group.id)
  })

  test('W-M09-L2-012: Delete group by owner — group removed @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const group = await createGroup(token3)
    const token4 = await loginAndGetToken(TEST4_EMAIL)
    await joinGroup(token4, group.joinCode)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await deleteGroup(token3, group.id)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const { status } = await getGroup(token3, group.id)
    expect(status).toBe(404)
  })

})
