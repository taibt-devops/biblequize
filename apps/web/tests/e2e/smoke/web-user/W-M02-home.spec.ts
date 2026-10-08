/**
 * W-M02 — Home & Profile (L1 Smoke)
 *
 * Routes: /, /profile
 * Spec ref: SPEC_USER S13
 */

import { test as authTest, expect as authExpect } from '../../fixtures/auth'
import { expect } from '@playwright/test'
import { HomePage } from '../../pages/HomePage'

// ────────────────────────────────────────────────────────────────
// W-M02 Home & Profile — L1 Smoke
// ────────────────────────────────────────────────────────────────

authTest.describe('W-M02 Home & Profile — L1 Smoke', () => {

  // ── W-M02-L1-007 ── storageState=tier3 ───────────────────
  authTest(
    'W-M02-L1-007: Profile page render dung @smoke @profile',
    async ({ tier3Page }) => {
      // ── Actions ──
      await tier3Page.goto('/profile')
      await tier3Page.waitForSelector('[data-testid="profile-page"]')

      // ── UI Assertions ──
      await authExpect(tier3Page).toHaveURL('/profile')
      await authExpect(
        tier3Page.getByTestId('profile-name'),
      ).toBeVisible()
      await authExpect(
        tier3Page.getByTestId('profile-tier-badge'),
      ).toBeVisible()
      await authExpect(
        tier3Page.getByTestId('profile-tier-progress'),
      ).toBeVisible()
      await authExpect(
        tier3Page.getByTestId('profile-stats-points'),
      ).toBeVisible()
      await authExpect(
        tier3Page.getByTestId('profile-stats-streak'),
      ).toBeVisible()
    },
  )

  // ── W-M02-L1-008 ── storageState=tier3 ───────────────────
  authTest(
    'W-M02-L1-008: Profile Achievement badges section visible @smoke @profile',
    async ({ tier3Page }) => {
      // ── Actions ──
      await tier3Page.goto('/profile')
      await tier3Page.waitForSelector('[data-testid="profile-badges-section"]')

      // ── UI Assertions ──
      await authExpect(
        tier3Page.getByTestId('profile-badges-section'),
      ).toBeVisible()
      await authExpect(tier3Page.getByTestId('profile-heatmap')).toBeVisible()
    },
  )

  // ── W-M02-L1-009 ── fresh login as test3@dev.local ───────
  authTest(
    'W-M02-L1-009: Profile Delete account modal mo/dong @smoke @profile @write',
    async ({ page }) => {
      // ── Setup — fresh login ──
      await page.goto('/login')
      await page.getByTestId('login-email-input').fill('test3@dev.local')
      await page.getByTestId('login-password-input').fill('Test@123456')
      await page.getByTestId('login-submit-btn').click()
      await page.waitForURL('/')

      // ── Actions ──
      await page.goto('/profile')
      await page.waitForSelector('[data-testid="profile-page"]')
      await page.getByTestId('profile-delete-account-btn').click()
      await page.waitForSelector('[data-testid="delete-account-modal"]')

      // ── UI Assertions — modal open ──
      await expect(page.getByTestId('delete-account-modal')).toBeVisible()
      await expect(
        page.getByTestId('profile-delete-confirm-input'),
      ).toBeVisible()

      // ── Actions — close modal ──
      await page.getByTestId('delete-account-cancel-btn').click()

      // ── UI Assertions — modal closed ──
      await expect(
        page.getByTestId('delete-account-modal'),
      ).not.toBeVisible()
    },
  )
})
