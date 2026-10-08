/**
 * W-M06 — Multiplayer Lobby (L1 Smoke)
 *
 * Routes: /multiplayer, /room/create, /room/join, /room/:id/lobby
 * Spec ref: SPEC_USER §6
 * Note: Gameplay (/room/:id/quiz) — [DEFERRED - WEBSOCKET PHASE]
 */

import { test, expect } from '../../fixtures/auth'

test.describe('W-M06 Multiplayer Lobby — L1 Smoke @smoke @multiplayer', () => {

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

  test('W-M06-L1-008: Lobby share button opens invite modal (Copy/Link/QR) @smoke @multiplayer @lobby-redesign', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — create room via API
    // ============================================================
    // Requires logged-in API helper to create a fresh room and get roomId.
    // Skipped until shared room-fixture is available; selectors documented below.
    test.skip()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const roomId = 'TODO-room-id-from-api-setup'
    await page.goto(`/room/${roomId}/lobby`)
    await page.waitForSelector('[data-testid="lobby-share-btn"]')
    await page.getByTestId('lobby-share-btn').click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByRole('dialog', { name: /Mời bạn bè/i })).toBeVisible()
    await expect(page.getByText(/Copy mã/i)).toBeVisible()
    await expect(page.getByText(/Copy link/i)).toBeVisible()
    // QR is rendered as an SVG inside the modal.
    await expect(page.getByRole('dialog').locator('svg')).toBeVisible()
  })

  test('W-M06-L1-009: Invite slot click opens share modal @smoke @multiplayer @lobby-redesign', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — create room via API
    // ============================================================
    test.skip()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const roomId = 'TODO-room-id-from-api-setup'
    await page.goto(`/room/${roomId}/lobby`)
    await page.waitForSelector('[data-testid="lobby-invite-slot"]')
    await page.getByTestId('lobby-invite-slot').click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByRole('dialog', { name: /Mời bạn bè/i })).toBeVisible()
  })

  test('W-M06-L1-010: Chat FAB toggles chat panel when alone in lobby @smoke @multiplayer @lobby-redesign', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — create room via API
    // ============================================================
    test.skip()

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const roomId = 'TODO-room-id-from-api-setup'
    await page.goto(`/room/${roomId}/lobby`)
    await page.waitForSelector('[data-testid="lobby-chat-fab"]')

    // FAB visible when host alone, panel hidden by default.
    await expect(page.getByTestId('lobby-chat-fab')).toBeVisible()
    await expect(page.getByTestId('lobby-chat-panel')).toHaveCount(0)

    // Click FAB → panel opens, FAB hides.
    await page.getByTestId('lobby-chat-fab').click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await expect(page.getByTestId('lobby-chat-panel')).toBeVisible()
    await expect(page.getByTestId('lobby-chat-fab')).toHaveCount(0)
  })

})
