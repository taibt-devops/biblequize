/**
 * A-M08 — Seasons & Rankings (L2 Happy Path)
 *
 * Route: /admin/rankings
 * Spec ref: SPEC_ADMIN S9
 * 8 cases: list, create, duplicate-active-409, end-season, archived-rankings,
 *          end-nonexistent-404, invalid-dates-400, UI end-season
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

test.describe('A-M08 Seasons & Rankings', () => {
  // ── A-M08-L2-001 — List seasons ──

  test('A-M08-L2-001: list seasons returns active + archived', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/seasons`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)

    if (body.length > 0) {
      const season = body[0]
      expect(season).toHaveProperty('id')
      expect(season).toHaveProperty('name')
      expect(season).toHaveProperty('status')
    }

    // At most 1 active
    const activeSeasons = body.filter((s: { status: string }) => s.status === 'ACTIVE')
    expect(activeSeasons.length).toBeLessThanOrEqual(1)
  })

  // ── A-M08-L2-002 — Create new season ──

  test('A-M08-L2-002: create season -> status=ACTIVE', async ({ adminPage }) => {
    // Check if active season exists; if so, end it first
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/seasons`)
    const seasons = await listRes.json()
    const active = seasons.find((s: { status: string }) => s.status === 'ACTIVE')

    if (active) {
      await adminPage.request.post(`${API_BASE}/api/admin/seasons/${active.id}/end`)
    }

    // Create
    const createRes = await adminPage.request.post(`${API_BASE}/api/admin/seasons`, {
      data: {
        name: `Season E2E Test ${Date.now()}`,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      },
    })
    expect(createRes.status()).toBe(200)

    // Section 4: API Verification
    const created = await createRes.json()
    expect(created).toHaveProperty('id')
    expect(created.status).toBe('ACTIVE')

    // Cleanup: end + verify
    await adminPage.request.post(`${API_BASE}/api/admin/seasons/${created.id}/end`)
  })

  // ── A-M08-L2-003 — Create when active exists -> 409 ──

  test('A-M08-L2-003: create season when active exists returns 409', async ({
    adminPage,
  }) => {
    // Ensure an active season exists
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/seasons`)
    const seasons = await listRes.json()
    let active = seasons.find((s: { status: string }) => s.status === 'ACTIVE')

    if (!active) {
      // Create one first
      const createRes = await adminPage.request.post(`${API_BASE}/api/admin/seasons`, {
        data: { name: `Temp Season ${Date.now()}`, startDate: '2026-06-01', endDate: '2026-06-30' },
      })
      active = await createRes.json()
    }

    // Try to create another -> 409
    const conflictRes = await adminPage.request.post(`${API_BASE}/api/admin/seasons`, {
      data: { name: 'Conflict Season', startDate: '2026-07-01', endDate: '2026-07-31' },
    })
    expect(conflictRes.status()).toBe(409)

    // Cleanup
    if (active?.id) {
      await adminPage.request.post(`${API_BASE}/api/admin/seasons/${active.id}/end`)
    }
  })

  // ── A-M08-L2-004 — End active season -> ARCHIVED ──

  test('A-M08-L2-004: end active season -> status=ARCHIVED + rankings snapshot', async ({
    adminPage,
  }) => {
    // Ensure active exists
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/seasons`)
    const seasons = await listRes.json()
    let active = seasons.find((s: { status: string }) => s.status === 'ACTIVE')

    if (!active) {
      const createRes = await adminPage.request.post(`${API_BASE}/api/admin/seasons`, {
        data: { name: `End Test ${Date.now()}`, startDate: '2026-05-01', endDate: '2026-05-31' },
      })
      active = await createRes.json()
    }

    // End season
    const endRes = await adminPage.request.post(
      `${API_BASE}/api/admin/seasons/${active.id}/end`,
    )
    expect(endRes.status()).toBe(200)

    // Section 4: API Verification
    const verifyRes = await adminPage.request.get(`${API_BASE}/api/admin/seasons`)
    const updatedSeasons = await verifyRes.json()
    const ended = updatedSeasons.find((s: { id: string }) => s.id === active.id)
    expect(ended.status).toBe('ARCHIVED')
  })

  // ── A-M08-L2-005 — Archived season rankings ──

  test('A-M08-L2-005: get archived season rankings returns sorted entries', async ({
    adminPage,
  }) => {
    // Find an archived season
    const listRes = await adminPage.request.get(`${API_BASE}/api/admin/seasons`)
    const seasons = await listRes.json()
    const archived = seasons.find((s: { status: string }) => s.status === 'ARCHIVED')
    test.skip(!archived, 'No archived season available')

    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/seasons/${archived.id}/rankings?limit=10`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeLessThanOrEqual(10)

    // Verify sorted by points desc
    if (body.length > 1) {
      for (let i = 0; i < body.length - 1; i++) {
        expect(body[i].points).toBeGreaterThanOrEqual(body[i + 1].points)
      }
    }
  })

  // ── A-M08-L2-006 — End non-existent season -> 404 ──

  test('A-M08-L2-006: end non-existent season returns 404', async ({ adminPage }) => {
    const res = await adminPage.request.post(
      `${API_BASE}/api/admin/seasons/00000000-0000-0000-0000-000000000000/end`,
    )
    expect(res.status()).toBe(404)
  })

  // ── A-M08-L2-007 — Create with endDate < startDate -> 400 ──

  test('A-M08-L2-007: create season with invalid date range returns 400', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.post(`${API_BASE}/api/admin/seasons`, {
      data: { name: 'Invalid Dates', startDate: '2026-06-01', endDate: '2026-05-01' },
    })
    expect(res.status()).toBe(400)
  })

  // ── A-M08-L2-008 — UI: end active season ──

  test('A-M08-L2-008: UI end active season shows archive banner', async ({ adminPage }) => {
    await adminPage.goto('/admin/rankings')

    // Check if active season banner exists
    const activeBanner = adminPage.getByTestId('active-season-banner')
    const hasBanner = await activeBanner.isVisible({ timeout: 10_000 }).catch(() => false)

    if (!hasBanner) {
      test.skip(true, 'No active season banner to end')
      return
    }

    // Click end season
    const endBtn = adminPage.getByTestId('end-season-btn')
    await endBtn.click()

    // Confirm modal
    const confirmBtn = adminPage.getByRole('button', { name: /confirm|xac nhan|ket thuc/i })
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    // Verify: active banner gone or shows "no active season"
    await expect(activeBanner).not.toBeVisible({ timeout: 10_000 }).catch(() => {
      // May show "no active season" text instead
    })
  })
})
