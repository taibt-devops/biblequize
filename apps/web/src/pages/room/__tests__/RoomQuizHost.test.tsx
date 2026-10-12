// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mock STOMP so the component renders synchronously without a real WS.
let lastOnMessage: ((m: { type: string; data: unknown }) => void) | null = null
vi.mock('../../../hooks/useStomp', () => ({
  useStomp: ({ onMessage }: { onMessage: (m: { type: string; data: unknown }) => void }) => {
    lastOnMessage = onMessage
    return { connected: true, reconnecting: false, send: vi.fn() }
  },
}))

const mockApiPost = vi.fn().mockResolvedValue({ data: { success: true } })
vi.mock('../../../api/client', () => ({
  api: { post: (...a: unknown[]) => mockApiPost(...a) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  lastOnMessage = null
})

async function renderHost() {
  const Page = (await import('../RoomQuizHost')).default
  return render(
    <MemoryRouter initialEntries={['/room/r1/host']}>
      <Routes>
        <Route path="/room/:roomId/host" element={<Page />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RoomQuizHost', () => {
  it('renders Quan Tro badge + 4 control buttons', async () => {
    await renderHost()
    expect(await screen.findByText(/👑 Quản trò/i)).toBeInTheDocument()
    expect(screen.getByTestId('host-control-pause')).toBeInTheDocument()
    expect(screen.getByTestId('host-control-skip')).toBeInTheDocument()
    expect(screen.getByTestId('host-control-broadcast')).toBeInTheDocument()
    expect(screen.getByTestId('host-control-end')).toBeInTheDocument()
  })

  it('anti-spoiler: hides correct answer on QUESTION_START, reveals it on ROUND_END', async () => {
    await renderHost()
    expect(lastOnMessage).not.toBeNull()
    lastOnMessage!({
      type: 'QUESTION_START',
      data: {
        questionIndex: 0,
        totalQuestions: 5,
        timeLimit: 30,
        question: {
          id: 'q1',
          content: 'Câu hỏi test?',
          options: ['A1', 'B1', 'C1', 'D1'],
        },
      },
    })
    expect(await screen.findByText('Câu hỏi test?')).toBeInTheDocument()
    // Anti-spoiler (2026-05-23): correct answer must NOT be marked while the
    // round is live — host shares /topic/room/{id} with players.
    expect(screen.queryByText(/✓ ĐÁP ÁN/)).not.toBeInTheDocument()

    // Reveal only after ROUND_END carries correctIndex.
    lastOnMessage!({ type: 'ROUND_END', data: { correctIndex: 2 } })
    expect(await screen.findByText(/✓ ĐÁP ÁN/)).toBeInTheDocument()
    expect(screen.getByTestId('host-option-2')).toHaveTextContent('✓ ĐÁP ÁN')
  })

  it('pause button calls /pause then resume after GAME_PAUSED', async () => {
    await renderHost()
    fireEvent.click(screen.getByTestId('host-control-pause'))
    expect(mockApiPost).toHaveBeenCalledWith('/api/rooms/r1/host/pause', {})

    // Simulate the WS echo
    lastOnMessage!({ type: 'GAME_PAUSED', data: {} })
    expect(await screen.findByTestId('host-pause-overlay')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('host-control-pause'))
    expect(mockApiPost).toHaveBeenCalledWith('/api/rooms/r1/host/resume', {})
  })

  it('pause overlay has its own resume button for the host', async () => {
    await renderHost()
    lastOnMessage!({ type: 'GAME_PAUSED', data: {} })
    expect(await screen.findByTestId('host-pause-overlay')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('host-pause-resume'))
    expect(mockApiPost).toHaveBeenCalledWith('/api/rooms/r1/host/resume', {})
  })

  it('broadcast modal sends message and clears input', async () => {
    await renderHost()
    fireEvent.click(screen.getByTestId('host-control-broadcast'))
    const input = await screen.findByTestId('host-broadcast-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Đọc kỹ Sáng Thế Ký nhé' } })
    fireEvent.click(screen.getByTestId('host-broadcast-send'))
    expect(mockApiPost).toHaveBeenCalledWith('/api/rooms/r1/host/broadcast', {
      message: 'Đọc kỹ Sáng Thế Ký nhé',
    })
  })

  it('end-early requires confirmation modal', async () => {
    await renderHost()
    fireEvent.click(screen.getByTestId('host-control-end'))
    const confirmBtn = await screen.findByTestId('host-end-confirm')
    fireEvent.click(confirmBtn)
    expect(mockApiPost).toHaveBeenCalledWith('/api/rooms/r1/host/end-early', {})
  })

  it('renders QuizEndHost wrap-up on QUIZ_END with rankings', async () => {
    await renderHost()
    lastOnMessage!({
      type: 'QUIZ_END',
      data: [
        { playerId: 'u1', username: 'An', score: 252, correctAnswers: 11, totalAnswered: 15 },
        { playerId: 'u2', username: 'Chi', score: 156, correctAnswers: 8, totalAnswered: 15 },
        { playerId: 'u3', username: 'Dũng', score: 124, correctAnswers: 7, totalAnswered: 15 },
      ],
    })
    expect(await screen.findByTestId('quiz-end-host-page')).toBeInTheDocument()
    expect(screen.getByText(/Chúc mừng nhà vô địch/i)).toBeInTheDocument()
    // QTR-6: the celebration block is now an inline podium — winner "An"
    // stands on step 1 with their score; no finalRank in the payload, so the
    // podium must rank by score (Speed Race has no finalRank).
    const winner = screen.getByTestId('end-host-winner')
    expect(winner).toContainElement(screen.getByTestId('podium-block'))
    expect(winner).toHaveTextContent(/An/)
    expect(winner).toHaveTextContent(/252đ/)
    expect(screen.getByTestId('end-host-rankings').children).toHaveLength(3)
    expect(screen.getByTestId('end-host-replay')).toBeInTheDocument()
  })

  it('renders head-to-head (not podium) and hides the redundant list for 2 players', async () => {
    await renderHost()
    lastOnMessage!({
      type: 'QUIZ_END',
      data: [
        { playerId: 'u1', username: 'An', score: 266, correctAnswers: 2, totalAnswered: 5 },
        { playerId: 'u2', username: 'Bui', score: 0, correctAnswers: 0, totalAnswered: 5 },
      ],
    })
    expect(await screen.findByTestId('quiz-end-host-page')).toBeInTheDocument()
    const winner = screen.getByTestId('end-host-winner')
    expect(winner).toContainElement(screen.getByTestId('head-to-head'))
    expect(screen.queryByTestId('podium-block')).not.toBeInTheDocument()
    // side ranking list is redundant with the duel → hidden for ≤2
    expect(screen.queryByTestId('end-host-rankings')).not.toBeInTheDocument()
    expect(screen.getByTestId('end-host-replay')).toBeInTheDocument()
  })

  it('live-answer list: chỉ "đã trả lời" khi đang chơi, đúng/sai + điểm khi công bố (PCV-3)', async () => {
    await renderHost()
    lastOnMessage!({ type: 'ANSWER_SUBMITTED', data: { playerId: 'u1', username: 'An', answered: true } })
    lastOnMessage!({ type: 'ANSWER_SUBMITTED', data: { playerId: 'u2', username: 'Chi', answered: true } })
    expect(await screen.findByText(/An/)).toBeInTheDocument()
    expect(screen.getByText(/Chi/)).toBeInTheDocument()
    expect(screen.getAllByText(/Đã trả lời/).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/ĐÚNG/)).toBeNull()

    lastOnMessage!({
      type: 'ROUND_END',
      data: {
        correctIndex: 1,
        leaderboard: [],
        results: [
          { playerId: 'u1', answered: true, isCorrect: true, pointsEarned: 140, streak: 0 },
          { playerId: 'u2', answered: true, isCorrect: false, pointsEarned: 0, streak: 0 },
        ],
      },
    })
    expect(await screen.findByText(/✓ ĐÚNG · \+140/)).toBeInTheDocument()
    expect(screen.getByText(/✗ SAI/)).toBeInTheDocument()
  })
})

