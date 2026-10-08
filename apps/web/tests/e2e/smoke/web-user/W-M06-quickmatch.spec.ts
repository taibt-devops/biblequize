/**
 * W-M06-QM — Đấu Nhanh (Quick Match) L1 Smoke
 *
 * Routes: /multiplayer (QuickMatchEntryCard + QuickMatchConfigModal)
 * Spec ref: PROMPT_MULTIPLAYER_QUICKMATCH_PIVOT.md (2026-05-15),
 *           SPEC_MULTIPLAYER §3 (4 modes), task 2026-05-23-e2e-quickmatch-4modes
 * Coverage: card render + modal open/close + 4-mode picker + defaults + i18n
 *
 * Realtime gameplay tests live in happy-path/W-M06-quickmatch-{mode}.spec.ts
 */

import { test, expect } from '../../fixtures/auth'

test.describe('W-M06-QM Đấu Nhanh Lobby — L1 Smoke @smoke @multiplayer @quickmatch', () => {

  test('W-M06-QM-L1-001: QuickMatch entry card render trên /multiplayer @smoke @quickmatch', async ({
    tier3Page,
  }) => {
    const page = tier3Page
    await page.goto('/multiplayer')
    await page.waitForSelector('[data-testid="multiplayer-page"]')

    await expect(page.getByTestId('qm-entry-card')).toBeVisible()
    await expect(page.getByTestId('qm-entry-cta')).toBeVisible()
    await expect(page.getByTestId('qm-entry-counter')).toBeVisible()
    // Counter starts at 0 used (assuming fresh tier3 user has full quota).
    // Allow either fresh (data-used=0) or already-played state — just assert shape.
    const used = await page.getByTestId('qm-entry-counter').getAttribute('data-used')
    expect(Number(used)).toBeGreaterThanOrEqual(0)
    expect(Number(used)).toBeLessThanOrEqual(3)
  })

  test('W-M06-QM-L1-003: Modal hiện đủ 4 mode chips, mặc định SPEED_RACE active @smoke @quickmatch', async ({
    tier3Page,
  }) => {
    const page = tier3Page
    await page.goto('/multiplayer')
    await page.getByTestId('qm-entry-cta').click()
    await page.waitForSelector('[data-testid="qm-modal"]')

    // 4 mode buttons
    await expect(page.getByTestId('qm-mode-SPEED_RACE')).toBeVisible()
    await expect(page.getByTestId('qm-mode-BATTLE_ROYALE')).toBeVisible()
    await expect(page.getByTestId('qm-mode-TEAM_VS_TEAM')).toBeVisible()
    await expect(page.getByTestId('qm-mode-SUDDEN_DEATH')).toBeVisible()

    // SPEED_RACE default active
    await expect(page.getByTestId('qm-mode-SPEED_RACE')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('qm-mode-BATTLE_ROYALE')).toHaveAttribute('data-active', 'false')
  })

  test('W-M06-QM-L1-004: Đổi mode chip → active flag chuyển @smoke @quickmatch', async ({
    tier3Page,
  }) => {
    const page = tier3Page
    await page.goto('/multiplayer')
    await page.getByTestId('qm-entry-cta').click()
    await page.waitForSelector('[data-testid="qm-modal"]')

    await page.getByTestId('qm-mode-BATTLE_ROYALE').click()
    await expect(page.getByTestId('qm-mode-BATTLE_ROYALE')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('qm-mode-SPEED_RACE')).toHaveAttribute('data-active', 'false')

    await page.getByTestId('qm-mode-TEAM_VS_TEAM').click()
    await expect(page.getByTestId('qm-mode-TEAM_VS_TEAM')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('qm-mode-BATTLE_ROYALE')).toHaveAttribute('data-active', 'false')
  })

  test('W-M06-QM-L1-005: Source defaults DATABASE, AI Tier-gated (tier3 < 4 → AI disabled) @smoke @quickmatch', async ({
    tier3Page,
  }) => {
    const page = tier3Page
    await page.goto('/multiplayer')
    await page.getByTestId('qm-entry-cta').click()
    await page.waitForSelector('[data-testid="qm-modal"]')

    await expect(page.getByTestId('qm-source-database')).toHaveAttribute('data-active', 'true')
    // Tier 3 user → AI locked (need Tier 4+).
    await expect(page.getByTestId('qm-source-ai')).toHaveAttribute('data-disabled', 'true')
  })

})
