/**
 * A-M02 — Users Management (L2 Happy Path)
 *
 * Route: /admin/users
 * Spec ref: SPEC_ADMIN S3
 * 8 cases: list, search, detail, role change, invalid role, ban, short reason, unban
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

test.describe('A-M02 Users Management', () => {
  // ── A-M02-L2-001 — List users paginated ──

  test('A-M02-L2-001: list users returns paginated with required fields', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/users?page=0&size=20`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('content')
    expect(body).toHaveProperty('totalElements')
    expect(body).toHaveProperty('totalPages')
    expect(Array.isArray(body.content)).toBe(true)
    expect(body.content.length).toBeLessThanOrEqual(20)

    if (body.content.length > 0) {
      const user = body.content[0]
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('name')
      expect(user).toHaveProperty('role')
    }
  })

  // ── A-M02-L2-002 — Search by email ──

  test('A-M02-L2-002: search by email returns matching user', async ({ adminPage }) => {
    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/users?search=test3@dev.local`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.totalElements).toBeGreaterThanOrEqual(1)
    expect(body.content[0].email).toBe('test3@dev.local')
  })

  // ── A-M02-L2-003 — Get user detail ──

  test('A-M02-L2-003: get user detail returns full profile', async ({ adminPage, testApi }) => {
    const userId = await testApi.getUserIdByEmail('test3@dev.local')
    const res = await adminPage.request.get(`${API_BASE}/api/admin/users/${userId}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('id', userId)
    expect(body).toHaveProperty('email', 'test3@dev.local')
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('role')
  })

  // ── A-M02-L2-004 — Change role USER -> ADMIN -> revert ──

  test('A-M02-L2-004: change role USER -> ADMIN persists then revert', async ({
    adminPage,
    testApi,
  }) => {
    // Use test5 as ephemeral target to avoid affecting other tests
    const userId = await testApi.getUserIdByEmail('test5@dev.local')

    // Change to ADMIN
    const patchRes = await adminPage.request.patch(`${API_BASE}/api/admin/users/${userId}/role`, {
      data: { role: 'ADMIN' },
    })
    expect(patchRes.status()).toBe(200)

    // Section 4: API Verification — verify persisted
    const verifyRes = await adminPage.request.get(`${API_BASE}/api/admin/users/${userId}`)
    const verifyBody = await verifyRes.json()
    expect(verifyBody.role).toBe('ADMIN')

    // Cleanup: revert to USER
    const revertRes = await adminPage.request.patch(
      `${API_BASE}/api/admin/users/${userId}/role`,
      { data: { role: 'USER' } },
    )
    expect(revertRes.status()).toBe(200)
  })

  // ── A-M02-L2-005 — Invalid role value -> 400 ──

  test('A-M02-L2-005: change role to invalid value returns 400', async ({
    adminPage,
    testApi,
  }) => {
    const userId = await testApi.getUserIdByEmail('test5@dev.local')

    const res = await adminPage.request.patch(`${API_BASE}/api/admin/users/${userId}/role`, {
      data: { role: 'SUPERUSER' },
    })
    expect(res.status()).toBe(400)
  })

  // ── A-M02-L2-006 — Ban user with reason ──

  test('A-M02-L2-006: ban user -> status=BANNED then cleanup', async ({
    adminPage,
    testApi,
  }) => {
    // Use test6 as ephemeral ban target
    const userId = await testApi.getUserIdByEmail('test6@dev.local')

    // Ban
    const banRes = await adminPage.request.patch(`${API_BASE}/api/admin/users/${userId}/ban`, {
      data: { banned: true, reason: 'Vi pham dieu khoan cong dong nhieu lan' },
    })
    expect(banRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(`${API_BASE}/api/admin/users/${userId}`)
    const verifyBody = await verifyRes.json()
    expect(verifyBody.status).toBe('BANNED')
    expect(verifyBody.banReason).toBeTruthy()

    // Cleanup: unban
    const unbanRes = await adminPage.request.patch(`${API_BASE}/api/admin/users/${userId}/ban`, {
      data: { banned: false },
    })
    expect(unbanRes.status()).toBe(200)
  })

  // ── A-M02-L2-007 — Ban with short reason -> 400 ──

  test('A-M02-L2-007: ban with reason < 10 chars returns 400', async ({
    adminPage,
    testApi,
  }) => {
    const userId = await testApi.getUserIdByEmail('test5@dev.local')

    const res = await adminPage.request.patch(`${API_BASE}/api/admin/users/${userId}/ban`, {
      data: { banned: true, reason: 'Bad' },
    })
    expect(res.status()).toBe(400)
  })

  // ── A-M02-L2-008 — Unban user -> status=ACTIVE ──

  test('A-M02-L2-008: unban user -> status returns to ACTIVE', async ({
    adminPage,
    testApi,
  }) => {
    const userId = await testApi.getUserIdByEmail('test6@dev.local')

    // Setup: ban first
    await adminPage.request.patch(`${API_BASE}/api/admin/users/${userId}/ban`, {
      data: { banned: true, reason: 'Temporary ban for e2e test unban flow' },
    })

    // Unban
    const unbanRes = await adminPage.request.patch(`${API_BASE}/api/admin/users/${userId}/ban`, {
      data: { banned: false },
    })
    expect(unbanRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(`${API_BASE}/api/admin/users/${userId}`)
    const verifyBody = await verifyRes.json()
    expect(verifyBody.status).toBe('ACTIVE')
  })
})
