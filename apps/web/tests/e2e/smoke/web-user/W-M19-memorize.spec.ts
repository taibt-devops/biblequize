/**
 * W-M19 — Memorize mode "Học Thuộc" (L1 Smoke) — real backend, read-only.
 *
 * Routes: /practice (entry card), /practice/memorize, /practice/memorize/add
 * Spec ref: SPEC_USER §5.1.1
 */

import { test, expect } from '../../fixtures/auth'
import { MemorizePage } from '../../pages/MemorizePage'

test.describe('W-M19 Memorize — L1 Smoke @smoke @memorize', () => {

  test('W-M19-L1-001: Practice hien the Hoc Thuoc va dan toi danh sach @smoke @memorize', async ({
    tier1Page,
  }) => {
    // SECTION 1: SETUP — the entry card is gated on imported Bible text (HT-22); the
    // E2E DB has none, so report it available. Everything else hits the real backend.
    const page = tier1Page
    const memorize = new MemorizePage(page)
    await page.route('**/api/public/bible/status', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 'BTTHD2011', available: true }) }))

    // SECTION 2: ACTIONS
    await page.goto('/practice')
    await memorize.entryCard.waitFor({ state: 'visible' })
    await memorize.entryBtn.click()

    // SECTION 3: UI ASSERTIONS
    await expect(page).toHaveURL('/practice/memorize')
    await expect(memorize.listPage).toBeVisible()
  })

  test('W-M19-L1-002: Trang danh sach render empty state hoac danh sach + nut Them @smoke @memorize', async ({
    tier1Page,
  }) => {
    // SECTION 1: SETUP — none
    const page = tier1Page
    const memorize = new MemorizePage(page)

    // SECTION 2: ACTIONS
    await memorize.gotoList()
    await memorize.waitForLoaded()

    // SECTION 3: UI ASSERTIONS
    await expect(memorize.addBtn).toBeVisible()
    await expect(memorize.empty.or(memorize.items.first())).toBeVisible()
  })

  test('W-M19-L1-003: Trang chon cau render bo chon va nut Them bi khoa khi chua chon @smoke @memorize', async ({
    tier1Page,
  }) => {
    // SECTION 1: SETUP — none
    const page = tier1Page
    const memorize = new MemorizePage(page)

    // SECTION 2: ACTIONS
    await memorize.gotoAdd()

    // SECTION 3: UI ASSERTIONS
    await expect(memorize.bookSelect).toBeVisible()
    await expect(memorize.chapterSelect).toBeVisible()
    await expect(memorize.verseFromSelect).toBeVisible()
    await expect(memorize.verseToSelect).toBeVisible()
    await expect(memorize.submitBtn).toBeDisabled()
  })
})
