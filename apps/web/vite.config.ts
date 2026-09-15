import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import assetVersion from './vite-plugins/assetVersion'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  // PWA is a WEB-only concern. The Capacitor (native) build ships its assets
  // inside the app package, so a service worker there would only add a stale
  // caching layer in the WebView — skip it entirely for `--mode capacitor`.
  const isCapacitor = mode === 'capacitor'

  const securityHeaders = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }

  return {
    plugins: [
      react(),
      // `?v=<hash>` on favicon/manifest links so icon changes reach users.
      assetVersion(),
      // Installable PWA + offline precache. Web build only (see isCapacitor).
      ...(isCapacitor
        ? []
        : [
            VitePWA({
              // Ship updates without a user prompt: the new SW takes over on the
              // next navigation (skipWaiting + clientsClaim under the hood).
              registerType: 'autoUpdate',
              // External /registerSW.js (not an inline script) so the hardened
              // prod CSP `script-src 'self'` keeps holding — no 'unsafe-inline'.
              injectRegister: 'script-defer',
              // Keep the hand-authored public/manifest.json (already linked in
              // index.html) as the single source of truth — don't generate one.
              manifest: false,
              workbox: {
                // No HTML in the precache: a precached index.html is served by the
                // OLD worker on the first visit after a deploy (stale UI/favicon
                // until a second reload). Pages go network-first instead, falling
                // back to the last cached copy only when offline / network stalls.
                globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
                // Must be explicit: the plugin defaults this to 'index.html', whose
                // NavigationRoute would shadow the network-first route below.
                navigateFallback: null,
                runtimeCaching: [
                  {
                    urlPattern: ({ request, url }) =>
                      request.mode === 'navigate' && !/^\/(api|oauth2)\//.test(url.pathname),
                    handler: 'NetworkFirst',
                    options: {
                      cacheName: 'bq-pages',
                      networkTimeoutSeconds: 4,
                      expiration: { maxEntries: 30 },
                    },
                  },
                ],
                cleanupOutdatedCaches: true,
                // A couple of vendor chunks exceed the 2 MiB default.
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
              },
              // No service worker in `vite dev` — avoids stale-cache surprises
              // during development; the SW only ships in build/preview/prod.
              devOptions: { enabled: false },
            }),
          ]),
    ],
    server: {
      port: 5173,
      host: true,
      headers: {
        ...securityHeaders,
        // Dev server needs unsafe-inline for Vite HMR inline scripts
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:* ws://localhost:*;",
      },
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true
        }
      }
    },
    preview: {
      headers: {
        ...securityHeaders,
        // script-src needs no 'unsafe-inline': fonts swap via /load-fonts.js
        // (external), and JSON-LD <script type="application/ld+json"> is data,
        // not executed. This mirrors the hardened prod target (see CSP-2 task).
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:* ws://localhost:*;",
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      },
    },
    define: {
      global: 'globalThis',
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '0.1.0'),
      __DEBUG__: JSON.stringify(env.VITE_DEBUG === 'true'),
    },
    resolve: {
      alias: {
        global: 'globalThis',
      }
    },
    envPrefix: 'VITE_',
    // Strip console.log in production (keep console.error/warn)
    esbuild: {
      pure: mode === 'production' ? ['console.log'] : [],
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          // Split shared deps out of the entry monolith so it parses faster and
          // each group caches independently (a code change won't bust the React
          // runtime or the translation bundles). Lazy route chunks are emitted
          // automatically by the React.lazy() imports in main.tsx.
          manualChunks(id) {
            // NB: translation JSON is intentionally NOT bucketed here — each
            // locale is a dynamic import() in src/i18n, so Rollup emits one
            // chunk per language and only the active one loads on first paint.
            if (id.includes('node_modules')) {
              if (id.includes('react-router')) return 'router'
              if (/[\\/]react(-dom)?[\\/]|[\\/]scheduler[\\/]/.test(id)) return 'react-vendor'
              if (id.includes('@tanstack')) return 'query'
              if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n-vendor'
              // Realtime libs are only imported by lazy multiplayer/room pages,
              // so this chunk loads on demand with them — never on first paint.
              if (id.includes('@stomp') || id.includes('sockjs')) return 'realtime'
              return 'vendor'
            }
          }
        }
      }
    }
  }
})

