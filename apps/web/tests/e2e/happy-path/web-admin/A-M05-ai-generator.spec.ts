/**
 * A-M05 — AI Question Generator (L2 Happy Path)
 *
 * Route: /admin/ai-generator
 * Spec ref: SPEC_ADMIN S6
 * 6 cases: generate Gemini, generate Claude, invalid provider, list drafts, approve, reject
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

test.describe('A-M05 AI Question Generator', () => {
  // ── A-M05-L2-001 — Generate drafts with Gemini provider ──

  test('A-M05-L2-001: generate drafts with Gemini returns draft array', async ({
    adminPage,
  }) => {
    // NOTE: This test depends on AI API key availability in dev env
    // May need to be skipped if no API key is configured
    test.skip() // [BLOCKED]: requires Gemini API key in test environment

    const res = await adminPage.request.post(`${API_BASE}/api/admin/ai-generator/generate`, {
      data: {
        book: 'Genesis',
        chapter: 1,
        difficulty: 'easy',
        count: 3,
        provider: 'gemini',
        language: 'vi',
      },
      timeout: 30_000,
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('drafts')
    expect(body.drafts.length).toBeGreaterThanOrEqual(1)

    const draft = body.drafts[0]
    expect(draft).toHaveProperty('id')
    expect(draft).toHaveProperty('content')
    expect(draft).toHaveProperty('options')
    expect(draft.status).toMatch(/PENDING_REVIEW/i)

    // Cleanup: reject all drafts
    for (const d of body.drafts) {
      await adminPage.request.post(
        `${API_BASE}/api/admin/ai-generator/drafts/${d.id}/reject`,
      )
    }
  })

  // ── A-M05-L2-002 — Generate with Claude provider ──

  test('A-M05-L2-002: generate drafts with Claude provider', async ({ adminPage }) => {
    test.skip() // [BLOCKED]: requires Claude API key in test environment

    const res = await adminPage.request.post(`${API_BASE}/api/admin/ai-generator/generate`, {
      data: {
        book: 'Genesis',
        chapter: 1,
        difficulty: 'easy',
        count: 2,
        provider: 'claude',
        language: 'vi',
      },
      timeout: 30_000,
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('drafts')
    expect(body.drafts.length).toBeGreaterThanOrEqual(1)

    // Cleanup
    for (const d of body.drafts) {
      await adminPage.request.post(
        `${API_BASE}/api/admin/ai-generator/drafts/${d.id}/reject`,
      )
    }
  })

  // ── A-M05-L2-003 — Invalid provider -> 400 ──

  test('A-M05-L2-003: generate with invalid provider returns 400', async ({ adminPage }) => {
    const res = await adminPage.request.post(`${API_BASE}/api/admin/ai-generator/generate`, {
      data: {
        book: 'Genesis',
        chapter: 1,
        difficulty: 'easy',
        count: 1,
        provider: 'random_ai',
        language: 'vi',
      },
    })
    expect(res.status()).toBe(400)
  })

  // ── A-M05-L2-004 — List drafts ──

  test('A-M05-L2-004: list drafts returns pending drafts', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/ai-generator/drafts`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)

    // All drafts should be PENDING_REVIEW
    for (const draft of body) {
      expect(draft.status).toMatch(/PENDING_REVIEW/i)
    }
  })

  // ── A-M05-L2-005 — Approve draft -> becomes question in review queue ──

  test('A-M05-L2-005: approve draft creates question in review queue', async ({
    adminPage,
  }) => {
    test.skip() // [BLOCKED]: requires draft to exist (needs AI generation or test seeder)

    // Setup: get first available draft
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/ai-generator/drafts`)
    const drafts = await listRes.json()
    test.skip(drafts.length === 0, 'No drafts available to approve')

    const draftId = drafts[0].id

    // Approve
    const approveRes = await adminPage.request.post(
      `${API_BASE}/api/admin/ai-generator/drafts/${draftId}/approve`,
    )
    expect(approveRes.status()).toBe(200)

    // Section 4: API Verification
    const approveBody = await approveRes.json()
    expect(approveBody).toHaveProperty('questionId')

    // Verify question exists
    const questionRes = await adminPage.request.get(
      `${API_BASE}/api/admin/questions/${approveBody.questionId}`,
    )
    expect(questionRes.status()).toBe(200)
    const question = await questionRes.json()
    expect(question.reviewStatus).toMatch(/PENDING/i)

    // Cleanup: delete question
    await adminPage.request.delete(
      `${API_BASE}/api/admin/questions/${approveBody.questionId}`,
    )
  })

  // ── A-M05-L2-006 — Reject draft -> deleted ──

  test('A-M05-L2-006: reject draft removes it from list', async ({ adminPage }) => {
    test.skip() // [BLOCKED]: requires draft to exist (needs AI generation or test seeder)

    // Setup: get first available draft
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/ai-generator/drafts`)
    const drafts = await listRes.json()
    test.skip(drafts.length === 0, 'No drafts available to reject')

    const draftId = drafts[0].id

    // Reject
    const rejectRes = await adminPage.request.post(
      `${API_BASE}/api/admin/ai-generator/drafts/${draftId}/reject`,
    )
    expect(rejectRes.status()).toBe(200)

    // Section 4: API Verification — draft gone from list
    const afterRes = await adminPage.request.get(`${API_BASE}/api/admin/ai-generator/drafts`)
    const afterDrafts = await afterRes.json()
    const found = afterDrafts.find((d: { id: string }) => d.id === draftId)
    expect(found).toBeFalsy()
  })
})
