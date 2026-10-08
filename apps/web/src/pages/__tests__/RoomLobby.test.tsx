import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * Tests for the redesigned Room Lobby (post 2026-05-07 redesign).
 * Covers: hero block + room code + share button (Task ML-2),
 * player slots + invite slot + kick menu (Task ML-3),
 * compact rules + bottom bar (Task ML-4),
 * chat FAB + panel toggle (Task ML-5).
 */

let lastStompArgs: any = null
const sendSpy = vi.fn()

vi.mock('../../hooks/useStomp', () => ({
  useStomp: (args: any) => {
    lastStompArgs = args
    return { connected: true, reconnecting: false, send: sendSpy }
  },
}))

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
const mockApiDelete = vi.fn()
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const baseRoom = {
  id: 'room-1',
  roomCode: 'XND1E1',
  roomName: 'Test Room',
  status: 'LOBBY' as const,
  mode: 'SPEED_RACE',
  isPublic: true,
  maxPlayers: 4,
  currentPlayers: 1,
  questionCount: 3,
  timePerQuestion: 15,
  hostId: 'host-1',
  hostName: 'WS Host',
  difficulty: 'MIXED',
  players: [
    { id: 'p1', userId: 'host-1', username: 'WS Host', isReady: false, score: 0 },
  ],
}

function withPlayers(extra: Array<Partial<typeof baseRoom.players[number]> & { avatarUrl?: string }>) {
  const players = [
    ...baseRoom.players,
    ...extra.map((p, i) => ({
      id: `p${i + 2}`, userId: `u${i + 2}`, username: `User${i + 2}`,
      isReady: true, score: 0, ...p,
    })),
  ]
  return { ...baseRoom, players, currentPlayers: players.length }
}

beforeEach(() => {
  vi.clearAllMocks()
  lastStompArgs = null
  window.localStorage.setItem('userName', 'WS Host')
  window.localStorage.setItem('accessToken', 'test-token')
  // Default: api.get returns the room + viewerUserId. RoomLobby reads
  // res.data.room and res.data.viewerUserId separately (per-viewer field
  // is intentionally outside the room snapshot — see QT-1/QT-2).
  mockApiGet.mockResolvedValue({ data: { success: true, room: baseRoom, viewerUserId: 'host-1' } })
  mockApiPost.mockResolvedValue({ data: { success: true } })
  mockApiDelete.mockResolvedValue({ data: { success: true } })
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  // happy-dom defaults to 1024 width — keep "desktop" by ensuring innerWidth.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

async function renderLobby(roomOverride?: object, viewerUserId: string = 'host-1') {
  if (roomOverride) {
    mockApiGet.mockResolvedValue({ data: { success: true, room: roomOverride, viewerUserId } })
  }
  const RoomLobby = (await import('../RoomLobby')).default
  return render(
    <MemoryRouter initialEntries={['/room/room-1']}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomLobby />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoomLobby — module', () => {
  // the lobby module is large; importing it cold during a full parallel run can take > 5 s
  it('exports default component', async () => {
    const mod = await import('../RoomLobby')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  }, 30_000)
})

describe('RoomLobby — hero block + room code', () => {
  it('renders the room code prominently', async () => {
    await renderLobby()
    expect(await screen.findByTestId('lobby-room-code')).toHaveTextContent('XND1E1')
  })

  it('renders mode + visibility chips and meta', async () => {
    await renderLobby()
    await screen.findByTestId('lobby-room-code')
    // Mode label appears in topbar chip + rule title — at least one match suffices.
    expect(screen.getAllByText(/Speed Race/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Công khai/i)).toBeInTheDocument()
    // Hero stats grid (post-redesign): values rendered without inline units;
    // labels carry the unit context.
    expect(screen.getByText(/Câu hỏi/i)).toBeInTheDocument()
    expect(screen.getByText(/Thời gian\/câu/i)).toBeInTheDocument()
    expect(screen.getByText(/15s/i)).toBeInTheDocument()
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument()
  })

  it('opens InviteShareModal when share button is clicked', async () => {
    await renderLobby()
    fireEvent.click(await screen.findByTestId('lobby-share-btn'))
    expect(await screen.findByRole('dialog', { name: /Mời bạn bè/i })).toBeInTheDocument()
  })
})

describe('RoomLobby — players grid', () => {
  it('renders host slot with crown', async () => {
    await renderLobby()
    expect(await screen.findByTestId('lobby-slot-host-1')).toBeInTheDocument()
    expect(screen.getByText(/Chủ phòng/i)).toBeInTheDocument()
  })

  it('renders the invite slot when seats remain', async () => {
    await renderLobby()
    expect(await screen.findByTestId('lobby-invite-slot')).toBeInTheDocument()
  })

  it('clicking invite slot opens share modal', async () => {
    await renderLobby()
    fireEvent.click(await screen.findByTestId('lobby-invite-slot'))
    expect(await screen.findByRole('dialog', { name: /Mời bạn bè/i })).toBeInTheDocument()
  })

  it('host sees kick menu on non-host slots', async () => {
    const room = withPlayers([{ userId: 'guest-1', username: 'Guest' }])
    await renderLobby(room)
    expect(await screen.findByTestId('lobby-slot-menu-guest-1')).toBeInTheDocument()
    // Host's own slot should NOT have kick menu.
    expect(screen.queryByTestId('lobby-slot-menu-host-1')).not.toBeInTheDocument()
  })

  it('opening kick menu reveals Kick action', async () => {
    const room = withPlayers([{ userId: 'guest-1', username: 'Guest' }])
    await renderLobby(room)
    fireEvent.click(await screen.findByTestId('lobby-slot-menu-guest-1'))
    expect(await screen.findByTestId('lobby-kick-guest-1')).toBeInTheDocument()
  })

  it('clicking Kick calls /api/rooms/{id}/kick with userId', async () => {
    const room = withPlayers([{ userId: 'guest-1', username: 'Guest' }])
    await renderLobby(room)
    fireEvent.click(await screen.findByTestId('lobby-slot-menu-guest-1'))
    fireEvent.click(await screen.findByTestId('lobby-kick-guest-1'))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/rooms/room-1/kick', { userId: 'guest-1' })
    })
  })
})

