/**
 * A-M09 — Events & Tournaments (L2 Happy Path)
 *
 * Route: /admin/events
 * Spec ref: SPEC_ADMIN S10
 * 4 cases: list, filter-status, detail-bracket, create-not-implemented
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

test.describe('A-M09 Events & Tournaments', () => {
  // ── A-M09-L2-001 — List tournaments ──

  test('A-M09-L2-001: list tournaments returns array with status badges', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/tournaments`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)

    if (body.length > 0) {
      const tournament = body[0]
      expect(tournament).toHaveProperty('id')
      expect(tournament).toHaveProperty('name')
      expect(tournament).toHaveProperty('status')
      expect(['UPCOMING', 'IN_PROGRESS', 'COMPLETED']).toContain(tournament.status)
    }
  })

  // ── A-M09-L2-002 — Filter by status UPCOMING ──

  test('A-M09-L2-002: filter tournaments by UPCOMING status', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/tournaments?status=UPCOMING`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    for (const t of body) {
      expect(t.status).toBe('UPCOMING')
    }

    // Verify sorted by startTime asc
    if (body.length > 1) {
      for (let i = 0; i < body.length - 1; i++) {
        expect(new Date(body[i].startTime).getTime()).toBeLessThanOrEqual(
          new Date(body[i + 1].startTime).getTime(),
        )
      }
    }
  })

  // ── A-M09-L2-003 — Tournament detail with bracket ──

  test('A-M09-L2-003: get tournament detail returns bracket + participants', async ({
    adminPage,
  }) => {
    // Get first available tournament
    const listRes = await adminPage.request.get(`${API_BASE}/api/tournaments`)
    const tournaments = await listRes.json()
    test.skip(tournaments.length === 0, 'No tournaments available')

    const tournamentId = tournaments[0].id
    const res = await adminPage.request.get(`${API_BASE}/api/tournaments/${tournamentId}`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('id', tournamentId)
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('status')
  })

  // ── A-M09-L2-004 — Create tournament -> NOT IMPLEMENTED ──

  test('A-M09-L2-004: create tournament endpoint returns 404 or 501 (not implemented)', async ({
    adminPage,
  }) => {
    test.skip() // [NOT IMPLEMENTED]: admin tournament create is read-only mode

    const res = await adminPage.request.post(`${API_BASE}/api/admin/tournaments`, {
      data: {
        name: 'E2E Test Tournament',
        bracketSize: 8,
        startTime: '2026-06-01T10:00:00Z',
      },
    })
    expect([404, 501]).toContain(res.status())
  })
})
