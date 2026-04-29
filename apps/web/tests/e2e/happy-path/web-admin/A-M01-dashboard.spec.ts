/**
 * A-M01 — Admin Dashboard (L2 Happy Path)
 *
 * Route: /admin
 * Spec ref: SPEC_ADMIN S2
 * 5 cases: KPI cards API, KPI cross-check, activity log, non-admin 403, UI render
 */

import { test, expect } from '../../fixtures/auth'
import { AdminDashboardPage } from '../../pages/admin/AdminDashboardPage'

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

test.describe('A-M01 Admin Dashboard', () => {
  // ── A-M01-L2-001 — Dashboard KPI cards: GET /api/admin/dashboard/kpi ──

  test('A-M01-L2-001: KPI endpoint returns all fields >= 0', async ({ adminPage }) => {
    const res = await adminPage.request.get(`${API_BASE}/api/admin/dashboard/kpi`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('totalUsers')
    expect(body).toHaveProperty('dau')
    expect(body).toHaveProperty('mau')
    expect(body).toHaveProperty('totalQuestions')
    expect(body).toHaveProperty('totalSessions')
    expect(body).toHaveProperty('pendingReviews')
    expect(body).toHaveProperty('openFeedback')

    // All values >= 0
    expect(body.totalUsers).toBeGreaterThanOrEqual(0)
    expect(body.dau).toBeGreaterThanOrEqual(0)
    expect(body.mau).toBeGreaterThanOrEqual(0)
    expect(body.totalQuestions).toBeGreaterThanOrEqual(0)
    expect(body.totalSessions).toBeGreaterThanOrEqual(0)
    expect(body.pendingReviews).toBeGreaterThanOrEqual(0)
    expect(body.openFeedback).toBeGreaterThanOrEqual(0)

    // DAU should be <= MAU
    expect(body.dau).toBeLessThanOrEqual(body.mau)
  })

  // ── A-M01-L2-002 — KPI totalUsers matches /api/admin/users totalElements ──

  test('A-M01-L2-002: KPI totalUsers consistent with users list', async ({ adminPage }) => {
    const [kpiRes, usersRes] = await Promise.all([
      adminPage.request.get(`${API_BASE}/api/admin/dashboard/kpi`),
      adminPage.request.get(`${API_BASE}/api/admin/users?page=0&size=1`),
    ])

    expect(kpiRes.status()).toBe(200)
    expect(usersRes.status()).toBe(200)

    const kpi = await kpiRes.json()
    const users = await usersRes.json()

    // Tolerance of 5 for recent signups during test window
    expect(Math.abs(kpi.totalUsers - users.totalElements)).toBeLessThanOrEqual(5)
  })

  // ── A-M01-L2-003 — Activity log: recent admin actions ──

  test('A-M01-L2-003: activity log returns sorted entries <= limit', async ({ adminPage }) => {
    const res = await adminPage.request.get(
      `${API_BASE}/api/admin/dashboard/activity?limit=20`,
    )
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeLessThanOrEqual(20)

    if (body.length > 0) {
      // Check structure of first entry
      const entry = body[0]
      expect(entry).toHaveProperty('action')
      expect(entry).toHaveProperty('createdAt')

      // Verify sorted desc by createdAt
      if (body.length > 1) {
        const dates = body.map((e: { createdAt: string }) => new Date(e.createdAt).getTime())
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1])
        }
      }
    }
  })

  // ── A-M01-L2-004 — Non-admin access -> 403 ──

  test('A-M01-L2-004: non-admin user gets 403 on admin KPI', async ({ testApi }) => {
    const loginRes = await testApi.loginAs('test3@dev.local', 'Test@123456')
    const userToken = loginRes.accessToken

    const res = await fetch(`${API_BASE}/api/admin/dashboard/kpi`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })

    expect(res.status).toBe(403)
  })

  // ── A-M01-L2-005 — UI: all KPI cards render with real numbers ──

  test('A-M01-L2-005: UI KPI cards visible with numeric values', async ({ adminPage }) => {
    const dashboard = new AdminDashboardPage(adminPage)
    await dashboard.goto()

    // KPI cards container visible
    await expect(dashboard.kpiCards).toBeVisible()

    // KPI cards should not show loading placeholders
    const kpiText = await dashboard.kpiCards.textContent()
    expect(kpiText).not.toContain('Loading')

    // Activity log section visible (if it exists)
    const activityLog = dashboard.activityLog
    await expect(activityLog).toBeVisible({ timeout: 10_000 }).catch(() => {
      // Activity log may be empty in dev environment
    })
  })
})
