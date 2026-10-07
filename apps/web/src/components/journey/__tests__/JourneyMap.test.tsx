import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import JourneyMap, { type RegionProgress } from '../JourneyMap'
import { JOURNEY_REGIONS, type JourneyRegionId } from '../../../data/journeyRegions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}))

const progress = Object.fromEntries(
  JOURNEY_REGIONS.map(r => [r.id, { done: r.id === 'pentateuch' ? 1 : 0, total: r.to - r.from + 1 }]),
) as Record<JourneyRegionId, RegionProgress>

describe('JourneyMap', () => {
  it('renders one sign per land with its book count', () => {
    render(<JourneyMap progress={progress} currentRegion="pentateuch" onSelectRegion={() => {}} />)
    expect(screen.getByTestId('journey-map')).toBeInTheDocument()
    for (const r of JOURNEY_REGIONS) {
      expect(screen.getByTestId(`journey-region-${r.id}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('journey-region-pentateuch')).toHaveTextContent('1/5')
    expect(screen.getByTestId('journey-region-epistles')).toHaveTextContent('0/21')
  })

  it('marks only the current land', () => {
    render(<JourneyMap progress={progress} currentRegion="history" onSelectRegion={() => {}} />)
    expect(screen.getByTestId('journey-region-history')).toHaveAttribute('data-current', 'true')
    expect(screen.getByTestId('journey-region-pentateuch')).not.toHaveAttribute('data-current')
  })

  it('reports the land that was clicked', () => {
    const onSelect = vi.fn()
    render(<JourneyMap progress={progress} currentRegion={null} onSelectRegion={onSelect} />)
    fireEvent.click(screen.getByTestId('journey-region-gospels'))
    expect(onSelect).toHaveBeenCalledWith('gospels')
  })
})