describe('RoomLobby — bottom bar', () => {
  it('start button disabled when alone', async () => {
    await renderLobby()
    const btn = await screen.findByTestId('lobby-start-btn')
    expect(btn).toBeDisabled()
  })

  it('start button enabled when ≥1 ready non-host player', async () => {
    const room = withPlayers([{ userId: 'guest-1', username: 'Guest', isReady: true }])
    await renderLobby(room)
    const btn = await screen.findByTestId('lobby-start-btn')
    expect(btn).not.toBeDisabled()
  })

  it('leave button calls /api/rooms/{id}/leave', async () => {
    await renderLobby()
    fireEvent.click(await screen.findByTestId('lobby-leave-btn'))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/rooms/room-1/leave')
    })
  })
})

describe('RoomLobby — chat panel (desktop always visible)', () => {
  it('chat panel is always visible on desktop and FAB is not rendered', async () => {
    await renderLobby()
    expect(await screen.findByTestId('lobby-chat-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('lobby-chat-fab')).not.toBeInTheDocument()
  })

  it('chat panel stays visible regardless of player count', async () => {
    const room = withPlayers([{ userId: 'guest-1', username: 'Guest' }])
    await renderLobby(room)
    expect(await screen.findByTestId('lobby-chat-panel')).toBeInTheDocument()
  })

  it('sends "/app/room/{id}/chat" with trimmed text on Enter', async () => {
    await renderLobby()
    const input = await screen.findByPlaceholderText(/Nhắn tin/i)
    fireEvent.change(input, { target: { value: '  hello team  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sendSpy).toHaveBeenCalledWith('/app/room/room-1/chat', { text: 'hello team' })
  })

  it('does NOT send when text is whitespace-only', async () => {
    await renderLobby()
    const input = await screen.findByPlaceholderText(/Nhắn tin/i)
    fireEvent.change(input, { target: { value: '     ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('renders incoming CHAT_MESSAGE frames', async () => {
    await renderLobby()
    await screen.findByPlaceholderText(/Nhắn tin/i)
    await waitFor(() => expect(lastStompArgs).not.toBeNull())
    lastStompArgs.onMessage({
      type: 'CHAT_MESSAGE',
      data: { sender: 'WS Host', text: 'Chào mọi người!' },
    })
    expect(await screen.findByText('Chào mọi người!')).toBeInTheDocument()
  })

  it('clears chat input after sending', async () => {
    await renderLobby()
    const input = (await screen.findByPlaceholderText(/Nhắn tin/i)) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('6 emoji reactions are rendered (mockup order)', async () => {
    await renderLobby()
    await screen.findByPlaceholderText(/Nhắn tin/i)
    for (const e of ['👏', '😂', '😱', '🔥', '💪', '🙏']) {
      expect(screen.getByText(e)).toBeInTheDocument()
    }
  })
})

describe('RoomLobby — rules card', () => {
  it('renders compact rule text', async () => {
    await renderLobby()
    expect(await screen.findByText(/Luật Speed Race/i)).toBeInTheDocument()
  })

  it('clicking "Chi tiết" opens rules detail modal', async () => {
    await renderLobby()
    fireEvent.click(await screen.findByTestId('lobby-rules-detail-btn'))
    expect(await screen.findByRole('dialog', { name: /Chi tiết luật chơi/i })).toBeInTheDocument()
  })
})

describe('RoomLobby — Sprint 4 host-organizer mode', () => {
  it('shows "Bạn là Quản trò" badge when host views a Quan Tro room', async () => {
    // hostPlaysGame=false → host is NOT in players list; isHost still resolves
    // via viewerUserId == hostId fallback so the organizer badge renders.
    const quanTroRoom = {
      ...baseRoom,
      hostPlaysGame: false,
      players: [], // host not in RoomPlayer table
      currentPlayers: 0,
    }
    await renderLobby(quanTroRoom, 'host-1')
    const badge = await screen.findByTestId('lobby-organizer-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(/Bạn là Quản trò/i)
    expect(badge).toHaveTextContent(/không trả lời câu hỏi/i)
    // No player-side host info card.
    expect(screen.queryByTestId('lobby-host-info-card')).toBeNull()
  })

  it('shows separate Quản trò card when a non-host player views a Quan Tro room', async () => {
    window.localStorage.setItem('userName', 'An')
    const quanTroRoom = {
      ...baseRoom,
      hostPlaysGame: false,
      players: [
        { id: 'pa', userId: 'u-an', username: 'An', isReady: false, score: 0 },
      ],
      currentPlayers: 1,
    }
    await renderLobby(quanTroRoom, 'u-an')
    const card = await screen.findByTestId('lobby-host-info-card')
    expect(card).toBeInTheDocument()
    expect(card).toHaveTextContent(/Quản trò/i)
    expect(card).toHaveTextContent(/WS Host/i)
    expect(card).toHaveTextContent(/Không chơi/i)
    // No organizer badge (that's the host's view).
    expect(screen.queryByTestId('lobby-organizer-badge')).toBeNull()
  })

  it('legacy room (hostPlaysGame undefined) renders neither Quan Tro affordance', async () => {
    await renderLobby() // baseRoom has no hostPlaysGame field
    await screen.findByTestId('lobby-room-code')
    expect(screen.queryByTestId('lobby-organizer-badge')).toBeNull()
    expect(screen.queryByTestId('lobby-host-info-card')).toBeNull()
  })

  // Regression for QT-fix (2026-05-10): a Quản trò who saw the lobby
  // correctly used to lose isHost the moment the first ROOM_STATE event
  // arrived, because the WS snapshot carried no viewer identity and FE
  // overwrote room with msg.data — flipping the start button to a stale
  // "Sẵn sàng" that did nothing. viewerUserId now lives outside `room`,
  // so a ROOM_STATE update must NOT clear the organizer badge.
  it('Quản trò keeps isHost across a ROOM_STATE WS event (no viewer field in snapshot)', async () => {
    const quanTroRoom = {
      ...baseRoom,
      hostPlaysGame: false,
      players: [],
      currentPlayers: 0,
    }
    await renderLobby(quanTroRoom, 'host-1')
    expect(await screen.findByTestId('lobby-organizer-badge')).toBeInTheDocument()
    await waitFor(() => expect(lastStompArgs).not.toBeNull())
    // Simulate a player joining: backend re-broadcasts the room WITHOUT
    // any per-viewer field (the bug we fixed).
    lastStompArgs.onMessage({
      type: 'ROOM_STATE',
      data: {
        ...quanTroRoom,
        players: [{ id: 'pa', userId: 'u-a', username: 'A', isReady: true, score: 0 }],
        currentPlayers: 1,
      },
    })
    expect(await screen.findByTestId('lobby-organizer-badge')).toBeInTheDocument()
  })
})

// LAV-1: avatar must route through resolveAvatar so emoji presets render as
// emojis and broken/unknown values fall back to the initial — never a broken
// <img> showing alt text over the gradient.
describe('RoomLobby — player avatar', () => {
  it('renders an emoji preset avatar instead of a broken <img>', async () => {
    await renderLobby(withPlayers([{ avatarUrl: 'preset:king', username: 'KingUser' }]))
    const slot = await screen.findByTestId('lobby-slot-u2')
    expect(slot.textContent).toContain('🤴')
    // No <img> should be rendered for a preset avatar (the raw-img bug).
    expect(slot.querySelector('img')).toBeNull()
  })

  it('falls back to the initial when avatarUrl is not a URL or preset', async () => {
    await renderLobby(withPlayers([{ avatarUrl: 'garbage-value', username: 'Zoe' }]))
    const slot = await screen.findByTestId('lobby-slot-u2')
    expect(slot.querySelector('img')).toBeNull()
    expect(slot.textContent).toContain('Z')
  })

  it('renders an <img> for a real avatar URL', async () => {
    await renderLobby(withPlayers([{ avatarUrl: 'https://example.com/a.png', username: 'Urly' }]))
    const slot = await screen.findByTestId('lobby-slot-u2')
    expect(slot.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png')
  })
})
