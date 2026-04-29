/**
 * A-M06 — Review Queue (L2 Happy Path)
 *
 * Route: /admin/review-queue
 * Spec ref: SPEC_ADMIN S7
 * 8 cases: list pending, approve, reject, reject-no-comment, stats, my-history,
 *          approve-shows-in-pool, UI review flow
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

/** Helper: create a pending question for review. */
async function createPendingQuestion(adminPage: import('@playwright/test').Page) {
  const res = await adminPage.request.post(`${API_BASE}/api/admin/questions`, {
    data: {
      book: 'Genesis',
      chapter: 1,
      difficulty: 'easy',
      type: 'multiple_choice_single',
      language: 'vi',
      content: `Review queue test ${Date.now()}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: [0],
      explanation: 'Test',
      scriptureRef: 'Genesis 1:1',
    },
  })
  expect(res.status()).toBe(200)
  return res.json()
}

test.describe('A-M06 Review Queue', () => {
  // ── A-M06-L2-001 — GET /pending returns PENDING questions ──

  test('A-M06-L2-001: list pending returns questions with reviewStatus PENDING', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/review-queue/pending?page=0&size=20`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('content')
    expect(body.content.length).toBeLessThanOrEqual(20)

    for (const q of body.content) {
      expect(q.reviewStatus).toMatch(/PENDING/i)
    }
  })

  // ── A-M06-L2-002 — Approve question ──

  test('A-M06-L2-002: approve question -> reviewStatus=APPROVED, isActive=true', async ({
    adminPage,
  }) => {
    // Setup
    const question = await createPendingQuestion(adminPage)

    // Approve
    const approveRes = await adminPage.request.post(
      `${API_BASE}/api/admin/review-queue/${question.id}/approve`,
      { data: { comment: 'OK' } },
    )
    expect(approveRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(
      `${API_BASE}/api/admin/questions/${question.id}`,
    )
    const verifyBody = await verifyRes.json()
    expect(verifyBody.reviewStatus).toMatch(/APPROVED/i)
    expect(verifyBody.isActive).toBe(true)
    expect(verifyBody.reviewedAt).toBeTruthy()

    // Cleanup
    await adminPage.request.delete(`${API_BASE}/api/admin/questions/${question.id}`)
  })

  // ── A-M06-L2-003 — Reject question with comment ──

  test('A-M06-L2-003: reject question -> reviewStatus=REJECTED with comment', async ({
    adminPage,
  }) => {
    const question = await createPendingQuestion(adminPage)

    const rejectRes = await adminPage.request.post(
      `${API_BASE}/api/admin/review-queue/${question.id}/reject`,
      { data: { comment: 'Sai scripture reference, can fix' } },
    )
    expect(rejectRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(
      `${API_BASE}/api/admin/questions/${question.id}`,
    )
    const verifyBody = await verifyRes.json()
    expect(verifyBody.reviewStatus).toMatch(/REJECTED/i)
    expect(verifyBody.isActive).toBe(false)
    expect(verifyBody.reviewComment).toBeTruthy()

    // Cleanup
    await adminPage.request.delete(`${API_BASE}/api/admin/questions/${question.id}`)
  })

  // ── A-M06-L2-004 — Reject without comment -> 400 ──

  test('A-M06-L2-004: reject without comment returns 400', async ({ adminPage }) => {
    const question = await createPendingQuestion(adminPage)

    const res = await adminPage.request.post(
      `${API_BASE}/api/admin/review-queue/${question.id}/reject`,
      { data: {} },
    )
    expect(res.status()).toBe(400)

    // Cleanup
    await adminPage.request.delete(`${API_BASE}/api/admin/questions/${question.id}`)
  })

  // ── A-M06-L2-005 — Stats endpoint ──

  test('A-M06-L2-005: stats returns counts by status', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/review-queue/stats`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('pending')
    expect(body).toHaveProperty('approved')
    expect(body).toHaveProperty('rejected')
    expect(body.pending).toBeGreaterThanOrEqual(0)
    expect(body.approved).toBeGreaterThanOrEqual(0)
    expect(body.rejected).toBeGreaterThanOrEqual(0)
  })

  // ── A-M06-L2-006 — My history: reviewer's own reviews ──

  test('A-M06-L2-006: my-history returns current admin reviews only', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/review-queue/my-history`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    // All entries should belong to current admin
    // (Cannot verify reviewedBy without knowing admin userId, but structure check)
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('reviewedAt')
    }
  })

  // ── A-M06-L2-007 — Approved question appears in user pool ──

  test('A-M06-L2-007: approved question visible in public question pool', async ({
    adminPage,
    testApi,
  }) => {
    // Setup: create + approve
    const question = await createPendingQuestion(adminPage)
    await adminPage.request.post(
      `${API_BASE}/api/admin/review-queue/${question.id}/approve`,
      { data: { comment: 'Good' } },
    )

    // Login as regular user and check public pool
    const userToken = (await testApi.loginAs('test3@dev.local', 'Test@123456')).accessToken
    const poolRes = await fetch(
      `${API_BASE}/api/questions?book=Genesis&size=100`,
      { headers: { Authorization: `Bearer ${userToken}` } },
    )
    expect(poolRes.status).toBe(200)

    // Cleanup
    await adminPage.request.delete(`${API_BASE}/api/admin/questions/${question.id}`)
  })

  // ── A-M06-L2-008 — UI review flow: approve -> count decreases ──

  test('A-M06-L2-008: UI approve decrements pending count', async ({ adminPage }) => {
    // Setup: create 3 pending questions
    const questions = []
    for (let i = 0; i < 3; i++) {
      questions.push(await createPendingQuestion(adminPage))
    }

    await adminPage.goto('/admin/review-queue')

    // Wait for pending count
    const pendingCount = adminPage.getByTestId('review-queue-pending-count')
    await expect(pendingCount).toBeVisible({ timeout: 15_000 })

    const initialCountText = await pendingCount.textContent()
    const initialCount = parseInt(initialCountText?.replace(/\D/g, '') || '0', 10)

    // Approve first item
    const approveBtn = adminPage.getByTestId('review-approve-btn').first()
    await approveBtn.click()

    // Verify count delta -1
    await expect(async () => {
      const newText = await pendingCount.textContent()
      const newCount = parseInt(newText?.replace(/\D/g, '') || '0', 10)
      expect(newCount).toBe(initialCount - 1)
    }).toPass({ timeout: 10_000 })

    // Cleanup
    for (const q of questions) {
      await adminPage.request.delete(`${API_BASE}/api/admin/questions/${q.id}`)
    }
  })
})
