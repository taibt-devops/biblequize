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

describe('Room Lobby — host question panel', () => {
  const mockRoomCustom = {
    ...mockRoom,
    questionSource: 'CUSTOM',
    hostId: 'host-1', // matches userName "WS Host" (see beforeEach: localStorage userName = 'WS Host')
    players: [
      { id: 'p1', userId: 'host-1', username: 'WS Host', isReady: false, score: 0 },
    ],
  }

  async function renderCustomLobby() {
    const RoomLobby = (await import('../RoomLobby')).default
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, room: mockRoomCustom }),
    } as Response)))
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/room/room-1', state: { room: mockRoomCustom } }]}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomLobby />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('shows host question panel for CUSTOM source when user is host', async () => {
    await renderCustomLobby()
    expect(await screen.findByTestId('host-question-panel')).toBeInTheDocument()
  })

  it('does NOT show host question panel for DATABASE source', async () => {
    await renderLobby() // uses mockRoom with no questionSource (DATABASE)
    await screen.findByPlaceholderText(/Nhắn tin/i) // wait for render
    expect(screen.queryByTestId('host-question-panel')).not.toBeInTheDocument()
  })

  it('switches to Manual tab and shows question textarea', async () => {
    await renderCustomLobby()
    await screen.findByTestId('host-question-panel')
    fireEvent.click(screen.getByText('Thủ công'))
    expect(await screen.findByPlaceholderText('Nhập câu hỏi...')).toBeInTheDocument()
  })

  it('switches to Assigned tab and shows empty state', async () => {
    await renderCustomLobby()
    await screen.findByTestId('host-question-panel')
    fireEvent.click(screen.getByText('Đã gán'))
    expect(await screen.findByText(/Chưa có câu hỏi/i)).toBeInTheDocument()
  })

  it('AI generate button calls /api/user-questions/generate', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { success: true, generated: 3, questions: [
        { id: 'q1', content: 'Q1', options: ['A','B','C','D'], correctAnswer: 0, difficulty: 'MEDIUM', source: 'AI', book: '', chapter: 0, explanation: '', theme: '' },
      ] }
    })
    await renderCustomLobby()
    await screen.findByTestId('host-question-panel')
    fireEvent.click(screen.getByText(/Tạo với AI/i))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/user-questions/generate', expect.any(Object))
    })
  })
})
