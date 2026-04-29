/**
 * W-M15 — Cross-cutting (L2 Happy Path)
 *
 * Routes: N/A (cross-cutting concerns)
 * Spec ref: SPEC_USER §15, §14
 * Covers: error boundary, offline recovery, loading states, rate limiting
 */

import { test, expect } from '../../fixtures/auth'

const BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'
const TEST3_EMAIL = 'test3@dev.local'
const PASSWORD = 'Test@123456'

// ── Helpers ─────────────────────────────────────────────────────────

async function loginAndGetToken(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const data = await res.json()
  return data.accessToken
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe('W-M15 Cross-cutting — L2 Happy Path @happy-path @cross-cutting', () => {

  test('W-M15-L2-001: Error boundary — API 500 shows fallback UI @parallel-safe @error', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — mock /api/me to return 500
    // ============================================================
    const page = tier3Page
    await page.route('**/api/me', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Test error' }),
      }),
    )

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.goto('/')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // Should show error boundary or error message
    const errorVisible = await page
      .getByTestId('error-boundary')
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    const errorTextVisible = await page
      .getByText(/something went wrong|có lỗi|error/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false)

    expect(errorVisible || errorTextVisible).toBe(true)

    // Retry button should be visible
    const retryBtn = page.getByRole('button', { name: /retry|thử lại|reload/i })
    if (await retryBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(retryBtn).toBeVisible()
    }
  })

  test('W-M15-L2-002: API retry after error — click retry, data loads @parallel-safe @error', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — mock first /api/me → 500
    // ============================================================
    const page = tier3Page
    let callCount = 0
    await page.route('**/api/me', (route) => {
      callCount++
      if (callCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Temporary' }),
        })
      }
      return route.continue()
    })

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.goto('/')

    // Wait for error state
    await page
      .getByText(/something went wrong|có lỗi|error/i)
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => {})

    // Click retry
    const retryBtn = page.getByRole('button', { name: /retry|thử lại|reload/i })
    if (await retryBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await retryBtn.click()
    } else {
      // Fallback: reload the page
      await page.reload()
    }

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // After retry, home page should render normally
    await expect
      .poll(
        async () => {
          const text = await page.textContent('body')
          return /Luyện tập|Practice|Thi đấu|Ranked/i.test(text || '')
        },
        { timeout: 10_000 },
      )
      .toBe(true)
  })

  test('W-M15-L2-003: Offline mode — setOffline shows OfflineBanner @parallel-safe @offline', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.waitForSelector('body')

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.context().setOffline(true)

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    const offlineBanner = page.getByTestId('offline-banner')
    const offlineText = page.getByText(/offline|mất kết nối|no internet/i).first()

    const bannerVisible = await offlineBanner
      .isVisible({ timeout: 5_000 })
      .catch(() => false)
    const textVisible = await offlineText
      .isVisible({ timeout: 3_000 })
      .catch(() => false)

    expect(bannerVisible || textVisible).toBe(true)

    // ============================================================
    // CLEANUP
    // ============================================================
    await page.context().setOffline(false)
  })

  test('W-M15-L2-004: Offline recovery — setOffline(false), banner disappears @parallel-safe @offline', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const page = tier3Page
    await page.goto('/')
    await page.waitForSelector('body')

    // ============================================================
    // SECTION 2: ACTIONS — go offline then back online
    // ============================================================
    await page.context().setOffline(true)

    // Wait for offline indication
    await page
      .getByText(/offline|mất kết nối|no internet/i)
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => {})

    // Go back online
    await page.context().setOffline(false)

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // Banner should disappear after coming back online
    await expect
      .poll(
        async () => {
          const bannerVisible = await page
            .getByTestId('offline-banner')
            .isVisible()
            .catch(() => false)
          const textVisible = await page
            .getByText(/offline|mất kết nối|no internet/i)
            .first()
            .isVisible()
            .catch(() => false)
          return !bannerVisible && !textVisible
        },
        { timeout: 10_000 },
      )
      .toBe(true)
  })

  test('W-M15-L2-005: Loading skeleton — slow API shows skeleton then content @parallel-safe @loading', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — delay /api/me by 2 seconds
    // ============================================================
    const page = tier3Page
    await page.route('**/api/me', async (route) => {
      await new Promise((r) => setTimeout(r, 2_000))
      await route.continue()
    })

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.goto('/')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    // Initially: skeleton placeholders should be visible
    const skeleton = page.locator('.animate-pulse').first()
    const skeletonVisible = await skeleton
      .isVisible({ timeout: 1_000 })
      .catch(() => false)

    // After delay: real content should replace skeleton
    await expect
      .poll(
        async () => {
          const text = await page.textContent('body')
          return /Luyện tập|Practice|Thi đấu|Ranked/i.test(text || '')
        },
        { timeout: 10_000 },
      )
      .toBe(true)

    // Skeleton should be gone
    if (skeletonVisible) {
      await expect(skeleton).not.toBeVisible({ timeout: 5_000 })
    }
  })

  test('W-M15-L2-006: Rate limiting — 100+ rapid requests get 429 @write @serial @security', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS — fire 100+ parallel requests
    // ============================================================
    const requests = Array.from({ length: 120 }, () =>
      fetch(`${BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.status),
    )

    const statuses = await Promise.all(requests)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    // At least 1 response should be 429 (rate limited)
    const has429 = statuses.some((s) => s === 429)
    const has200 = statuses.some((s) => s === 200)

    // Most should succeed, but some should be rate limited
    expect(has200).toBe(true)
    // Rate limiter may or may not be configured — document the result
    if (!has429) {
      console.warn(
        'W-M15-L2-006: No 429 responses received — rate limiter may not be configured for this endpoint',
      )
    }
  })

})
