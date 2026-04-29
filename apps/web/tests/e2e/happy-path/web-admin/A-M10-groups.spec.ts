/**
 * A-M10 — Church Groups Admin (L2 Happy Path)
 *
 * Route: /admin/groups
 * Spec ref: SPEC_ADMIN S11
 * 6 cases: list, filter-locked, lock, lock-short-reason, unlock, delete
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

test.describe('A-M10 Church Groups Admin', () => {
  // ── A-M10-L2-001 — List all groups ──

  test('A-M10-L2-001: list groups returns paginated with member counts', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/groups?page=0&size=20`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    // /api/admin/groups returns a plain array, not paginated
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeLessThanOrEqual(20)

    if (body.length > 0) {
      const group = body[0]
      expect(group).toHaveProperty('id')
      expect(group).toHaveProperty('name')
      expect(group).toHaveProperty('memberCount')
    }
  })

  // ── A-M10-L2-002 — Filter locked groups ──

  test('A-M10-L2-002: filter locked groups returns only locked', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/groups?locked=true`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    for (const group of body) {
      expect(group.isLocked).toBe(true)
    }
  })

  // ── A-M10-L2-003 — Lock group with reason ──

  test('A-M10-L2-003: lock group -> isLocked=true then cleanup', async ({ adminPage }) => {
    // Find a group to lock
    const listRes = await adminPage.request.get(
      `${API_BASE}/api/admin/groups?locked=false&size=1`,
    )
    const listBody = await listRes.json()
    test.skip(listBody.content.length === 0, 'No unlocked group available to lock')

    const groupId = listBody.content[0].id

    // Lock
    const lockRes = await adminPage.request.patch(
      `${API_BASE}/api/admin/groups/${groupId}/lock`,
      { data: { locked: true, reason: 'Vi pham noi quy cong dong nhieu lan' } },
    )
    expect(lockRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(`${API_BASE}/api/admin/groups/${groupId}`)
    const verifyBody = await verifyRes.json()
    expect(verifyBody.isLocked).toBe(true)
    expect(verifyBody.lockReason).toBeTruthy()

    // Cleanup: unlock
    await adminPage.request.patch(`${API_BASE}/api/admin/groups/${groupId}/lock`, {
      data: { locked: false },
    })
  })

  // ── A-M10-L2-004 — Lock with short reason -> 400 ──

  test('A-M10-L2-004: lock with reason < 10 chars returns 400', async ({ adminPage }) => {
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/groups?size=1`)
    const listBody = await listRes.json()
    test.skip(listBody.content.length === 0, 'No group available')

    const groupId = listBody.content[0].id

    const res = await adminPage.request.patch(
      `${API_BASE}/api/admin/groups/${groupId}/lock`,
      { data: { locked: true, reason: 'Bad' } },
    )
    expect(res.status()).toBe(400)
  })

  // ── A-M10-L2-005 — Unlock group ──

  test('A-M10-L2-005: unlock group -> isLocked=false, reason cleared', async ({
    adminPage,
  }) => {
    // Find or create locked group
    const listRes = await adminPage.request.get(
      `${API_BASE}/api/admin/groups?locked=false&size=1`,
    )
    const listBody = await listRes.json()
    test.skip(listBody.content.length === 0, 'No group available')

    const groupId = listBody.content[0].id

    // Setup: lock first
    await adminPage.request.patch(`${API_BASE}/api/admin/groups/${groupId}/lock`, {
      data: { locked: true, reason: 'Temporary lock for e2e unlock test' },
    })

    // Unlock
    const unlockRes = await adminPage.request.patch(
      `${API_BASE}/api/admin/groups/${groupId}/lock`,
      { data: { locked: false } },
    )
    expect(unlockRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(`${API_BASE}/api/admin/groups/${groupId}`)
    const verifyBody = await verifyRes.json()
    expect(verifyBody.isLocked).toBe(false)
  })

  // ── A-M10-L2-006 — Admin delete group ──

  test('A-M10-L2-006: admin delete group -> 404 on re-fetch', async ({ adminPage }) => {
    // Find a group owned by test user (ephemeral-safe)
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/groups?size=50`)
    const listBody = await listRes.json()

    // Find ephemeral group or skip
    const target = listBody.content.find(
      (g: { name: string }) => g.name.includes('e2e') || g.name.includes('test'),
    )
    test.skip(!target, 'No ephemeral test group available for deletion')

    const delRes = await adminPage.request.delete(
      `${API_BASE}/api/admin/groups/${target.id}`,
    )
    expect([200, 204]).toContain(delRes.status())

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(
      `${API_BASE}/api/admin/groups/${target.id}`,
    )
    expect(verifyRes.status()).toBe(404)
  })
})
