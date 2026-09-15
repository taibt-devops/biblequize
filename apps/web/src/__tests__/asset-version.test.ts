import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { versionHref } from '../../vite-plugins/assetVersion'

const PUBLIC = join(__dirname, '..', '..', 'public')

describe('versionHref (favicon cache-busting)', () => {
  it('appends a content hash to public icon/manifest links', () => {
    const out = versionHref(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />' +
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />' +
        '<link rel="manifest" href="/manifest.json" />',
      PUBLIC,
    )
    expect(out).toMatch(/href="\/favicon\.svg\?v=[0-9a-f]{8}"/)
    expect(out).toMatch(/href="\/apple-touch-icon\.png\?v=[0-9a-f]{8}"/)
    expect(out).toMatch(/href="\/manifest\.json\?v=[0-9a-f]{8}"/)
  })

  it('is deterministic for the same file content', () => {
    const html = '<link rel="icon" href="/favicon.ico" />'
    expect(versionHref(html, PUBLIC)).toBe(versionHref(html, PUBLIC))
  })

  it('leaves missing files, external URLs and already-versioned links untouched', () => {
    const html =
      '<link rel="icon" href="/missing.svg" />' +
      '<link rel="preconnect" href="https://fonts.googleapis.com" />' +
      '<link rel="icon" href="/favicon.svg?v=abc" />'
    expect(versionHref(html, PUBLIC)).toBe(html)
  })
})
