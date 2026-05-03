import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * Tests for the Room Lobby chat path. The room itself is loaded via fetch;
 * STOMP is owned by the useStomp hook, which we capture via vi.mock so we
 * can both observe send() calls (chat-out) and synthesize onMessage()
 * frames (chat-in) without spinning a real WebSocket.
 */

// Capture the latest useStomp args so the tests can drive onMessage.
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

const mockRoom = {
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
  players: [
    { id: 'p1', userId: 'host-1', username: 'WS Host', isReady: false, score: 0 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  lastStompArgs = null
  // Make myUsername() report "WS Host" so the lobby treats us as the host.
  window.localStorage.setItem('userName', 'WS Host')
  window.localStorage.setItem('accessToken', 'test-token')
  // fetchRoom() in RoomLobby calls the API; respond with our fixture.
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, room: mockRoom }),
      } as Response),
    ),
  )
  // Default api mock: no questions assigned
  mockApiGet.mockResolvedValue({ data: { success: true, questions: [] } })
  mockApiPost.mockResolvedValue({ data: { success: true, questions: [], assigned: 0, generated: 0, question: null } })
  mockApiDelete.mockResolvedValue({ data: { success: true } })
})

afterEach(() => {
  // Restore window.fetch so later test files don't see this stub leaking
  // (other tests rely on real or per-file mocked fetch behavior).
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

async function renderLobby() {
  const RoomLobby = (await import('../RoomLobby')).default
  return render(
    <MemoryRouter initialEntries={['/room/room-1']}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomLobby />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Room Lobby — module', () => {
  it('module exports default component', async () => {
    const mod = await import('../RoomLobby')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('component name is defined', async () => {
    const mod = await import('../RoomLobby')
    expect(mod.default.name).toBeTruthy()
  })
})

describe('Room Lobby — chat', () => {
  it('sends "/app/room/{id}/chat" with trimmed text on Enter', async () => {
    await renderLobby()
    const input = await screen.findByPlaceholderText(/Nhắn tin/i)

    fireEvent.change(input, { target: { value: '  hello team  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(sendSpy).toHaveBeenCalledWith(
      '/app/room/room-1/chat',
      { text: 'hello team' },
    )
  })

  it('does NOT send when the text is whitespace-only', async () => {
    await renderLobby()
    const input = await screen.findByPlaceholderText(/Nhắn tin/i)

    fireEvent.change(input, { target: { value: '     ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('renders incoming CHAT_MESSAGE frames as chat bubbles', async () => {
    await renderLobby()
    // Wait for the lobby to wire up useStomp.
    await waitFor(() => expect(lastStompArgs).not.toBeNull())

    // Synthesize a chat frame as the broker would deliver it.
    lastStompArgs.onMessage({
      type: 'CHAT_MESSAGE',
      data: { sender: 'WS Host', text: 'Chào mọi người!' },
    })

    expect(await screen.findByText('Chào mọi người!')).toBeInTheDocument()
  })

  it('flips chat input back to empty after sending', async () => {
    await renderLobby()
    const input = (await screen.findByPlaceholderText(/Nhắn tin/i)) as HTMLInputElement

    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(input.value).toBe(''))
  })
})

describe('Room Lobby — question set banner', () => {
  const mockRoomCustomWithSet = {
    ...mockRoom,
    questionSource: 'CUSTOM',
    questionSetId: 'set-abc',
    hostId: 'host-1',
    players: [
      { id: 'p1', userId: 'host-1', username: 'WS Host', isReady: false, score: 0 },
    ],
  }

  const mockRoomCustomNoSet = {
    ...mockRoom,
    questionSource: 'CUSTOM',
    questionSetId: null,
    hostId: 'host-1',
    players: [
      { id: 'p1', userId: 'host-1', username: 'WS Host', isReady: false, score: 0 },
    ],
  }

  async function renderRoomLobby(room: object) {
    const RoomLobby = (await import('../RoomLobby')).default
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, room }),
    } as Response)))
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/room/room-1', state: { room } }]}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomLobby />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('shows set banner when CUSTOM source with questionSetId (host)', async () => {
    await renderRoomLobby(mockRoomCustomWithSet)
    expect(await screen.findByText(/Soạn câu hỏi/i)).toBeInTheDocument()
  })

  it('does NOT show set banner when CUSTOM source without questionSetId', async () => {
    await renderRoomLobby(mockRoomCustomNoSet)
    await screen.findByPlaceholderText(/Nhắn tin/i)
    expect(screen.queryByText(/Soạn câu hỏi/i)).not.toBeInTheDocument()
  })

  it('does NOT show set banner for DATABASE source', async () => {
    await renderLobby()
    await screen.findByPlaceholderText(/Nhắn tin/i)
    expect(screen.queryByText(/Soạn câu hỏi/i)).not.toBeInTheDocument()
  })

  it('set banner links to /my-sets/:questionSetId for host', async () => {
    await renderRoomLobby(mockRoomCustomWithSet)
    const link = (await screen.findByText(/Soạn câu hỏi/i)).closest('a')
    expect(link).toHaveAttribute('href', '/my-sets/set-abc')
  })
})
