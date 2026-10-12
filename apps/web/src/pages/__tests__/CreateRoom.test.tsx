import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Phase A.1 — CreateRoom unit tests.
 * Min 8 tests per CLAUDE.md rule.
 */

const mockNavigate = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  }
})

let authState = { isAuthenticated: true, isLoading: false, user: { name: 'Test', email: 'a@b.com' } }
vi.mock('../../store/authStore', () => ({
  useAuthStore: (s?: (st: any) => any) => s ? s(authState) : authState,
  useAuth: () => authState,
}))

const mockApiPost = vi.fn()
const mockApiGet = vi.fn().mockResolvedValue({ data: { sets: [], locked: [] } })
vi.mock('../../api/client', () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
    get: (...args: any[]) => mockApiGet(...args),
  },
}))

import CreateRoom from '../CreateRoom'

function renderCreateRoom() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><CreateRoom /></MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CreateRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
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
    // Active mode label appears in both the mode card AND the preview badge,
    // so use getAllByText for the default-active SPEED_RACE.
    expect(screen.getAllByText('Đua tốc độ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sinh tồn')).toBeInTheDocument()
    expect(screen.getByText('Đội đấu đội')).toBeInTheDocument()
    expect(screen.getByText('Đấu vương')).toBeInTheDocument()
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
    expect(btn20.className).toContain('bg-bq-action')
  })

  // 5. Segmented controls — time per question
  it('updates time per question when clicked', () => {
    renderCreateRoom()
    const btn30 = screen.getByText('30s')
    fireEvent.click(btn30)
    expect(btn30.className).toContain('bg-bq-action')
  })

  // 6. Max players slider
  it('renders max players slider with range 2-100', () => {
    renderCreateRoom()
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider).toBeTruthy()
    expect(slider.min).toBe('2')
    expect(slider.max).toBe('100')
  })

  // PCV-5: Đấu vương tối đa 12 người, Sinh tồn tối thiểu 3.
  it('slider follows the selected mode limits', () => {
    renderCreateRoom()
    fireEvent.click(screen.getByText('Đấu vương'))
    let slider = document.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider.min).toBe('3')
    expect(slider.max).toBe('12')
    expect(Number(slider.value)).toBeLessThanOrEqual(12)
    fireEvent.click(screen.getByText('Sinh tồn'))
    slider = document.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider.min).toBe('3')
    expect(slider.max).toBe('100')
  })

  // 7. Visibility toggle
  it('toggles public/private visibility', () => {
    renderCreateRoom()
    // Default is now PUBLIC
    expect(screen.getByText('Công khai')).toBeInTheDocument()
    const toggleBtns = document.querySelectorAll('button[type="button"]')
    const toggleBtn = Array.from(toggleBtns).find(b => b.className.includes('rounded-full') && b.className.includes('w-12'))
    expect(toggleBtn).toBeTruthy()
    fireEvent.click(toggleBtn!)
    expect(screen.getByText('Riêng tư')).toBeInTheDocument()
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
        questionCount: 15,
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
    expect(hardBtn.className).toContain('bg-bq-action')
  })

  // 14. Room name input
  it('renders room name input with placeholder', () => {
    renderCreateRoom()
    const input = screen.getByPlaceholderText(/Phòng Kinh Thánh vui/i)
    expect(input).toBeInTheDocument()
  })

  // 15. CUSTOM without set selected → submit disabled
  it('disables submit when CUSTOM source selected but no set chosen', async () => {
    renderCreateRoom()
    const customBtn = screen.getByText('Tự tạo câu hỏi').closest('button')!
    fireEvent.click(customBtn)
    expect(customBtn).toHaveAttribute('aria-pressed', 'true')

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn).toBeDisabled()
  })

  // 16. HPT-1: default payload keeps Quản trò (hostPlaysGame: false)
  it('defaults hostPlaysGame=false (Quản trò) in submit payload', async () => {
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'r1', roomCode: 'AAA111' } } })
    renderCreateRoom()
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
        hostPlaysGame: false,
      }))
    })
  })

  // 17. HPT-2: toggle on → payload sends hostPlaysGame: true + chip flips
  it('host-plays toggle on sends hostPlaysGame=true and updates hint chip', async () => {
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'r2', roomCode: 'BBB222' } } })
    renderCreateRoom()
    // PCV-9: hai lựa chọn rõ ràng thay cho công tắc — mặc định "Tôi dẫn chương trình".
    const organizer = screen.getByTestId('create-room-role-organizer')
    const player = screen.getByTestId('create-room-role-player')
    expect(organizer).toHaveAttribute('aria-checked', 'true')
    expect(player).toHaveAttribute('aria-checked', 'false')
    expect(organizer.textContent).toMatch(/Tôi dẫn chương trình/)
    expect(player.textContent).toMatch(/Tôi chơi cùng mọi người/)
    fireEvent.click(player)
    expect(player).toHaveAttribute('aria-checked', 'true')
    expect(organizer).toHaveAttribute('aria-checked', 'false')
    // top hint chip switches from organizer → host-plays copy
    expect(screen.getByTestId('create-room-organizer-hint').textContent).toMatch(/cũng chơi/i)

    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
        hostPlaysGame: true,
      }))
    })
  })
})

