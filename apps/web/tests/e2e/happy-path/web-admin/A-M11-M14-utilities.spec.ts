/**
 * A-M11 + A-M12 + A-M13 + A-M14 — Utilities Admin (L2 Happy Path)
 *
 * Routes: /admin/notifications, /admin/config, /admin/export, /admin/question-quality
 * Spec ref: SPEC_ADMIN S12-15
 * 8 cases: notification-list, broadcast-stub, config-get, config-save-stub,
 *          export-questions-stub, export-users-stub, quality-score, coverage-consistency
 *
 * NOTE: Several endpoints are NOT IMPLEMENTED (stubs) per Phase 2 L1 findings.
 */

import { test, expect } from '../../fixtures/auth'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

// ═══════════════════════════════════════════════════════════════════════════
// A-M11 — Notifications Broadcast
// ═══════════════════════════════════════════════════════════════════════════

test.describe('A-M11 Notifications', () => {
  // ── A-M11-L2-001 — GET broadcast history ──

  test('A-M11-L2-001: list notification broadcast history', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/notifications`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)

    if (body.length > 0) {
      const item = body[0]
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('sentAt')
    }
  })

  // ── A-M11-L2-002 — POST broadcast (stub) ──

  test('A-M11-L2-002: broadcast notification returns stub success', async ({ adminPage }) => {
    test.skip() // [NOT IMPLEMENTED]: broadcast delivery is setTimeout placeholder

    const res = await adminPage.request.post(
      `${API_BASE}/api/admin/notifications/broadcast`,
      {
        data: {
          title: 'E2E Test Broadcast',
          content: 'Test notification content from e2e',
          audience: 'ALL',
        },
      },
    )
    // Stub returns 200 but no actual delivery
    expect(res.status()).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A-M12 — Configuration
// ═══════════════════════════════════════════════════════════════════════════

test.describe('A-M12 Configuration', () => {
  // ── A-M12-L2-003 — GET game config values ──

  test('A-M12-L2-003: get admin config returns game + scoring config', async ({
    adminPage,
  }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/config`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('game')
    expect(body.game).toHaveProperty('dailyEnergy')
  })

  // ── A-M12-L2-004 — PATCH config (stub, no persistence) ──

  test('A-M12-L2-004: patch config stub does not persist changes', async ({ adminPage }) => {
    test.skip() // [NOT IMPLEMENTED]: config save endpoint has no persistence

    // Get current value
    const beforeRes = await adminPage.request.get(`${API_BASE}/api/admin/config`)
    const beforeBody = await beforeRes.json()
    const originalEnergy = beforeBody.game.dailyEnergy

    // Attempt to patch
    const patchRes = await adminPage.request.patch(`${API_BASE}/api/admin/config`, {
      data: { game: { dailyEnergy: 120 } },
    })
    expect(patchRes.status()).toBe(200)

    // Verify value unchanged (stub behavior)
    const afterRes = await adminPage.request.get(`${API_BASE}/api/admin/config`)
    const afterBody = await afterRes.json()
    expect(afterBody.game.dailyEnergy).toBe(originalEnergy)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A-M13 — Export Center
// ═══════════════════════════════════════════════════════════════════════════

test.describe('A-M13 Export Center', () => {
  // ── A-M13-L2-005 — Export questions CSV (stub) ──

  test('A-M13-L2-005: export questions CSV returns not-implemented', async ({ adminPage }) => {
    test.skip() // [NOT IMPLEMENTED]: export API returns alert stub

    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/export/questions?format=csv`,
    )
    // Expected: 404 or 501 (not implemented)
    expect([404, 501]).toContain(res.status())
  })

  // ── A-M13-L2-006 — Export users JSON (stub) ──

  test('A-M13-L2-006: export users JSON returns not-implemented', async ({ adminPage }) => {
    test.skip() // [NOT IMPLEMENTED]: export API returns alert stub

    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/export/users?format=json`,
    )
    expect([404, 501]).toContain(res.status())
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A-M14 — Question Quality
// ═══════════════════════════════════════════════════════════════════════════

test.describe('A-M14 Question Quality', () => {
  // ── A-M14-L2-007 — GET quality score + coverage ──

  test('A-M14-L2-007: question quality returns score and coverage', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/question-quality`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('overallScore')
    expect(body.overallScore).toBeGreaterThanOrEqual(0)
    expect(body.overallScore).toBeLessThanOrEqual(100)
    // NOTE: overallScore currently hardcoded 72/100 per Phase 2 L1 finding
  })

  // ── A-M14-L2-008 — Coverage map consistency ──

  test('A-M14-L2-008: coverage consistent between quality and questions endpoints', async ({
    adminPage,
  }) => {
    const [qualityRes, coverageRes] = await Promise.all([
      adminPage.request.get(`${API_BASE}/api/admin/question-quality`),
      adminPage.request.get(`${API_BASE}/api/admin/questions/coverage`),
    ])

    expect(qualityRes.status()).toBe(200)
    expect(coverageRes.status()).toBe(200)

    const quality = await qualityRes.json()
    const coverage = await coverageRes.json()

    // Both should have coverage data
    expect(quality).toHaveProperty('coverage')
    expect(Array.isArray(coverage)).toBe(true)

    // Cross-check a book if both have data
    if (quality.coverage?.length > 0 && coverage.length > 0) {
      const qualityBook = quality.coverage[0].book
      const coverageMatch = coverage.find((c: { book: string }) => c.book === qualityBook)
      if (coverageMatch) {
        // Percent should be close (within 5% tolerance for timing)
        expect(
          Math.abs(quality.coverage[0].percent - coverageMatch.coveragePercent),
        ).toBeLessThanOrEqual(5)
      }
    }
  })
})
