import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPolicy from '../PrivacyPolicy'
import TermsOfService from '../TermsOfService'
import Help from '../Help'
import CauDoKinhThanh from '../CauDoKinhThanh'

/**
 * These public, crawlable pages must each set their own canonical via PageMeta
 * (prerender bakes this into the static HTML). react-helmet-async is mocked to
 * render inline; React 19 hoists the <link> into <head>.
 */
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')

describe('public pages set a per-page canonical', () => {
  it.each([
    ['/privacy', PrivacyPolicy],
    ['/terms', TermsOfService],
    ['/help', Help],
    ['/cau-do-kinh-thanh', CauDoKinhThanh],
  ])('%s emits its own canonical link', (path, Page) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Page />
      </MemoryRouter>,
    )
    expect(canonical()).toBe(`https://quiz.forbible.org${path}`)
  })
})

describe('Help page FAQPage structured data', () => {
  it('emits valid FAQPage JSON-LD matching the FAQ registry', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/help']}>
        <Help />
      </MemoryRouter>,
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const data = JSON.parse(script!.textContent!)
    expect(data['@type']).toBe('FAQPage')
    expect(Array.isArray(data.mainEntity)).toBe(true)
    expect(data.mainEntity.length).toBeGreaterThanOrEqual(10)
    expect(data.mainEntity[0]['@type']).toBe('Question')
    expect(data.mainEntity[0].name).toBeTruthy()
    expect(data.mainEntity[0].acceptedAnswer['@type']).toBe('Answer')
    expect(data.mainEntity[0].acceptedAnswer.text).toBeTruthy()
  })
})

describe('Pillar page /cau-do-kinh-thanh', () => {
  it('has a keyword h1, FAQPage schema and sets lang=vi', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/cau-do-kinh-thanh']}>
        <CauDoKinhThanh />
      </MemoryRouter>,
    )
    expect(container.querySelector('h1')?.textContent).toMatch(/Câu Đố Kinh Thánh|Trắc Nghiệm Kinh Thánh/i)
    const faq = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3)
    expect(document.documentElement.lang).toBe('vi')
  })
})
