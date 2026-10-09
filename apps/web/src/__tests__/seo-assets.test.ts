import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards the social-share image referenced by index.html (og:image / twitter:image)
 * and manifest icons. Social crawlers (Facebook/Zalo/Twitter/LinkedIn) do NOT render
 * SVG, so a raster og-image.png MUST exist at the canonical 1200×630 dimensions.
 * Regenerate the icons via `node scripts/gen-favicons.mjs`.
 */
// vitest runs with cwd = apps/web
const publicPath = (name: string) => resolve(process.cwd(), 'public', name)

/** Read PNG width/height from the IHDR chunk (bytes 16-23, big-endian). */
function pngSize(buf: Buffer) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(buf.subarray(0, 8).equals(sig)).toBe(true) // valid PNG signature
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

describe('SEO: social-share assets', () => {
  it('og-image.png exists and is a valid 1200×630 PNG', () => {
    const p = publicPath('og-image.png')
    expect(existsSync(p)).toBe(true)
    const { width, height } = pngSize(readFileSync(p))
    expect(width).toBe(1200)
    expect(height).toBe(630)
  })

  it('PWA chrome icons exist as valid PNGs at their declared sizes', () => {
    for (const [name, size] of [
      ['android-chrome-192x192.png', 192],
      ['android-chrome-512x512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const) {
      const buf = readFileSync(publicPath(name))
      const { width, height } = pngSize(buf)
      expect(width).toBe(size)
      expect(height).toBe(size)
    }
  })
})
