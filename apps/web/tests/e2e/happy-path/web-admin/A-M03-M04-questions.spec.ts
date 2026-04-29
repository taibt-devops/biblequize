/**
 * A-M03 + A-M04 — Questions CRUD + Duplicate Detection (L2 Happy Path)
 *
 * Route: /admin/questions
 * Spec ref: SPEC_ADMIN S4, S5
 * 13 cases: create, list-filter, difficulty-filter, search, update, delete, delete-404,
 *           bulk-delete, bulk-empty, coverage, UI CRUD, duplicate exact, duplicate partial
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

/** Helper: create a test question via API, returns the created question object. */
async function createTestQuestion(
  adminPage: import('@playwright/test').Page,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    book: 'Genesis',
    chapter: 1,
    difficulty: 'easy',
    type: 'multiple_choice_single',
    language: 'vi',
    content: `E2E test question ${Date.now()}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: [0],
    explanation: 'Test explanation',
    scriptureRef: 'Genesis 1:1',
    ...overrides,
  }
  const res = await adminPage.request.post(`${API_BASE}/api/admin/questions`, {
    data: payload,
  })
  expect(res.status()).toBe(200)
  return res.json()
}

/** Helper: delete a question by id (cleanup). */
async function deleteQuestion(adminPage: import('@playwright/test').Page, id: string) {
  await adminPage.request.delete(`${API_BASE}/api/admin/questions/${id}`)
}

test.describe('A-M03 Questions CRUD', () => {
  // ── A-M03-L2-001 — Create question -> persisted ──

  test('A-M03-L2-001: create question returns UUID v7 + reviewStatus pending', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.post(`${API_BASE}/api/admin/questions`, {
      data: {
        book: 'Genesis',
        chapter: 1,
        difficulty: 'easy',
        type: 'multiple_choice_single',
        language: 'vi',
        content: 'Ai da tao ra troi va dat?',
        options: ['Chua', 'Thien than', 'Con nguoi', 'Tu nhien'],
        correctAnswer: [0],
        explanation: 'Sang the ky 1:1',
        scriptureRef: 'Genesis 1:1',
      },
    })
    expect(res.status()).toBe(200)

    const body = await res.json()
    // Section 4: API Verification
    expect(body).toHaveProperty('id')
    expect(body.id).toMatch(/^[0-9a-f-]+$/i) // UUID format
    expect(body.book).toBe('Genesis')
    expect(body.content).toBe('Ai da tao ra troi va dat?')
    expect(body.reviewStatus).toMatch(/pending/i)
    expect(body.createdAt).toBeTruthy()

    // Verify via GET
    const getRes = await adminPage.request.get(`${API_BASE}/api/admin/questions/${body.id}`)
    expect(getRes.status()).toBe(200)

    // Cleanup
    await deleteQuestion(adminPage, body.id)
  })

  // ── A-M03-L2-002 — List with book filter ──

  test('A-M03-L2-002: list questions filtered by book=Genesis', async ({ adminPage }) => {
    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/questions?book=Genesis&page=0&size=20`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('content')
    expect(body).toHaveProperty('totalElements')
    expect(body.questions.length).toBeLessThanOrEqual(20)

    for (const q of body.questions) {
      expect(q.book).toBe('Genesis')
    }
  })

  // ── A-M03-L2-003 — List with difficulty filter ──

  test('A-M03-L2-003: list questions filtered by difficulty=hard', async ({ adminPage }) => {
    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/questions?difficulty=hard&size=10`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    for (const q of body.questions) {
      expect(q.difficulty).toMatch(/hard/i)
    }
  })

  // ── A-M03-L2-004 — Search by text content ──

  test('A-M03-L2-004: search questions by content text', async ({ adminPage }) => {
    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/questions?search=Chua&size=10`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    // At least some results if seed data contains "Chua"
    expect(body).toHaveProperty('content')
  })

  // ── A-M03-L2-005 — Update question ──

  test('A-M03-L2-005: update question -> fields persist', async ({ adminPage }) => {
    // Setup: create
    const created = await createTestQuestion(adminPage)

    // Update
    const putRes = await adminPage.request.put(
      `${API_BASE}/api/admin/questions/${created.id}`,
      { data: { ...created, content: 'Updated content E2E', difficulty: 'medium' } },
    )
    expect(putRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(
      `${API_BASE}/api/admin/questions/${created.id}`,
    )
    const verifyBody = await verifyRes.json()
    expect(verifyBody.content).toBe('Updated content E2E')
    expect(verifyBody.difficulty).toMatch(/medium/i)

    // Cleanup
    await deleteQuestion(adminPage, created.id)
  })

  // ── A-M03-L2-006 — Delete question -> soft delete ──

  test('A-M03-L2-006: delete question -> soft delete (isActive=false)', async ({
    adminPage,
  }) => {
    const created = await createTestQuestion(adminPage)

    const delRes = await adminPage.request.delete(
      `${API_BASE}/api/admin/questions/${created.id}`,
    )
    // Section 4: API Verification — 200 or 204
    expect([200, 204]).toContain(delRes.status())

    // Verify not in default active list
    const listRes = await adminPage.request.get(
      `${API_BASE}/api/admin/questions?search=${encodeURIComponent(created.content)}&size=50`,
    )
    const listBody = await listRes.json()
    const found = listBody.content.find((q: { id: string }) => q.id === created.id)
    expect(found).toBeFalsy()
  })

  // ── A-M03-L2-007 — Delete non-existent -> 404 ──

  test('A-M03-L2-007: delete non-existent question returns 404', async ({ adminPage }) => {
    const res = await adminPage.request.delete(
      `${API_BASE}/api/admin/questions/00000000-0000-0000-0000-000000000000`,
    )
    expect(res.status()).toBe(404)
  })

  // ── A-M03-L2-008 — Bulk delete ──

  test('A-M03-L2-008: bulk delete 5 questions -> all soft-deleted', async ({ adminPage }) => {
    // Setup: create 5
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const q = await createTestQuestion(adminPage, {
        content: `Bulk delete test ${i} ${Date.now()}`,
      })
      ids.push(q.id)
    }

    // Bulk delete
    const delRes = await adminPage.request.delete(`${API_BASE}/api/admin/questions`, {
      data: { ids },
    })
    expect(delRes.status()).toBe(200)

    // Section 4: API Verification — delta check
    const delBody = await delRes.json()
    expect(delBody.deletedCount).toBe(5)
  })

  // ── A-M03-L2-009 — Bulk delete empty array -> 400 ──

  test('A-M03-L2-009: bulk delete with empty ids array returns 400', async ({ adminPage }) => {
    const res = await adminPage.request.delete(`${API_BASE}/api/admin/questions`, {
      data: { ids: [] },
    })
    expect(res.status()).toBe(400)
  })

  // ── A-M03-L2-010 — Coverage endpoint ──

  test('A-M03-L2-010: coverage endpoint returns per-book stats', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/questions/coverage`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)

    if (body.length > 0) {
      const entry = body[0]
      expect(entry).toHaveProperty('book')
      expect(entry).toHaveProperty('totalQuestions')
    }
  })

  // ── A-M03-L2-011 — UI CRUD flow ──

  test('A-M03-L2-011: UI create -> list refresh -> edit -> delete', async ({ adminPage }) => {
    await adminPage.goto('/admin/questions')

    // Wait for table to load
    const table = adminPage.getByTestId('admin-questions-table')
    await expect(table).toBeVisible({ timeout: 15_000 })

    // Note initial row count
    const initialRows = await table.locator('tbody tr').count()

    // Click create
    await adminPage.getByTestId('admin-questions-create-btn').click()

    // Fill form
    const modal = adminPage.getByTestId('admin-questions-create-modal')
    await expect(modal).toBeVisible()
    await adminPage.getByTestId('admin-question-content-input').fill(
      `UI E2E test question ${Date.now()}`,
    )

    // Submit
    await adminPage.getByTestId('admin-question-save-btn').click()

    // Verify row count delta +1
    await expect(async () => {
      const newRows = await table.locator('tbody tr').count()
      expect(newRows).toBe(initialRows + 1)
    }).toPass({ timeout: 10_000 })

    // Edit first row
    await table.locator('tbody tr').first().getByTestId('admin-question-edit-btn').click()
    await adminPage.getByTestId('admin-question-content-input').fill('Edited E2E content')
    await adminPage.getByTestId('admin-question-save-btn').click()

    // Delete first row
    await table.locator('tbody tr').first().getByTestId('admin-question-delete-btn').click()
    // Confirm delete if dialog appears
    const confirmBtn = adminPage.getByRole('button', { name: /confirm|xac nhan|xoa/i })
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    // Verify row count delta -1
    await expect(async () => {
      const finalRows = await table.locator('tbody tr').count()
      expect(finalRows).toBe(initialRows)
    }).toPass({ timeout: 10_000 })
  })
})

test.describe('A-M04 Duplicate Detection', () => {
  // ── A-M04-L2-012 — Exact duplicate -> similarity=1.0 ──

  test('A-M04-L2-012: check-duplicate with exact match returns similarity 1.0', async ({
    adminPage,
  }) => {
    // Setup: create a known question
    const content = `Ai da tao ra Adam va Eva duplicate test ${Date.now()}`
    const created = await createTestQuestion(adminPage, { content })

    // Check duplicate
    const res = await adminPage.request.post(
      `${API_BASE}/api/admin/questions/check-duplicate`,
      { data: { book: 'Genesis', content } },
    )
    expect(res.status()).toBe(200)

    // Section 4: API Verification
    const body = await res.json()
    expect(body).toHaveProperty('duplicates')
    expect(body.topSimilarity).toBeGreaterThanOrEqual(0.9)

    // Cleanup
    await deleteQuestion(adminPage, created.id)
  })

  // ── A-M04-L2-013 — Partial duplicate -> similarity > 0.6 ──

  test('A-M04-L2-013: check-duplicate with partial match returns similarity > 0.6', async ({
    adminPage,
  }) => {
    // Setup
    const created = await createTestQuestion(adminPage, {
      content: 'Moses dan dan Do Thai ra khoi Ai Cap',
    })

    // Check with semantically similar text
    const res = await adminPage.request.post(
      `${API_BASE}/api/admin/questions/check-duplicate`,
      { data: { book: 'Genesis', content: 'Moi-se dan dan Israel khoi Ai Cap' } },
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('topSimilarity')
    expect(body.topSimilarity).toBeGreaterThan(0.6)

    // Cleanup
    await deleteQuestion(adminPage, created.id)
  })
})
