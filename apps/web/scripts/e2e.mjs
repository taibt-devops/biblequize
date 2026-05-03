#!/usr/bin/env node
// Cross-platform Playwright runner that sets E2E_ENV before spawning.
// Usage: node scripts/e2e.mjs <env> [extra playwright args...]
//   node scripts/e2e.mjs local
//   node scripts/e2e.mjs dev --grep @smoke
//   node scripts/e2e.mjs prod --headed --debug
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , envName, ...rest] = process.argv

if (!envName) {
  console.error('Usage: node scripts/e2e.mjs <env> [playwright args...]')
  console.error('Example: node scripts/e2e.mjs dev --grep @smoke')
  process.exit(1)
}

process.env.E2E_ENV = envName

// Resolve apps/web as cwd so Playwright always writes report/test-results
// relative to the web package, regardless of where the user invoked npm from.
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const args = ['playwright', 'test', '--config', 'playwright.config.ts', ...rest]
const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
  cwd: webDir,
})

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('Failed to spawn playwright:', err)
  process.exit(1)
})
