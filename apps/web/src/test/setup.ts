import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

// findBy*/waitFor default to 1 s; on a loaded full-suite run (171 files in parallel) pages that
// wait on a mocked query plus i18n can need longer, which showed up as random red tests.
configure({ asyncUtilTimeout: 3000 })

// Mock react-helmet-async globally so PageMeta works without HelmetProvider in tests
vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => children ?? null,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => children,
}))

// Initialize i18n for tests — use actual translations. Init is now async
// (resources load as chunks); await readiness so every test renders with both
// languages present. Node supports top-level await, so this is safe here even
// though the browser bundle cannot use it.
import i18n, { i18nReady } from '../i18n'

await i18nReady

// Ensure Vietnamese is active for tests
i18n.changeLanguage('vi')
