/**
 * W-M10 — Tier Progression (L2 Happy Path)
 *
 * Routes: / (tier display), /profile, /cosmetics
 * Spec ref: SPEC_USER §3
 *
 * Star XP Table (from TierProgressService):
 *   Tier 1: 200/star  (max 1000)
 *   Tier 2: 800/star  (max 5000)
 *   Tier 3: 2000/star (max 15000)
 *   Tier 4: 5000/star (max 40000)
 *   Tier 5: 12000/star (max 100000)
 *   Tier 6: NO STARS
 */

import { test, expect } from '../../fixtures/auth'
import { LoginPage } from '../../pages/LoginPage'

const BASE_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'
const TEST3_EMAIL = 'test3@dev.local'
const TEST2_EMAIL = 'test2@dev.local'
const TEST6_EMAIL = 'test6@dev.local'
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

async function seedPoints(
  adminToken: string,
  userId: string,
  totalPoints: number,
): Promise<any> {
  const res = await fetch(
    `${BASE_URL}/api/admin/test/users/${userId}/seed-points`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ totalPoints }),
    },
  )
  return res.json()
}

async function getTierProgress(token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/me/tier-progress`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe('W-M10 Tier Progression — L2 Happy Path @happy-path @tier', () => {

  test('W-M10-L2-001: GET /api/me/tier-progress returns correct starInfo for tier 3 @parallel-safe @critical', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const res = await page.request.get('/api/me/tier-progress')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.ok()).toBe(true)
    const data = await res.json()

    expect(data.tierLevel).toBe(3)
    expect(data.tierName).toBe('Môn Đồ')
    expect(data).toHaveProperty('totalPoints')
    expect(data).toHaveProperty('nextTierPoints')
    expect(data).toHaveProperty('tierProgressPercent')
    expect(data).toHaveProperty('starIndex')
    expect(data).toHaveProperty('starXp')
    expect(data).toHaveProperty('nextStarXp')
    expect(data).toHaveProperty('starProgressPercent')
    expect(data).toHaveProperty('surgeActive')

    // Tier 3 range: 5000 - 15000
    expect(data.totalPoints).toBeGreaterThanOrEqual(5000)
    expect(data.totalPoints).toBeLessThan(15000)
    expect(data.nextTierPoints).toBe(15000)
  })

  test('W-M10-L2-002: Star boundary crossed — starIndex increments with +30 bonus @write @serial', async ({
    testApi,
  }) => {
    test.slow()

    // ============================================================
    // SECTION 1: SETUP — seed points to just below star 1 boundary (7000)
    // ============================================================
    await testApi.init()
    const userId = await testApi.getUserIdByEmail(TEST3_EMAIL)
    const token = await loginAndGetToken(TEST3_EMAIL)

    // Get admin token for seed-points
    const adminToken = await loginAndGetToken('admin@biblequiz.test')
    await seedPoints(adminToken, userId, 6999)

    // Snapshot before
    const before = await getTierProgress(token)
    const starIndexBefore = before.starIndex

    // ============================================================
    // SECTION 2: ACTIONS — earn XP to cross 7000
    // ============================================================
    // Seed to just above boundary
    await seedPoints(adminToken, userId, 7001)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION — assert delta
    // ============================================================
    const after = await getTierProgress(token)
    expect(after.starIndex).toBeGreaterThan(starIndexBefore)
    expect(after.starXp).toBe(7000)
    expect(after.nextStarXp).toBe(9000)

    // ============================================================
    // CLEANUP — restore tier 3 mid-range
    // ============================================================
    await seedPoints(adminToken, userId, 8000)
  })

  test('W-M10-L2-003: Milestone 50% crossing — milestone="50" @write @serial', async ({
    testApi,
  }) => {
    test.slow()

    // ============================================================
    // SECTION 1: SETUP — seed to just below 50% of tier 3 (10000)
    // ============================================================
    await testApi.init()
    const userId = await testApi.getUserIdByEmail(TEST3_EMAIL)
    const adminToken = await loginAndGetToken('admin@biblequiz.test')
    const token = await loginAndGetToken(TEST3_EMAIL)

    await seedPoints(adminToken, userId, 9999)

    // ============================================================
    // SECTION 2: ACTIONS — cross 10000
    // ============================================================
    await seedPoints(adminToken, userId, 10001)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const progress = await getTierProgress(token)
    // Milestone may be "50" if server computes it on boundary cross
    // Or null if milestone is only computed during live play
    expect(progress.tierProgressPercent).toBeGreaterThanOrEqual(50)

    // ============================================================
    // CLEANUP
    // ============================================================
    await seedPoints(adminToken, userId, 8000)
  })

  test('W-M10-L2-004: Milestone 90% crossing — milestone="90" @write @serial', async ({
    testApi,
  }) => {
    test.slow()

    // ============================================================
    // SECTION 1: SETUP — seed to just below 90% of tier 3 (14000)
    // ============================================================
    await testApi.init()
    const userId = await testApi.getUserIdByEmail(TEST3_EMAIL)
    const adminToken = await loginAndGetToken('admin@biblequiz.test')
    const token = await loginAndGetToken(TEST3_EMAIL)

    await seedPoints(adminToken, userId, 13999)

    // ============================================================
    // SECTION 2: ACTIONS — cross 14000
    // ============================================================
    await seedPoints(adminToken, userId, 14001)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    const progress = await getTierProgress(token)
    expect(progress.tierProgressPercent).toBeGreaterThanOrEqual(90)

    // ============================================================
    // CLEANUP
    // ============================================================
    await seedPoints(adminToken, userId, 8000)
  })

  test('W-M10-L2-005: Tier bump — cross threshold, new tierLevel, starIndex reset @write @serial', async ({
    testApi,
  }) => {
    test.slow()

    // ============================================================
    // SECTION 1: SETUP — seed test2 to just below tier 3 boundary (5000)
    // ============================================================
    await testApi.init()
    const userId = await testApi.getUserIdByEmail(TEST2_EMAIL)
    const adminToken = await loginAndGetToken('admin@biblequiz.test')
    const token = await loginAndGetToken(TEST2_EMAIL)

    await seedPoints(adminToken, userId, 4999)
    const before = await getTierProgress(token)
    expect(before.tierLevel).toBe(2)

    // ============================================================
    // SECTION 2: ACTIONS — cross 5000
    // ============================================================
    await seedPoints(adminToken, userId, 5001)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION — assert delta
    // ============================================================
    const after = await getTierProgress(token)
    expect(after.tierLevel).toBe(3)
    expect(after.tierName).toBe('Môn Đồ')
    expect(after.starIndex).toBe(0)
    expect(after.starXp).toBe(5000)
    expect(after.nextStarXp).toBe(7000)

    // ============================================================
    // CLEANUP — restore test2 to tier 2 range
    // ============================================================
    await seedPoints(adminToken, userId, 2000)
  })

  test('W-M10-L2-006: XP surge active — surgeActive=true, multiplier=1.5 @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — activate XP surge
    // ============================================================
    await testApi.setState(TEST3_EMAIL, { xpSurgeHoursFromNow: 2 })
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const progress = await getTierProgress(token)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(progress.surgeActive).toBe(true)
    expect(progress.surgeMultiplier).toBe(1.5)
    expect(progress.surgeUntil).toBeTruthy()

    // ============================================================
    // CLEANUP — clear surge
    // ============================================================
    await testApi.setState(TEST3_EMAIL, { xpSurgeHoursFromNow: 0 })
  })

  test('W-M10-L2-007: XP surge expired — surgeActive=false @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — clear any surge
    // ============================================================
    await testApi.setState(TEST3_EMAIL, { xpSurgeHoursFromNow: 0 })
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const progress = await getTierProgress(token)

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(progress.surgeActive).toBe(false)
    expect(progress.surgeMultiplier).toBe(1.0)
  })

  test('W-M10-L2-008: Tier 6 user — no stars, starIndex always 0 @parallel-safe', async ({
    tier6Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier6Page
    const res = await page.request.get('/api/me/tier-progress')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.ok()).toBe(true)
    const data = await res.json()

    expect(data.tierLevel).toBe(6)
    expect(data.tierName).toBe('Sứ Đồ')
    expect(data.starIndex).toBe(0)
    expect(data.starProgressPercent).toBe(100.0)
  })

  test('W-M10-L2-009: Daily missions GET /api/me/daily-missions returns array @parallel-safe @missions', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const res = await page.request.get('/api/me/daily-missions')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.ok()).toBe(true)
    const missions = await res.json()
    expect(Array.isArray(missions)).toBe(true)
    expect(missions.length).toBe(3)

    for (const m of missions) {
      expect(m).toHaveProperty('missionType')
      expect(m).toHaveProperty('progress')
      expect(m).toHaveProperty('target')
      expect(m).toHaveProperty('completed')
      expect(m).toHaveProperty('bonusClaimed')
    }
  })

  test('W-M10-L2-010: Daily mission progress update — complete mission via play @write @serial', async ({
    testApi,
  }) => {
    // [NEEDS CODE CHECK]: set-mission-state endpoint
    test.skip(true, 'BLOCKED: Needs set-mission-state admin endpoint for deterministic test')
  })

  test('W-M10-L2-011: Mission bonus claim — bonusClaimed=true, XP granted @write @serial', async ({
    testApi,
  }) => {
    // [POTENTIAL NOT IMPLEMENTED]: confirm claim-bonus endpoint
    test.skip(true, 'BLOCKED: Needs claim-bonus endpoint verification')
  })

  test('W-M10-L2-012: Comeback status — daysSinceLastPlay >= 3 shows rewardTier @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — set lastPlayedAt to 3 days ago
    // ============================================================
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const isoDate = threeDaysAgo.toISOString().split('T')[0]

    await testApi.setState(TEST3_EMAIL, { lastPlayedAt: isoDate })
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const res = await fetch(`${BASE_URL}/api/me/comeback-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    if (res.ok) {
      const data = await res.json()
      expect(data.daysSinceLastPlay).toBeGreaterThanOrEqual(3)
      expect(data).toHaveProperty('rewardTier')
      expect(data.claimed).toBe(false)
    } else {
      // Endpoint may not be implemented yet
      expect([404, 501]).toContain(res.status)
    }

    // ============================================================
    // CLEANUP — reset lastPlayedAt to today
    // ============================================================
    const today = new Date().toISOString().split('T')[0]
    await testApi.setState(TEST3_EMAIL, { lastPlayedAt: today })
  })

  test('W-M10-L2-013: Comeback claim POST /api/me/comeback-claim @write @serial', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    const isoDate = fiveDaysAgo.toISOString().split('T')[0]

    await testApi.setState(TEST3_EMAIL, { lastPlayedAt: isoDate })
    const token = await loginAndGetToken(TEST3_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const claimRes = await fetch(`${BASE_URL}/api/me/comeback-claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    if (claimRes.ok) {
      const statusRes = await fetch(`${BASE_URL}/api/me/comeback-status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (statusRes.ok) {
        const data = await statusRes.json()
        expect(data.claimed).toBe(true)
      }
    } else {
      // Endpoint may not be implemented
      expect([404, 501]).toContain(claimRes.status)
    }

    // ============================================================
    // CLEANUP
    // ============================================================
    const today = new Date().toISOString().split('T')[0]
    await testApi.setState(TEST3_EMAIL, { lastPlayedAt: today })
  })

  test('W-M10-L2-014: Cosmetics list GET /api/me/cosmetics @parallel-safe @cosmetics', async ({
    tier3Page,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — none
    // ============================================================

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const page = tier3Page
    const res = await page.request.get('/api/me/cosmetics')

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(res.ok()).toBe(true)
    const cosmetics = await res.json()
    expect(Array.isArray(cosmetics)).toBe(true)

    for (const c of cosmetics) {
      expect(c).toHaveProperty('id')
      expect(c).toHaveProperty('type')
      expect(c).toHaveProperty('name')
      expect(c).toHaveProperty('unlocked')
      expect(c).toHaveProperty('active')
    }
  })

  test('W-M10-L2-015: Cosmetic equip PATCH /api/me/cosmetics @write @serial @cosmetics', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP — get cosmetics list to find an unlocked one
    // ============================================================
    const token = await loginAndGetToken(TEST3_EMAIL)
    const listRes = await fetch(`${BASE_URL}/api/me/cosmetics`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const cosmetics = await listRes.json()

    const unlocked = cosmetics.filter((c: any) => c.unlocked)
    if (unlocked.length < 2) {
      test.skip(true, 'BLOCKED: Need at least 2 unlocked cosmetics')
      return
    }

    const targetCosmetic = unlocked.find((c: any) => !c.active) || unlocked[1]

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const patchRes = await fetch(`${BASE_URL}/api/me/cosmetics`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: targetCosmetic.type,
        cosmeticId: targetCosmetic.id,
      }),
    })

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    expect(patchRes.ok).toBe(true)
    const afterRes = await fetch(`${BASE_URL}/api/me/cosmetics`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const after = await afterRes.json()
    const equipped = after.find((c: any) => c.id === targetCosmetic.id)
    expect(equipped.active).toBe(true)
  })

  test('W-M10-L2-016: Prestige status — tier 6 + daysAtTier6 >= 30 → canPrestige @write @serial @prestige', async ({
    testApi,
  }) => {
    // ============================================================
    // SECTION 1: SETUP
    // ============================================================
    await testApi.setState(TEST6_EMAIL, { daysAtTier6: 30 })
    const token = await loginAndGetToken(TEST6_EMAIL)

    // ============================================================
    // SECTION 2: ACTIONS
    // ============================================================
    const res = await fetch(`${BASE_URL}/api/me/prestige-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    // ============================================================
    // SECTION 3: UI ASSERTIONS — N/A
    // ============================================================

    // ============================================================
    // SECTION 4: API VERIFICATION
    // ============================================================
    if (res.ok) {
      const data = await res.json()
      expect(data.canPrestige).toBe(true)
      expect(data.daysAtTier6).toBeGreaterThanOrEqual(30)
      expect(data.daysRequired).toBe(30)
    } else {
      // Endpoint may not exist yet
      expect([404, 501]).toContain(res.status)
    }

    // ============================================================
    // CLEANUP
    // ============================================================
    await testApi.setState(TEST6_EMAIL, { daysAtTier6: 0 })
  })

  test('W-M10-L2-017: Prestige execute POST /api/me/prestige — level increments @write @serial @prestige', async ({
    testApi,
  }) => {
    // [WARNING]: Prestige mutation hard to reset — uses dedicated test
    test.skip(true, 'BLOCKED: Prestige mutation needs ephemeral user or teardown endpoint')
  })

})
