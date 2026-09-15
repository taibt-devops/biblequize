import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import MemorizeEntryCard from '../MemorizeEntryCard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGet = vi.fn()
vi.mock('../../../api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) } }))

function mockApi({ available = true, dueCount = 0 }: { available?: boolean | 'error'; dueCount?: number } = {}) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/api/public/bible/status') {
      return available === 'error'
        ? Promise.reject(new Error('down'))
        : Promise.resolve({ data: { version: 'BTTHD2011', available } })
    }
    if (url === '/api/me/memory-verses/due-count') return Promise.resolve({ data: { dueCount } })
    return Promise.reject(new Error(url))
  })
}

beforeEach(() => vi.clearAllMocks())

describe('MemorizeEntryCard', () => {
  it('opens the memorize list and shows the due badge for signed-in users', async () => {
    mockApi({ dueCount: 3 })
    renderWithProviders(<MemorizeEntryCard isAuthenticated />)
    expect(await screen.findByText('3 câu cần ôn')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('memorize-entry-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/practice/memorize')
  })

  it('hides the badge when nothing is due', async () => {
    mockApi({ dueCount: 0 })
    renderWithProviders(<MemorizeEntryCard isAuthenticated />)
    await screen.findByTestId('memorize-entry-card')
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/me/memory-verses/due-count'))
    expect(screen.queryByText(/câu cần ôn/)).not.toBeInTheDocument()
  })

  it('sends guests to login without calling the user API', async () => {
    mockApi()
    renderWithProviders(<MemorizeEntryCard isAuthenticated={false} />)
    expect(await screen.findByText('Đăng nhập để lưu câu gốc và ôn mỗi ngày.')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('memorize-entry-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
    expect(mockGet).not.toHaveBeenCalledWith('/api/me/memory-verses/due-count')
  })

  it('stays hidden until Bible text is imported (gate)', async () => {
    mockApi({ available: false, dueCount: 2 })
    renderWithProviders(<MemorizeEntryCard isAuthenticated />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/bible/status'))
    expect(screen.queryByTestId('memorize-entry-card')).not.toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalledWith('/api/me/memory-verses/due-count')
  })

  it('stays hidden when the status check fails', async () => {
    mockApi({ available: 'error' })
    renderWithProviders(<MemorizeEntryCard isAuthenticated />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/bible/status'))
    expect(screen.queryByTestId('memorize-entry-card')).not.toBeInTheDocument()
  })
})
