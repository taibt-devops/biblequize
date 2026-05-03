import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Phase A.1 — CreateRoom unit tests.
 * Min 8 tests per CLAUDE.md rule.
 */

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

let authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (s?: (st: any) => any) => s ? s(authState) : authState,
  useAuth: () => authState,
}))

const mockApiPost = vi.fn()
vi.mock('../../api/client', () => ({
  api: { post: (...args: any[]) => mockApiPost(...args) },
}))

import CreateRoom from '../CreateRoom'

function renderCreateRoom() {
  return render(<MemoryRouter><CreateRoom /></MemoryRouter>)
}

describe('CreateRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
  })

  // 1. Render
  it('renders form without crashing', () => {
    renderCreateRoom()
    expect(screen.getAllByText(/Tạo Phòng/).length).toBeGreaterThan(0)
  })

  // 2. All 4 game mode cards
  it('renders all 4 game mode cards', () => {
    renderCreateRoom()
    expect(screen.getByText('Đua tốc độ')).toBeInTheDocument()
    expect(screen.getByText('Sinh tồn')).toBeInTheDocument()
    expect(screen.getByText('Đội đấu đội')).toBeInTheDocument()
    expect(screen.getByText('Cái chết bất ngờ')).toBeInTheDocument()
  })

  // 3. Mode selection highlights active
  it('highlights selected game mode', () => {
    renderCreateRoom()
    const brBtn = screen.getByText('Sinh tồn').closest('button')!
    fireEvent.click(brBtn)
    expect(brBtn).toHaveAttribute('aria-pressed', 'true')
  })

  // 4. Segmented controls — question count
  it('updates question count when segmented button clicked', () => {
    renderCreateRoom()
    const btn20 = screen.getAllByText('20')[0] // question count 20
    fireEvent.click(btn20)
    expect(btn20.className).toContain('bg-[#f8bd45]')
  })

  // 5. Segmented controls — time per question
  it('updates time per question when clicked', () => {
    renderCreateRoom()
    const btn30 = screen.getByText('30s')
    fireEvent.click(btn30)
    expect(btn30.className).toContain('bg-[#f8bd45]')
  })

  // 6. Max players slider
  it('renders max players slider with range 2-20', () => {
    renderCreateRoom()
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider).toBeTruthy()
    expect(slider.min).toBe('2')
    expect(slider.max).toBe('20')
  })

  // 7. Visibility toggle
  it('toggles public/private visibility', () => {
    renderCreateRoom()
    expect(screen.getByText('Riêng tư')).toBeInTheDocument()
    // Toggle is a button with rounded-full class inside the visibility section
    const toggleBtns = document.querySelectorAll('button[type="button"]')
    const toggleBtn = Array.from(toggleBtns).find(b => b.className.includes('rounded-full') && b.className.includes('w-12'))
    expect(toggleBtn).toBeTruthy()
    fireEvent.click(toggleBtn!)
    expect(screen.getByText('Công khai')).toBeInTheDocument()
  })

  // 8. Submit success → navigate to lobby
  it('submits form and navigates to lobby on success', async () => {
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'room-123', roomCode: 'ABC123' } } })
    renderCreateRoom()
    const submitBtn = document.querySelector('button[type="submit"]')!
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
        mode: 'SPEED_RACE',
        questionCount: 10,
      }))
      expect(mockNavigate).toHaveBeenCalledWith('/room/room-123/lobby', expect.anything())
    })
  })

  // 9. Submit error → show error message
  it('shows error message on API failure', async () => {
    mockApiPost.mockRejectedValue({ response: { data: { message: 'Server error' } } })
    renderCreateRoom()
    fireEvent.click(document.querySelector('button[type="submit"]')!)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  // 10. Loading state
  it('shows loading spinner while submitting', async () => {
    mockApiPost.mockImplementation(() => new Promise(() => {})) // never resolves
    renderCreateRoom()
    fireEvent.click(document.querySelector('button[type="submit"]')!)

    await waitFor(() => {
      expect(screen.getByText('Đang tạo...')).toBeInTheDocument()
    })
  })

  // 11. Back button navigates to /multiplayer
  it('renders back link to /multiplayer', () => {
    renderCreateRoom()
    const backLink = screen.getByText('Quay lại').closest('a')
    expect(backLink).toHaveAttribute('href', '/multiplayer')
  })

  // 12. Auth redirect
  it('redirects to login when not authenticated', () => {
    authState = { isAuthenticated: false, isLoading: false, user: null }
    renderCreateRoom()
    expect(mockNavigate).toHaveBeenCalledWith('/login', expect.anything())
  })

  // 13. Difficulty segmented control
  it('updates difficulty when clicked', () => {
    renderCreateRoom()
    const hardBtn = screen.getByText('Khó')
    fireEvent.click(hardBtn)
    expect(hardBtn.className).toContain('bg-[#f8bd45]')
  })

  // 14. Room name input
  it('renders room name input with placeholder', () => {
    renderCreateRoom()
    const input = screen.getByPlaceholderText(/Phòng Kinh Thánh vui/i)
    expect(input).toBeInTheDocument()
  })

  // 15. Question source selector — default DATABASE, switch to CUSTOM
  it('switches question source to CUSTOM and sends it in submit', async () => {
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'r1', roomCode: 'ZZZ' } } })
    renderCreateRoom()

    const customBtn = screen.getByText('Tự tạo câu hỏi').closest('button')!
    fireEvent.click(customBtn)
    expect(customBtn).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
        questionSource: 'CUSTOM',
      }))
    })
  })
})
