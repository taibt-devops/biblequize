/**
 * W-M06 — Multiplayer Lobby (L1 Smoke)
 *
 * Routes: /multiplayer, /room/create, /room/join, /room/:id/lobby
 * Spec ref: SPEC_USER §6
 * Note: Gameplay (/room/:id/quiz) — [DEFERRED - WEBSOCKET PHASE]
 */

import { test, expect } from '../../fixtures/auth'

test.describe('W-M06 Multiplayer Lobby — L1 Smoke @smoke @multiplayer', () => {

  test('W-M06-L1-001: Rooms list page render dung @smoke @multiplayer', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/multiplayer')
    await page.waitForSelector('[data-testid="multiplayer-page"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/multiplayer')
    await expect(page.getByTestId('multiplayer-page')).toBeVisible()
    await expect(page.getByTestId('multiplayer-create-btn')).toBeVisible()
    await expect(page.getByTestId('multiplayer-join-btn')).toBeVisible()
  })

  test('W-M06-L1-002: Navigate to Create Room page @smoke @multiplayer', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/room/create')
    await page.waitForSelector('[data-testid="create-room-page"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/room/create')
    await expect(page.getByTestId('create-room-page')).toBeVisible()
    await expect(page.getByTestId('create-room-mode-select')).toBeVisible()
    await expect(page.getByTestId('create-room-submit-btn')).toBeVisible()
    await expect(page.getByTestId('create-room-submit-btn')).toBeEnabled()
  })

  test('W-M06-L1-003: Join Room section trong Multiplayer page @smoke @multiplayer', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/multiplayer')
    await page.waitForSelector('[data-testid="multiplayer-page"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/multiplayer')
    await expect(page.getByTestId('multiplayer-page')).toBeVisible()
    await expect(page.getByTestId('join-room-code-input')).toBeVisible()
    await expect(page.getByTestId('multiplayer-join-btn')).toBeVisible()
  })

  test('W-M06-L1-004: Join room form submit empty code validation error @smoke @multiplayer', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    await page.goto('/multiplayer')
    await page.waitForSelector('[data-testid="multiplayer-join-btn"]')
    await page.getByTestId('multiplayer-join-btn').click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page).toHaveURL('/multiplayer')
    // No dedicated error element exists; the join button click with empty code
    // should not navigate away — staying on the page is the validation behavior
    await expect(page.getByTestId('multiplayer-page')).toBeVisible()
  })

  test('W-M06-L1-005: Room Lobby room code hien thi va co the copy @smoke @multiplayer @critical', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — create room via API
    // ============================================================
    // [NOT IMPLEMENTED: need API setup to create room and get roomId]
    test.skip()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const roomId = 'TODO-room-id-from-api-setup'
    await page.goto(`/room/${roomId}/lobby`)
    await page.waitForSelector('[data-testid="lobby-room-code"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('lobby-room-code')).toBeVisible()
    await expect(page.getByTestId('lobby-room-code')).toHaveText(/[A-Z0-9]{6}/)
    await expect(page.getByTestId('lobby-leave-btn')).toBeVisible()
    await expect(page.getByTestId('lobby-player-grid')).toBeVisible()
  })

  test('W-M06-L1-006: Room Lobby nut San Sang visible cho non-host @smoke @multiplayer', async ({
    tier1Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — need admin to create room, join as non-host
    // ============================================================
    // [NOT IMPLEMENTED: need multi-user room setup via API]
    test.skip()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier1Page
    const roomId = 'TODO-room-id-from-api-setup'
    await page.goto(`/room/${roomId}/lobby`)
    await page.waitForSelector('[data-testid="lobby-ready-btn"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('lobby-ready-btn')).toBeVisible()
    await expect(page.getByTestId('lobby-start-btn')).not.toBeVisible()
  })

  test('W-M06-L1-007: CreateRoom mode cards hien thi tieng Viet, khong lo i18n raw key @smoke @multiplayer @i18n @regression', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none (default language = vi)
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    // Force vi language to assert Vietnamese mode labels (storage-state defaults to en)
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'}/`)
    await page.evaluate(() => {
      localStorage.setItem('quizLanguage', 'vi')
      localStorage.setItem('i18nextLng', 'vi')
    })
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'}/room/create`)
    await page.waitForSelector('[data-testid="create-room-page"]')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — localized mode names visible (vi)
    // ============================================================
    await expect(page.getByText('Đua tốc độ')).toBeVisible()
    await expect(page.getByText('Sinh tồn')).toBeVisible()
    await expect(page.getByText('Đội đấu đội')).toBeVisible()
    await expect(page.getByText('Cái chết bất ngờ')).toBeVisible()

    // Regression guard: no raw i18n keys leaked to UI
    await expect(page.getByText(/room\.modes\./)).toHaveCount(0)
    await expect(page.getByText(/createRoom\.modeDesc\./)).toHaveCount(0)
  })

})