describe('CreateRoom — Hội ý (PCV-22)', () => {
  it('chọn Đội đấu đội thì có lựa chọn Hội ý, bật lên thì gửi teamConsensus', async () => {
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'r9', roomCode: 'TEAM99' } } })
    renderCreateRoom()
    expect(screen.queryByTestId('create-room-team-consensus')).toBeNull()
    fireEvent.click(screen.getByText('Đội đấu đội'))
    const toggle = screen.getByTestId('create-room-team-consensus')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
      mode: 'TEAM_VS_TEAM', teamConsensus: true,
    })))
  })
})

describe('CreateRoom — Ôn phần đọc hôm nay (PCV-24)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockApiGet.mockImplementation((url: string) => Promise.resolve({
      data: url === '/api/books'
        ? [{ id: 'gen', name: 'Genesis', nameVi: 'Sáng Thế Ký', testament: 'OT', orderIndex: 1 },
           { id: 'psa', name: 'Psalms', nameVi: 'Thi Thiên', testament: 'OT', orderIndex: 19 }]
        : { sets: [], locked: [] },
    }))
  })

  it('?passage= điền tên phòng, hiện phạm vi theo đoạn và gửi passageScope', async () => {
    mockSearchParams = new URLSearchParams('passage=Genesis:27-28,Psalms:7')
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'r5', roomCode: 'READ55' } } })
    renderCreateRoom()

    expect((screen.getByTestId('create-room-name-input') as HTMLInputElement).value).toBe('Ôn phần đọc hôm nay')
    await waitFor(() => expect(screen.getByTestId('create-room-passage').textContent).toMatch(/Sáng Thế Ký 27–28, Thi Thiên 7/))
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({
      roomName: 'Ôn phần đọc hôm nay',
      passageScope: [
        { book: 'Genesis', fromChapter: 27, toChapter: 28 },
        { book: 'Psalms', fromChapter: 7, toChapter: 7 },
      ],
    })))
  })

  it('bỏ phạm vi theo đoạn ⇒ quay lại chọn sách như thường, không gửi passageScope', async () => {
    mockSearchParams = new URLSearchParams('passage=Genesis:27-28')
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'r6', roomCode: 'READ66' } } })
    renderCreateRoom()

    fireEvent.click(screen.getByTestId('create-room-passage-clear'))
    expect(screen.queryByTestId('create-room-passage')).toBeNull()
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    expect(mockApiPost.mock.calls[0][1]).not.toHaveProperty('passageScope')
  })

  it('không có ?passage= thì như cũ (tên trống, chọn sách)', () => {
    renderCreateRoom()
    expect(screen.queryByTestId('create-room-passage')).toBeNull()
    expect((screen.getByTestId('create-room-name-input') as HTMLInputElement).value).toBe('')
  })
})
