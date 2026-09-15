import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import MemorizeEntryCard from '../MemorizeEntryCard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGet = vi.fn()
vi.mock('../../../api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) } }))

beforeEach(() => vi.clearAllMocks())

describe('MemorizeEntryCard', () => {
  it('opens the memorize list and shows the due badge for signed-in users', async () => {
    mockGet.mockResolvedValue({ data: { dueCount: 3 } })
    renderWithProviders(<MemorizeEntryCard isAuthenticated />)
    expect(await screen.findByText('3 câu cần ôn')).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith('/api/me/memory-verses/due-count')
    fireEvent.click(screen.getByTestId('memorize-entry-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/practice/memorize')
  })

  it('hides the badge when nothing is due', async () => {
    mockGet.mockResolvedValue({ data: { dueCount: 0 } })
    renderWithProviders(<MemorizeEntryCard isAuthenticated />)
    await vi.waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/câu cần ôn/)).not.toBeInTheDocument()
  })

  it('sends guests to login without calling the API', () => {
    renderWithProviders(<MemorizeEntryCard isAuthenticated={false} />)
    expect(screen.getByText('Đăng nhập để lưu câu gốc và ôn mỗi ngày.')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('memorize-entry-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
    expect(mockGet).not.toHaveBeenCalled()
  })
})
