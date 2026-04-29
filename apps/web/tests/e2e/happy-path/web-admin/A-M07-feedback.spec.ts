/**
 * A-M07 — Feedback & Moderation (L2 Happy Path)
 *
 * Route: /admin/feedback
 * Spec ref: SPEC_ADMIN S8
 * 6 cases: list, filter-by-type, update-status, resolve, stats, soft-delete
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

test.describe('A-M07 Feedback & Moderation', () => {
  // ── A-M07-L2-001 — List feedback with status filter ──

  test('A-M07-L2-001: list feedback filtered by PENDING status', async ({ adminPage }) => {
    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/feedback?status=PENDING&page=0&size=20`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('content')
    expect(body.content.length).toBeLessThanOrEqual(20)

    for (const item of body.content) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('status')
      expect(item.status).toBe('PENDING')
    }
  })

  // ── A-M07-L2-002 — Filter by type BUG ──

  test('A-M07-L2-002: filter feedback by type BUG returns only bugs', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/feedback?type=BUG`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    for (const item of body.content) {
      expect(item.type).toBe('BUG')
    }
  })

  // ── A-M07-L2-003 — Update status PENDING -> IN_PROGRESS ──

  test('A-M07-L2-003: update feedback status to IN_PROGRESS', async ({ adminPage }) => {
    // Get a pending feedback item
    const listRes = await adminPage.request.get(
      `${API_BASE}/api/admin/feedback?status=PENDING&size=1`,
    )
    const listBody = await listRes.json()
    test.skip(listBody.content.length === 0, 'No pending feedback to test')

    const feedbackId = listBody.content[0].id

    // Update status
    const patchRes = await adminPage.request.patch(
      `${API_BASE}/api/admin/feedback/${feedbackId}`,
      { data: { status: 'IN_PROGRESS' } },
    )
    expect(patchRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(
      `${API_BASE}/api/admin/feedback/${feedbackId}`,
    )
    const verifyBody = await verifyRes.json()
    expect(verifyBody.status).toBe('IN_PROGRESS')

    // Cleanup: revert to PENDING
    await adminPage.request.patch(`${API_BASE}/api/admin/feedback/${feedbackId}`, {
      data: { status: 'PENDING' },
    })
  })

  // ── A-M07-L2-004 — Update status -> RESOLVED with response ──

  test('A-M07-L2-004: resolve feedback with response message', async ({ adminPage }) => {
    const listRes = await adminPage.request.get(
      `${API_BASE}/api/admin/feedback?status=PENDING&size=1`,
    )
    const listBody = await listRes.json()
    test.skip(listBody.content.length === 0, 'No pending feedback to test')

    const feedbackId = listBody.content[0].id

    const patchRes = await adminPage.request.patch(
      `${API_BASE}/api/admin/feedback/${feedbackId}`,
      { data: { status: 'RESOLVED', response: 'Da fix trong version 2.6' } },
    )
    expect(patchRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(
      `${API_BASE}/api/admin/feedback/${feedbackId}`,
    )
    const verifyBody = await verifyRes.json()
    expect(verifyBody.status).toBe('RESOLVED')
    expect(verifyBody.response).toBeTruthy()

    // Cleanup: revert
    await adminPage.request.patch(`${API_BASE}/api/admin/feedback/${feedbackId}`, {
      data: { status: 'PENDING', response: null },
    })
  })

  // ── A-M07-L2-005 — Stats endpoint ──

  test('A-M07-L2-005: feedback stats returns counts by status and type', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/feedback/stats`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('pending')
    expect(body).toHaveProperty('inProgress')
    expect(body).toHaveProperty('resolved')
    expect(body.pending).toBeGreaterThanOrEqual(0)
  })

  // ── A-M07-L2-006 — Soft delete feedback ──

  test('A-M07-L2-006: delete feedback removes from default list', async ({ adminPage }) => {
    // Get a feedback item
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/feedback?size=1`)
    const listBody = await listRes.json()
    test.skip(listBody.content.length === 0, 'No feedback to test delete')

    const feedbackId = listBody.content[0].id

    const delRes = await adminPage.request.delete(
      `${API_BASE}/api/admin/feedback/${feedbackId}`,
    )
    expect([200, 204]).toContain(delRes.status())

    // Section 4: API Verification — not in default list
    const afterRes = await adminPage.request.get(`${API_BASE}/api/admin/feedback?size=100`)
    const afterBody = await afterRes.json()
    const found = afterBody.content.find((f: { id: string }) => f.id === feedbackId)
    expect(found).toBeFalsy()
  })
})