describe('RoomQuizHost — tổ chức trận mới với cùng nhóm (PCV-17)', () => {
  it('bấm "Tổ chức trận mới" gọi API chơi lại của phòng', async () => {
    mockApiPost.mockResolvedValue({ data: { success: true, room: { id: 'room-2' }, viewerUserId: 'host' } })
    await renderHost()
    lastOnMessage!({
      type: 'QUIZ_END',
      data: [
        { playerId: 'u1', username: 'An', score: 266, correctAnswers: 2, totalAnswered: 5 },
        { playerId: 'u2', username: 'Bui', score: 0, correctAnswers: 0, totalAnswered: 5 },
      ],
    })
    fireEvent.click(await screen.findByTestId('end-host-replay'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith(expect.stringMatching(/\/api\/rooms\/[^/]+\/rematch$/)))
  })
})

describe('RoomQuizHost — kết quả Đội đấu đội (PCV-19)', () => {
  it('đọc được bảng khi máy chủ bọc kết quả đội trong finalResults', async () => {
    await renderHost()
    lastOnMessage!({
      type: 'QUIZ_END',
      data: {
        roomId: 'r1', timestamp: 1,
        finalResults: {
          teamWinner: 'A', scoreA: 900, scoreB: 400,
          leaderboard: [
            { playerId: 'u1', username: 'An', score: 500, correctAnswers: 5, totalAnswered: 5, finalRank: 1 },
            { playerId: 'u2', username: 'Bình', score: 450, correctAnswers: 4, totalAnswered: 5, finalRank: 1 },
            { playerId: 'u3', username: 'Châu', score: 200, correctAnswers: 2, totalAnswered: 5, finalRank: 2 },
          ],
        },
      },
    })
    expect(await screen.findByTestId('end-host-rankings')).toBeInTheDocument()
    expect(screen.getByTestId('end-host-rankings').children).toHaveLength(3)
  })
})
