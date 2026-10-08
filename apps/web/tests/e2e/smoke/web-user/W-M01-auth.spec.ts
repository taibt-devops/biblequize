/**
 * W-M01 — Auth & Onboarding (L1 Smoke)
 *
 * Routes: /login, /onboarding, /onboarding/try, /auth/callback
 * Spec ref: SPEC_USER S2, S14.3
 */

import { test, expect } from '@playwright/test'
import { test as authTest, expect as authExpect } from '../../fixtures/auth'
import { LoginPage } from '../../pages/LoginPage'

// ────────────────────────────────────────────────────────────────
// W-M01 Auth & Onboarding — L1 Smoke
// ────────────────────────────────────────────────────────────────

test.describe('W-M01 Auth & Onboarding — L1 Smoke', () => {
  // ── W-M01-L1-001 ── guest ─────────────────────────────────
  test('W-M01-L1-001: Trang Login render dung cho guest @smoke @auth @critical', async ({
    page,
  }) => {
    // ── Actions ──
    await page.goto('/login')
    await page.waitForSelector('[data-testid="login-email-input"]')

    // ── UI Assertions ──
    await expect(page).toHaveURL('/login')
    await expect(page.getByTestId('login-email-input')).toBeVisible()
    await expect(page.getByTestId('login-password-input')).toBeVisible()
    await expect(page.getByTestId('login-submit-btn')).toBeVisible()
    await expect(page.getByTestId('login-google-btn')).toBeVisible()
    await expect(page.getByTestId('login-guest-link')).toBeVisible()
  })

  // ── W-M01-L1-002 ── fresh login ──────────────────────────
  test('W-M01-L1-002: Dang nhap email/password hop le thanh cong @smoke @auth @critical', async ({
    page,
  }) => {
    // ── Setup ──
    const loginPage = new LoginPage(page)

    // ── Actions ──
    await loginPage.goto()
    await loginPage.loginWithCredentials('test3@dev.local', 'Test@123456')
    await page.waitForURL('/')

    // ── UI Assertions ──
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('home-page')).toBeVisible()

    // ── API Verification ──
    const userName = await page.evaluate(() => localStorage.getItem('userName'))
    expect(userName).toBeTruthy()
  })

  // ── W-M01-L1-003 ── guest ────────────────────────────────
  test('W-M01-L1-003: Dang nhap voi credentials sai hien error @smoke @auth @critical', async ({
    page,
  }) => {
    // ── Setup ──
    const loginPage = new LoginPage(page)

    // ── Actions ──
    await loginPage.goto()
    await loginPage.loginWithCredentials('wrong@email.com', 'WrongPassword1')
    await page.waitForSelector('[data-testid="login-error-msg"]')

    // ── UI Assertions ──
    await expect(page).toHaveURL('/login')
    await expect(page.getByTestId('login-error-msg')).toBeVisible()
    await expect(page.getByTestId('login-submit-btn')).toBeEnabled()
  })

  // ── W-M01-L1-004 ── guest ────────────────────────────────
  test('W-M01-L1-004: Submit form login voi email trong HTML5 validation ngan submit @smoke @auth', async ({
    page,
  }) => {
    // ── Actions ──
    await page.goto('/login')
    await page.getByTestId('login-password-input').fill('SomePassword1')
    await page.getByTestId('login-submit-btn').click()

    // ── UI Assertions ──
    await expect(page).toHaveURL('/login')
    await expect(page.getByTestId('login-error-msg')).not.toBeVisible()
  })
})

// ── Tests requiring storageState=tier3 ──────────────────────
authTest.describe('W-M01 Auth & Onboarding — L1 Smoke (authenticated)', () => {
  // ── W-M01-L1-005 ── storageState=tier3 ───────────────────
  authTest(
    'W-M01-L1-005: User da dang nhap truy cap /login redirect ve / @smoke @auth',
    async ({ tier3Page }) => {
      // ── Actions ──
      await tier3Page.goto('/login')

      // ── UI Assertions ──
      await authExpect(tier3Page).toHaveURL('/')
      await authExpect(tier3Page.getByTestId('home-page')).toBeVisible()
    },
  )

})

// ── Guest tests: onboarding ─────────────────────────────────
test.describe('W-M01 Auth & Onboarding — L1 Smoke (onboarding)', () => {
  // ── W-M01-L1-006 ── guest ────────────────────────────────
  test('W-M01-L1-006: Guest click Play as Guest vao app khong can dang nhap @smoke @auth', async ({
    page,
  }) => {
    // ── Actions ──
    await page.goto('/login')
    await page.getByTestId('login-guest-link').click()
    await page.waitForURL('/')

    // ── UI Assertions ──
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('landing-page')).toBeVisible()
  })

  // ── W-M01-L1-007 ── guest ────────────────────────────────
  test('W-M01-L1-007: Onboarding chon ngon ngu va xem slides @smoke @onboarding', async ({
    page,
  }) => {
    // ── Actions ──
    await page.goto('/onboarding')
    await page.getByTestId('onboarding-lang-vi').click()
    await page.getByTestId('onboarding-next-btn').click()
    await page.getByTestId('onboarding-next-btn').click()
    await page.getByTestId('onboarding-start-btn').click()

    // ── UI Assertions ──
    await expect(page).toHaveURL('/onboarding/try')
    await expect(page.getByTestId('try-quiz-question')).toBeVisible()
  })

  // ── W-M01-L1-008 ── guest ────────────────────────────────
  test('W-M01-L1-008: Onboarding try quiz tra loi 3 cau thay ket qua @smoke @onboarding', async ({
    page,
  }) => {
    // ── Actions ──
    await page.goto('/onboarding/try')
    await page.waitForSelector('[data-testid="try-quiz-question"]')

    // OnboardingTryQuiz auto-advances after 800ms — no "next" button
    for (let i = 0; i < 3; i++) {
      await page.getByTestId(`try-quiz-option-${i}`).click()
      // Wait for auto-advance: either next question or results screen
      if (i < 2) {
        // Wait for next question to render (auto-advance after 800ms)
        await expect(page.getByTestId('try-quiz-question')).toBeVisible({ timeout: 2000 })
      }
    }

    // Wait for results screen
    await expect(page.getByTestId('try-quiz-results')).toBeVisible({ timeout: 2000 })

    // ── UI Assertions ──
    await expect(page.getByTestId('try-quiz-results')).toBeVisible()
    await expect(page.getByTestId('try-quiz-score')).toHaveText(/[0-3]\/3/)
    await expect(page.getByTestId('try-quiz-register-btn')).toBeVisible()
  })
})
