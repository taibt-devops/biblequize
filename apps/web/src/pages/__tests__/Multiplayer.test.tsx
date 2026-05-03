import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}))

vi.mock('../../store/authStore', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true })),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { success: true, rooms: [] } }),
  },
}))

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Multiplayer />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

let Multiplayer: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../Multiplayer')
  Multiplayer = mod.default
})

describe('Multiplayer page', () => {
  it('renders page container', async () => {
    renderPage()
    expect(await screen.findByTestId('multiplayer-page')).toBeTruthy()
  })

  it('renders create room button', async () => {
    renderPage()
    expect(await screen.findByTestId('multiplayer-create-btn')).toBeTruthy()
  })

  it('navigates to /room/create on create button click', async () => {
    renderPage()
    const btn = await screen.findByTestId('multiplayer-create-btn')
    await userEvent.click(btn)
    expect(mockNavigate).toHaveBeenCalledWith('/room/create')
  })

  it('renders 6 code input digits', async () => {
    renderPage()
    for (let i = 0; i < 6; i++) {
      expect(await screen.findByTestId(`code-digit-${i}`)).toBeTruthy()
    }
  })

  it('shows empty state when no rooms', async () => {
    renderPage()
    expect(await screen.findByText(/Chưa có phòng nào đang chờ/)).toBeTruthy()
  })

  it('shows room cards when rooms returned', async () => {
    const { api } = await import('../../api/client')
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        rooms: [
          {
            id: 'r1', roomCode: 'ABC123', roomName: 'Học Sáng Thế Ký',
            mode: 'SPEED_RACE', status: 'LOBBY', isPublic: true,
            currentPlayers: 2, maxPlayers: 4, questionCount: 10,
            timePerQuestion: 20, difficulty: 'EASY', bookScope: 'OLD_TESTAMENT',
            hostName: 'Mục sư Hùng', createdAt: new Date().toISOString(),
            playerInitials: ['H', 'M'],
          },
        ],
      },
    })
    renderPage()
    expect(await screen.findByTestId('room-card')).toBeTruthy()
    expect(await screen.findByText('Học Sáng Thế Ký')).toBeTruthy()
  })

  it('displays Bible context (book scope + difficulty) in room card', async () => {
    const { api } = await import('../../api/client')
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        rooms: [{
          id: 'r2', roomCode: 'XY1234', roomName: 'Test Room',
          mode: 'BATTLE_ROYALE', status: 'LOBBY', isPublic: true,
          currentPlayers: 1, maxPlayers: 8, questionCount: 20,
          timePerQuestion: 15, difficulty: 'HARD', bookScope: 'OLD_TESTAMENT',
          hostName: 'Bùi Tài', createdAt: new Date().toISOString(),
          playerInitials: ['B'],
        }],
      },
    })
    renderPage()
    expect(await screen.findByText('Cựu Ước (39 sách)')).toBeTruthy()
    expect(await screen.findByText(/20 câu/)).toBeTruthy()
    expect(await screen.findByText(/15s\/câu/)).toBeTruthy()
  })

  it('displays mode badge with correct label', async () => {
    const { api } = await import('../../api/client')
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        rooms: [{
          id: 'r3', roomCode: 'TT5678', roomName: 'Team Room',
          mode: 'TEAM_VS_TEAM', status: 'LOBBY', isPublic: true,
          currentPlayers: 2, maxPlayers: 8, questionCount: 15,
          timePerQuestion: 30, difficulty: 'MIXED', bookScope: 'ALL',
          hostName: 'Linh Chi', createdAt: new Date().toISOString(),
          playerInitials: ['L', 'A'],
        }],
      },
    })
    renderPage()
    expect(await screen.findByText('Team vs Team')).toBeTruthy()
  })

  it('redirects unauthenticated users', async () => {
    const { useAuth } = await import('../../store/authStore')
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as ReturnType<typeof useAuth>)
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
