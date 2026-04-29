/**
 * Playwright global teardown — runs once after all tests.
 *
 * Deletes seeded test data via DELETE /api/admin/seed/test-data.
 */

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8080'

async function globalTeardown(): Promise<void> {
  if (process.env.PLAYWRIGHT_KEEP_TEST_DATA === '1' || process.env.PLAYWRIGHT_BASE_URL) {
    console.log('[global-teardown] Keeping test data (remote run / explicit opt-in)')
    return
  }

  // Login admin to get bearer token
  const loginRes = await fetch(`${API_BASE}/api/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@biblequiz.test',
      password: 'Test@123456',
    }),
  })

  if (!loginRes.ok) {
    console.warn(
      `[global-teardown] Admin login failed: ${loginRes.status} — skipping cleanup`,
    )
    return
  }

  const { accessToken } = (await loginRes.json()) as { accessToken: string }

  const deleteRes = await fetch(`${API_BASE}/api/admin/seed/test-data`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!deleteRes.ok) {
    console.warn(
      `[global-teardown] Seed cleanup returned ${deleteRes.status}`,
    )
  }
}

export default globalTeardown
