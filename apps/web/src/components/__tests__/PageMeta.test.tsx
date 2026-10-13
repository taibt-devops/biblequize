import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PageMeta from '../PageMeta'

/**
 * react-helmet-async is globally mocked in src/test/setup.ts to render its
 * children inline. React 19 then hoists <title>/<meta>/<link> into <head>
 * (React <=18 left them in the container), so look in both to stay
 * version-robust.
 */
const find = (c: HTMLElement, sel: string) =>
  c.querySelector(sel) ?? document.head.querySelector(sel)
const content = (c: HTMLElement, sel: string) => find(c, sel)?.getAttribute('content')

describe('PageMeta', () => {
  it('emits the full OG + Twitter card set, canonical and og:url', () => {
    const { container } = render(
      <PageMeta title="Thử Thách" description="Mô tả trang" canonicalPath="/daily" />,
    )
    expect(find(container, 'title')?.textContent).toBe('Thử Thách — BibleQuiz')

    expect(content(container, 'meta[property="og:type"]')).toBe('website')
    expect(content(container, 'meta[property="og:title"]')).toBe('Thử Thách — BibleQuiz')
    expect(content(container, 'meta[property="og:description"]')).toBe('Mô tả trang')
    expect(content(container, 'meta[property="og:url"]')).toBe('https://quiz.forbible.org/daily')
    expect(content(container, 'meta[property="og:image"]')).toBe('https://quiz.forbible.org/og-image.png')

    expect(content(container, 'meta[name="twitter:card"]')).toBe('summary_large_image')
    expect(content(container, 'meta[name="twitter:title"]')).toBe('Thử Thách — BibleQuiz')
    expect(content(container, 'meta[name="twitter:description"]')).toBe('Mô tả trang')
    expect(content(container, 'meta[name="twitter:image"]')).toBe('https://quiz.forbible.org/og-image.png')

    expect(find(container, 'link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://quiz.forbible.org/daily',
    )
  })

  it('honours an ogImage override and omits canonical/og:url when no path', () => {
    const { container } = render(
      <PageMeta title="X" ogImage="https://forbible.org/custom.png" />,
    )
    expect(content(container, 'meta[property="og:image"]')).toBe('https://forbible.org/custom.png')
    expect(content(container, 'meta[name="twitter:image"]')).toBe('https://forbible.org/custom.png')
    expect(find(container, 'link[rel="canonical"]')).toBeNull()
    expect(find(container, 'meta[property="og:url"]')).toBeNull()
  })

  it('emits robots noindex when the noindex prop is set', () => {
    const { container } = render(<PageMeta title="X" noindex />)
    expect(content(container, 'meta[name="robots"]')).toBe('noindex, follow')
  })

  it('omits robots meta by default', () => {
    const { container } = render(<PageMeta title="Y" />)
    expect(find(container, 'meta[name="robots"]')).toBeNull()
  })
})
