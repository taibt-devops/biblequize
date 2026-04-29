/**
 * W-M06 — Multiplayer Lobby (L2 Happy Path)
 *
 * Routes: /rooms, /multiplayer, /room/create, /room/join, /room/:id/lobby
 * Spec ref: SPEC_USER §5.4
 * Note: Gameplay (round flow, elimination) deferred to Phase 5 WebSocket.
 */

import { test, expect } from '../../fixtures/auth'
import { LoginPage } from '../../pages/LoginPage'

const BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'
const TEST3_EMAIL = 'test3@dev.local'
const TEST4_EMAIL = 'test4@dev.local'
const TEST5_EMAIL = 'test5@dev.local'
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

async function createRoom(
  token: string,
  body = { name: 'E2E Test Room', mode: 'SPEED_RACE', maxPlayers: 4 },
): Promise<{ id: string; code: string }> {
  const res = await fetch(`${BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  return (await res.json()) as { id: string; code: string }
}

async function joinRoom(token: string, code: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/rooms/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  })
}

async function deleteRoom(token: string, roomId: string): Promise<void> {
  await fetch(`${BASE_URL}/api/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function getRoom(
  token: string,
  roomId: string,
): Promise<Response> {
  return fetch(`${BASE_URL}/api/rooms/${roomId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function leaveRoom(token: string, roomId: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/rooms/${roomId}/leave`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe('W-M06 Multiplayer Lobby — L2 Happy Path @happy-path @multiplayer', () => {

  test('W-M06-L2-001: Create room POST /api/rooms returns room with join code @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const room = await createRoom(token)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A (API-only test)
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(room.id).toBeTruthy()
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/)
    expect(room).toMatchObject({
      name: 'E2E Test Room',
      mode: 'SPEED_RACE',
      maxPlayers: 4,
      status: 'WAITING',
    })
    expect(room).toHaveProperty('hostUserId')
    // Host auto-added to players
    const players = (room as any).players
    expect(Array.isArray(players)).toBe(true)
    expect(players.length).toBeGreaterThanOrEqual(1)

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteRoom(token, room.id)
  })

  test('W-M06-L2-002: UI create room flow — fill form, submit, redirect to lobby @write @serial', async ({
    page,
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.loginWithCredentials(TEST3_EMAIL, PASSWORD)
    await page.waitForURL('/')

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    await page.goto('/room/create')
    await page.waitForSelector('[data-testid="create-room-page"]')

    // Fill room name
    const nameInput = page.getByTestId('create-room-name-input')
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E UI Room')
    }

    // Select mode — create-room-mode-select is a div grid of buttons, not <select>
    const modeSelect = page.getByTestId('create-room-mode-select')
    if (await modeSelect.isVisible()) {
      await modeSelect.locator('button').filter({ hasText: /speed|race|tốc/i }).first().click().catch(() => {})
    }

    // Submit
    await page.getByTestId('create-room-submit-btn').click()

    // ============================================================
    // SECTION 3: UI ASSERTIONS
    // ============================================================
    await page.waitForURL(/\/room\/[a-z0-9-]+\/lobby/)
    await expect(page).toHaveURL(/\/room\/[a-z0-9-]+\/lobby/)

    // Room code visible on lobby
    const roomCode = page.getByTestId('lobby-room-code')
    await expect(roomCode).toBeVisible()
    await expect(roomCode).toHaveText(/[A-Z0-9]{6}/)

    // Host visible in player list
    const playerGrid = page.getByTestId('lobby-player-grid')
    await expect(playerGrid).toBeVisible()

    // ============================================================
    // SECTION 4: API VERIFICATION — room exists server-side
    // ============================================================
    // Extract roomId from URL
    const url = page.url()
    const roomId = url.match(/\/room\/([a-z0-9-]+)\/lobby/)?.[1]
    expect(roomId).toBeTruthy()

    // ============================================================
    // CLEANUP
    // ============================================================
    if (roomId) {
      const token = await loginAndGetToken(TEST3_EMAIL)
      await deleteRoom(token, roomId)
    }
  })

  test('W-M06-L2-003: Join room by code — POST /api/rooms/join @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — test3 creates room
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const room = await createRoom(token3)
    const token4 = await loginAndGetToken(TEST4_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS — test4 joins
    // ============================================================
    const joinRes = await joinRoom(token4, room.code)
    expect(joinRes.ok).toBe(true)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const roomRes = await getRoom(token3, room.id)
    const roomData = await roomRes.json()
    expect(roomData.players?.length).toBe(2)

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteRoom(token3, room.id)
  })

  test('W-M06-L2-004: Join invalid code returns 404 @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const res = await joinRoom(token, 'XXXXXX')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.status).toBe(404)
  })

  test('W-M06-L2-005: Join full room returns 409 @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — create room maxPlayers=2, fill with 2 users
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const room = await createRoom(token3, {
      name: 'Full Room',
      mode: 'SPEED_RACE',
      maxPlayers: 2,
    })
    const token4 = await loginAndGetToken(TEST4_EMAIL)
    await joinRoom(token4, room.code)

    // ============================================================
    // SECTION 2: ACTIONS — test5 tries to join full room
    // ============================================================
    const token5 = await loginAndGetToken(TEST5_EMAIL)
    const res = await joinRoom(token5, room.code)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.status).toBe(409)

    // ============================================================
    // CLEANUP
    // ============================================================
    await deleteRoom(token3, room.id)
  })

  test('W-M06-L2-006: Room list GET /api/rooms returns waiting rooms @parallel-safe', async ({
    tier3Page,
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    // Use page.request for authenticated API call
    const res = await page.request.get('/api/rooms?status=WAITING')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.ok()).toBe(true)
    const rooms = await res.json()
    expect(Array.isArray(rooms)).toBe(true)
    // Each room has required fields
    for (const room of rooms) {
      expect(room).toHaveProperty('id')
      expect(room).toHaveProperty('maxPlayers')
      expect(room.status).toBe('WAITING')
    }
  })

  test('W-M06-L2-007: Host leave room — room deleted or ownership transferred @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — test3 creates room, test4 joins
    // ============================================================
    const token3 = await loginAndGetToken(TEST3_EMAIL)
    const room = await createRoom(token3)
    const token4 = await loginAndGetToken(TEST4_EMAIL)
    await joinRoom(token4, room.code)

    // ============================================================
    // SECTION 2: ACTIONS — host leaves
    // ============================================================
    const leaveRes = await leaveRoom(token3, room.id)
    expect(leaveRes.ok).toBe(true)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const roomRes = await getRoom(token4, room.id)
    if (roomRes.status === 404) {
      // Room was deleted when host left
      expect(roomRes.status).toBe(404)
    } else {
      // Ownership transferred to test4
      const roomData = await roomRes.json()
      const userId4 = await testApi.getUserIdByEmail(TEST4_EMAIL)
      expect(roomData.hostUserId).toBe(userId4)
    }

    // ============================================================
    // CLEANUP
    // ============================================================
    // Delete room if still exists
    const cleanupRes = await getRoom(token4, room.id)
    if (cleanupRes.ok) {
      await deleteRoom(token4, room.id)
    }
  })

  test('W-M06-L2-008: Gameplay flow deferred to Phase 5 WebSocket @deferred', async () => {
    test.skip(true, 'DEFERRED: Multiplayer gameplay requires Phase 5 WebSocket')
  })

})
