import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import MemoryDueCard from '../MemoryDueCard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGet = vi.fn()
vi.mock('../../../api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) } }))

beforeEach(() => vi.clearAllMocks())

describe('MemoryDueCard', () => {
  it('shows the due count and opens the review session', async () => {
    mockGet.mockResolvedValue({ data: { dueCount: 2 } })
    renderWithProviders(<MemoryDueCard enabled />)
    const card = await screen.findByTestId('home-memory-due-card')
    expect(card).toHaveTextContent('Hôm nay có 2 câu gốc cần ôn')
    fireEvent.click(screen.getByTestId('home-memory-due-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/practice/memorize/session')
  })

  it('renders nothing when nothing is due', async () => {
    mockGet.mockResolvedValue({ data: { dueCount: 0 } })
    renderWithProviders(<MemoryDueCard enabled />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByTestId('home-memory-due-card')).not.toBeInTheDocument()
  })

  it('stays silent on error and does not fetch when disabled', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    const { unmount } = renderWithProviders(<MemoryDueCard enabled />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByTestId('home-memory-due-card')).not.toBeInTheDocument()
    unmount()

    mockGet.mockClear()
    renderWithProviders(<MemoryDueCard enabled={false} />)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
