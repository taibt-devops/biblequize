import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Cache-bust the non-hashed public assets linked from index.html (favicon,
 * apple-touch-icon, manifest). Browsers cache favicons aggressively and nginx
 * serves them with a 1-day max-age, so replacing the file alone does not reach
 * users. Appending `?v=<content hash>` changes the URL whenever the file
 * changes — no manual version bump, no user cache clear.
 */
export function versionHref(html: string, publicDir: string): string {
  return html.replace(
    /(<link\b[^>]*\bhref=")(\/[^"?#]+\.(?:svg|ico|png|json|webmanifest))(")/g,
    (match, pre: string, path: string, post: string) => {
      const file = join(publicDir, path)
      if (!existsSync(file)) return match
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8)
      return `${pre}${path}?v=${hash}${post}`
    },
  )
}

export default function assetVersion(): Plugin {
  let publicDir = ''
  return {
    name: 'bq-asset-version',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir
    },
    transformIndexHtml: (html) => versionHref(html, publicDir),
  }
}
