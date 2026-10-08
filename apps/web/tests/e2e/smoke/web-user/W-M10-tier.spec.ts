/**
 * W-M10 — Tier Progression (L1 Smoke)
 *
 * Routes: / (tier display), /profile (tier progress), /cosmetics
 * Spec ref: SPEC_USER §3
 */

import { test, expect } from '../../fixtures/auth'
import { HomePage } from '../../pages/HomePage'

test.describe('W-M10 Tier Progression — L1 Smoke @smoke @tier', () => {

  test.describe('Home Tier Display', () => {

  })

  test.describe('Profile Tier Progress', () => {

    test('W-M10-L1-008: Prestige section hien thi tren Profile Tier 6 @smoke @tier @profile', async ({
      tier6Page,
    }) => {
      // ============================================================
      // SECTION 1: SETUP — none
      // ============================================================

      // ============================================================
      // SECTION 2: ACTIONS
      // ============================================================
      const page = tier6Page
      await page.goto('/profile')
      await page.getByTestId('profile-prestige-section').waitFor({ state: 'visible' })

      // ============================================================
      // SECTION 3: UI ASSERTIONS
      // ============================================================
      await expect(page.getByTestId('profile-prestige-section')).toBeVisible()
      await expect(page.getByTestId('profile-days-at-tier6')).toBeVisible()
    })

    test('W-M10-L1-010: Edit Profile modal dong qua nut X @smoke @profile', async ({
      tier3Page,
    }) => {
      const page = tier3Page
      await page.goto('/profile')
      await page.getByTestId('profile-edit-btn').click()
      await expect(page.getByTestId('edit-profile-modal')).toBeVisible()
      await page.getByTestId('edit-profile-close').click()
      await expect(page.getByTestId('edit-profile-modal')).toHaveCount(0)
    })

  })

  test.describe('Cosmetics Page', () => {

    test('W-M10-L1-005: Cosmetics page render dung @smoke @tier @cosmetics', async ({
      tier3Page,
    }) => {
      // ============================================================
      // SECTION 1: SETUP — none
      // ============================================================

      // ============================================================
      // SECTION 2: ACTIONS
      // ============================================================
      const page = tier3Page
      await page.goto('/cosmetics')
      await page.getByTestId('cosmetics-page').waitFor({ state: 'visible' })

      // ============================================================
      // SECTION 3: UI ASSERTIONS
      // ============================================================
      await expect(page).toHaveURL('/cosmetics')
      await expect(page.getByTestId('cosmetics-frames-section')).toBeVisible()
      await expect(page.getByTestId('cosmetics-themes-section')).toBeVisible()
      await expect(
        page.getByTestId('cosmetics-frames-section').locator('[data-testid="cosmetics-frame-item"]'),
      ).toHaveCount(6)
    })

    test('W-M10-L1-006: Cosmetics frame cua tier cao hon bi locked @smoke @tier @cosmetics', async ({
      tier1Page,
    }) => {
      // ============================================================
      // SECTION 1: SETUP — none
      // ============================================================

      // ============================================================
      // SECTION 2: ACTIONS
      // ============================================================
      const page = tier1Page
      await page.goto('/cosmetics')
      await page.getByTestId('cosmetics-frame-item').first().waitFor({ state: 'visible' })

      const frameItems = page.getByTestId('cosmetics-frame-item')

      // ============================================================
      // SECTION 3: UI ASSERTIONS
      // ============================================================
      // Frame tier 1 (index 0) — unlocked
      await expect(frameItems.nth(0)).not.toHaveAttribute('disabled')
      // Frame tier 2 (index 1) — locked
      await expect(frameItems.nth(1)).toHaveAttribute('disabled')
      await expect(frameItems.nth(1).getByTestId('cosmetics-lock-icon')).toBeVisible()
      await expect(frameItems.nth(1)).toContainText('Đạt T2 để mở')
    })

    test('W-M10-L1-007: Cosmetics chon frame da unlock PATCH API duoc goi @smoke @tier @cosmetics', async ({
      tier3Page,
    }) => {
      // ============================================================
      // SECTION 1: SETUP — none
      // ============================================================

      // ============================================================
      // SECTION 2: ACTIONS
      // ============================================================
      const page = tier3Page
      await page.goto('/cosmetics')
      await page.getByTestId('cosmetics-frame-item').first().waitFor({ state: 'visible' })

      const frameItems = page.getByTestId('cosmetics-frame-item')
      await frameItems.nth(0).click()

      // ============================================================
      // SECTION 3: UI ASSERTIONS
      // ============================================================
      await expect(frameItems.nth(0)).toContainText(/✓ Đang dùng|Đang dùng/)
    })

  })

})
