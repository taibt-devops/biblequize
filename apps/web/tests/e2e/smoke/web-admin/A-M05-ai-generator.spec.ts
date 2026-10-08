/**
 * A-M05 — AI Question Generator (L1 Smoke)
 *
 * Routes: /admin/ai-generator
 * Spec ref: SPEC_ADMIN S5
 */

import { test, expect } from '../../fixtures/auth'

// ────────────────────────────────────────────────────────────────
// A-M05 AI Question Generator — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('A-M05 AI Question Generator — L1 Smoke', () => {
  // ── A-M05-L1-001 ── admin ──────────────────────────────────
  test('A-M05-L1-001: AI Generator page render dung @smoke @admin @ai-generator @critical', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/ai-generator')
    await adminPage.waitForSelector('[data-testid="ai-generator-page"]')

    // ── UI Assertions ──
    await expect(adminPage).toHaveURL('/admin/ai-generator')
    await expect(adminPage.getByTestId('ai-generator-page')).toBeVisible()
    await expect(adminPage.getByTestId('ai-scripture-selector')).toBeVisible()
    await expect(adminPage.getByTestId('ai-settings-panel')).toBeVisible()
    await expect(adminPage.getByTestId('ai-generate-btn')).toBeVisible()
  })

  // ── A-M05-L1-002 ── admin ──────────────────────────────────
  test('A-M05-L1-002: Provider selector (Gemini/Claude) visible @smoke @admin @ai-generator', async ({
    adminPage,
  }) => {
    // ── Actions ──
    await adminPage.goto('/admin/ai-generator')
    await adminPage.waitForSelector('[data-testid="ai-provider-select"]')

    // ── UI Assertions ──
    await expect(adminPage.getByTestId('ai-provider-select')).toBeVisible()
    await expect(adminPage.getByTestId('ai-provider-gemini')).toBeVisible()
    await expect(adminPage.getByTestId('ai-provider-claude')).toBeVisible()
  })

})
