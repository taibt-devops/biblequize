import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards static SEO surfaces shipped from apps/web: index.html <head>, robots.txt,
 * sitemap.xml, manifest.json. These are invisible to component tests (the SPA is
 * client-rendered) yet are exactly what crawlers read, so assert them directly.
 * vitest runs with cwd = apps/web.
 */
const readRoot = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf-8')
const indexHtml = () => readRoot('index.html')

describe('SEO: index.html language/locale correctness', () => {
  // Strip HTML comments — crawlers ignore them, and so should these assertions.
  const html = indexHtml().replace(/<!--[\s\S]*?-->/g, '')

  it('declares no Greek (el) locale — the app is vi + en only (C4)', () => {
    expect(html).not.toMatch(/hreflang="el"/)
    expect(html).not.toContain('el_GR')
    expect(html).not.toContain('forbible.org/el')
    expect(html).not.toMatch(/"inLanguage":\s*\[\s*"vi",\s*"el"\s*\]/)
  })

  it('declares English as the alternate locale', () => {
    expect(html).toContain('content="en_US"')
    expect(html).toMatch(/"inLanguage":\s*\[\s*"vi",\s*"en"\s*\]/)
  })

  it('does not emit a static <link rel="canonical"> (set per-page via PageMeta)', () => {
    // A site-wide static canonical would conflict with the per-page Helmet tag.
    expect(html).not.toMatch(/<link[^>]*rel="canonical"/)
  })

  it('og/twitter images point to the raster .png, not .svg', () => {
    expect(html).toContain('property="og:image" content="https://forbible.org/og-image.png"')
    expect(html).toContain('name="twitter:image" content="https://forbible.org/og-image.png"')
    expect(html).not.toContain('og-image.svg')
  })
})

describe('SEO: sitemap.xml + robots.txt', () => {
  const sitemap = readRoot('public/sitemap.xml')
  const robots = readRoot('public/robots.txt')
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const disallows = robots
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.toLowerCase().startsWith('disallow:'))
    .map((l) => l.slice('disallow:'.length).trim())
    .filter(Boolean)

  it('lists the core public pages, all under forbible.org', () => {
    expect(locs.length).toBeGreaterThanOrEqual(4)
    for (const loc of locs) expect(loc).toMatch(/^https:\/\/forbible\.org\//)
  })

  it('does not advertise the /landing duplicate of /', () => {
    expect(locs).not.toContain('https://forbible.org/landing')
  })

  it('every <url> carries a <lastmod>', () => {
    const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1])
    expect(blocks.length).toBe(locs.length)
    for (const block of blocks) expect(block).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)
  })

  it('no sitemap URL is blocked by a robots Disallow rule', () => {
    for (const loc of locs) {
      const path = loc.replace('https://forbible.org', '') || '/'
      const blocked = disallows.find((d) => path.startsWith(d))
      expect(blocked, `${path} blocked by Disallow: ${blocked}`).toBeUndefined()
    }
  })

  it('robots points at the sitemap and drops the phantom /share/ allow', () => {
    expect(robots).toMatch(/Sitemap:\s*https:\/\/forbible\.org\/sitemap\.xml/)
    expect(robots).not.toContain('/share/')
    expect(robots).toContain('Disallow: /admin/')
  })
})

describe('SEO: manifest.json (PWA installability)', () => {
  const manifest = JSON.parse(readRoot('public/manifest.json'))

  it('declares the required install metadata', () => {
    expect(manifest.id).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.theme_color).toBe('#EFE3C3')
    expect(manifest.background_color).toBe('#EFE3C3')
    expect(Array.isArray(manifest.categories)).toBe(true)
  })

  it('ships 192px and 512px PNG icons', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    for (const icon of manifest.icons) expect(icon.type).toBe('image/png')
  })
})

describe('SEO: JSON-LD structured data', () => {
  const blocks = [
    ...indexHtml().matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => m[1])

  it('every ld+json block is valid JSON', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    for (const b of blocks) expect(() => JSON.parse(b)).not.toThrow()
  })

  it('declares SoftwareApplication, Organization and WebSite', () => {
    const types = new Set<string>()
    for (const b of blocks) {
      const data = JSON.parse(b)
      for (const node of data['@graph'] ?? [data]) {
        if (node['@type']) types.add(node['@type'])
      }
    }
    expect(types).toContain('SoftwareApplication')
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
  })
})
