import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerCrest, TierRibbon } from '../PlayerCrest'

describe('PlayerCrest', () => {
  it('shows the picture first, then pins the tier medallion', () => {
    const { container } = render(<PlayerCrest name="Anh Thư" avatarUrl="https://example.com/a.png" tierId={5} size={60} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/a.png')
    expect(imgs[1].getAttribute('src')).toBe('/images/lk/tier-5.webp')
    expect(imgs[1]).toHaveAttribute('title', 'Tiên Tri')
  })

  it('falls back to the initial on a portrait and clamps the tier', () => {
    const { container } = render(<PlayerCrest name="minh" tierId={9} size={44} />)
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/lk/tier-6.webp')
  })

  it('can hide the medallion for tiny avatars', () => {
    const { container } = render(<PlayerCrest name="Lan" tierId={2} size={32} showTier={false} />)
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('TierRibbon', () => {
  it('names the tier', () => {
    render(<TierRibbon tierId={3} />)
    expect(screen.getByText('Môn Đồ')).toBeInTheDocument()
  })
})

describe('PlayerCrest frame', () => {
  it('colours the rim with the equipped frame instead of the tier material', () => {
    const { container: a } = render(<PlayerCrest name="A" tierId={1} size={60} />)
    const { container: b } = render(<PlayerCrest name="A" tierId={1} frame={3} size={60} />)
    const rimA = (a.querySelector('span > span') as HTMLElement).style.background
    const rimB = (b.querySelector('span > span') as HTMLElement).style.background
    expect(rimA).not.toBe(rimB)
  })
})
