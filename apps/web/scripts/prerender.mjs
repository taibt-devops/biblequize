/**
 * Build-time prerender of public, crawlable routes.
 *
 * Social crawlers (Facebook/Zalo/Twitter/LinkedIn) don't run JS, so a pure CSR
 * SPA serves them an empty shell. This boots each public route in headless
 * Chromium after `vite build` and writes dist/<route>/index.html, which nginx
 * serves via `try_files $uri $uri/ /index.html`.
 *
 * Chromium is NOT bundled (puppeteer's download is skipped); point at one via
 * PRERENDER_CHROMIUM — apk's /usr/bin/chromium-browser in Docker, Playwright's
 * chrome locally. If unset, prerender is skipped (build still ships the SPA).
 *
 * Resilient: a route that fails is logged and skipped; the script always exits 0
 * so a prerender hiccup never breaks the build/deploy.
 */
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile, readFile } from 'node:fs/promises'

import PrerendererPkg from '@prerenderer/prerenderer'
import PuppeteerRendererPkg from '@prerenderer/renderer-puppeteer'
import { staticDefaults, dedupeHead } from './seo-dedupe.mjs'

const Prerenderer = PrerendererPkg.default ?? PrerendererPkg
const PuppeteerRenderer = PuppeteerRendererPkg.default ?? PuppeteerRendererPkg

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '..', 'dist')
const ORIGIN = 'https://forbible.org'

// Deterministic, static-content public pages + their canonical path. `/` renders
// the guest crossroads (GuestHome; checkAuth short-circuits without a session) and
// is written to home.html, served by nginx for exactly `/` so the SPA shell stays
// clean for fallback. Excluded: `/daily` (data-gated — without a backend it
// prerenders to a "no questions" empty state). /landing now just redirects to /;
// the long-form introduction it used to show lives at /gioi-thieu.
const ROUTES = [
  { path: '/', canonical: '/', out: 'home.html' },
  { path: '/gioi-thieu', canonical: '/gioi-thieu' },
  { path: '/privacy', canonical: '/privacy' },
  { path: '/terms', canonical: '/terms' },
  { path: '/help', canonical: '/help' },
  { path: '/cau-do-kinh-thanh', canonical: '/cau-do-kinh-thanh' },
]

async function main() {
  const executablePath = process.env.PRERENDER_CHROMIUM
  if (!executablePath) {
    console.warn('[prerender] PRERENDER_CHROMIUM not set — skipping (SPA still shipped)')
    return
  }

  const defaults = staticDefaults(await readFile(join(distDir, 'index.html'), 'utf-8'))

  const prerenderer = new Prerenderer({
    staticDir: distDir,
    renderer: new PuppeteerRenderer({
      renderAfterTime: 6000, // let the entry + lazy route chunk boot, render, flush head
      launchOptions: {
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    }),
  })
  await prerenderer.initialize()

  let ok = 0
  for (const { path: route, canonical, out } of ROUTES) {
    try {
      const [rendered] = await prerenderer.renderRoutes([route])
      const html = (rendered?.html || '').trim()
      if (!html.includes('<div id="root">') || /<div id="root">\s*<\/div>/.test(html)) {
        throw new Error('empty #root — app did not render')
      }
      const finalHtml = dedupeHead(html, defaults, `${ORIGIN}${canonical}`)
      // `out` writes a named file (home.html for `/`) so the SPA shell stays clean;
      // other routes write dist/<route>/index.html, served at the clean URL by nginx.
      const outPath = out ? join(distDir, out) : join(distDir, route, 'index.html')
      await mkdir(dirname(outPath), { recursive: true })
      await writeFile(outPath, finalHtml)
      ok++
      console.log(`[prerender] OK ${route} -> ${out || `${route}/index.html`} (${Math.round(finalHtml.length / 1024)} KB)`)
    } catch (err) {
      console.warn(`[prerender] FAIL ${route}: ${err.message}`)
    }
  }

  await prerenderer.destroy()
  console.log(`[prerender] ${ok}/${ROUTES.length} routes prerendered -> dist/`)
}

main()
  .catch((err) => console.warn('[prerender] skipped (non-fatal):', err.message))
  .finally(() => process.exit(0))
