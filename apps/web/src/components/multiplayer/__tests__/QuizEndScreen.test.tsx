import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuizEndScreen from '../QuizEndScreen'
import type { PlayerScore } from '../../../pages/room/RoomOverlays'

const noop = () => {}

const SAMPLE: PlayerScore[] = [
  { playerId: 'a', username: 'An',  score: 198, correctAnswers: 11, totalAnswered: 15, accuracy: 0.73, finalRank: 2 },
  { playerId: 'b', username: 'Bui', score: 252, correctAnswers: 14, totalAnswered: 15, accuracy: 0.93, finalRank: 1 },
  { playerId: 'c', username: 'Chi', score: 156, correctAnswers: 9,  totalAnswered: 15, accuracy: 0.60, finalRank: 3 },
]

describe('QuizEndScreen', () => {
  const baseProps = {
    results: SAMPLE,
    totalQuestions: 15,
    startedAtMs: Date.now() - 7 * 60 * 1000,
    onReplay: noop, onClose: noop, onShare: noop, onNewRoom: noop, onHome: noop,
  }

  it('renders host view with replay + close buttons and host badge', () => {
    render(<QuizEndScreen {...baseProps} myUsername="Bui" isHost />)
    expect(screen.getByTestId('quiz-end-screen')).toBeInTheDocument()
    expect(screen.getByText(/Host view/)).toBeInTheDocument()
    expect(screen.getByText(/Lựa chọn của Host/)).toBeInTheDocument()
    expect(screen.getByTestId('end-host-replay')).toBeInTheDocument()
    expect(screen.getByTestId('end-host-close')).toBeInTheDocument()
    // host view does not render the player hero card
    expect(screen.queryByTestId('end-hero-card')).not.toBeInTheDocument()
    // player buttons should be absent
    expect(screen.queryByTestId('end-player-share')).not.toBeInTheDocument()
  })

  it('renders player view with hero card + share/new-room/home buttons', () => {
    render(<QuizEndScreen {...baseProps} myUsername="An" isHost={false} />)
    expect(screen.getByTestId('quiz-end-screen')).toBeInTheDocument()
    expect(screen.getByText(/Player view/)).toBeInTheDocument()
    expect(screen.getByTestId('end-hero-card')).toBeInTheDocument()
    expect(screen.getByText(/Hạng 2/)).toBeInTheDocument()
    expect(screen.getByTestId('end-player-share')).toBeInTheDocument()
    expect(screen.getByTestId('end-player-new-room')).toBeInTheDocument()
    expect(screen.getByTestId('end-player-home')).toBeInTheDocument()
    expect(screen.queryByTestId('end-host-replay')).not.toBeInTheDocument()
  })

  it('renders the podium for 3+ players', () => {
    render(<QuizEndScreen {...baseProps} myUsername="An" isHost={false} />)
    expect(screen.getByTestId('podium')).toBeInTheDocument()
    expect(screen.queryByTestId('head-to-head')).not.toBeInTheDocument()
  })

  it('renders the head-to-head duel (not podium) for 2 players', () => {
    const two: PlayerScore[] = [
      { playerId: 'a', username: 'An',  score: 147, correctAnswers: 1, totalAnswered: 5, accuracy: 0.2, finalRank: 2 },
      { playerId: 'b', username: 'Bui', score: 147, correctAnswers: 1, totalAnswered: 5, accuracy: 0.2, finalRank: 1 },
    ]
    render(<QuizEndScreen {...baseProps} results={two} myUsername="An" isHost />)
    expect(screen.getByTestId('head-to-head')).toBeInTheDocument()
    expect(screen.queryByTestId('podium')).not.toBeInTheDocument()
    // equal scores → tie badge surfaces the tie-break
    expect(screen.getByTestId('h2h-tie-badge')).toBeInTheDocument()
  })

  it('hides the redundant side ranking list for 2 players', () => {
    const two: PlayerScore[] = [
      { playerId: 'a', username: 'An',  score: 200, correctAnswers: 3, totalAnswered: 5, accuracy: 0.6, finalRank: 1 },
      { playerId: 'b', username: 'Bui', score: 100, correctAnswers: 1, totalAnswered: 5, accuracy: 0.2, finalRank: 2 },
    ]
    render(<QuizEndScreen {...baseProps} results={two} myUsername="An" isHost={false} />)
    // EndRankingList tags the viewer with "(bạn)"; head-to-head does not.
    expect(screen.queryByText(/\(bạn\)/)).not.toBeInTheDocument()
  })

  it('omits the "Thời gian" stat when match start was not captured', () => {
    render(<QuizEndScreen {...baseProps} startedAtMs={null} myUsername="An" isHost={false} />)
    expect(screen.queryByText('Thời gian')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('derives rank from score order when the mode never assigns finalRank (Speed Race)', () => {
    // Regression: winner used to see "Chưa xếp hạng" because myRank read
    // finalRank only — Speed Race results carry no finalRank at all.
    const noRanks: PlayerScore[] = [
      { playerId: 'a', username: 'An',  score: 829, correctAnswers: 6, totalAnswered: 10, accuracy: 0.6 },
      { playerId: 'b', username: 'Bui', score: 811, correctAnswers: 6, totalAnswered: 9,  accuracy: 0.66 },
    ]
    render(<QuizEndScreen {...baseProps} results={noRanks} myUsername="An" isHost={false} />)
    expect(screen.getByText(/Hạng 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Chưa xếp hạng/)).not.toBeInTheDocument()
  })

  it('identifies "me" by userId even when the localStorage display name drifted', () => {
    render(
      <QuizEndScreen
        {...baseProps}
        myUsername="stale-old-name"
        myUserId="b"
        isHost={false}
      />,
    )
    // PlayerScore b = Bui, finalRank 1 — must resolve via playerId, not username
    expect(screen.getByText(/Hạng 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Chưa xếp hạng/)).not.toBeInTheDocument()
  })

  it('host actions wire to onReplay and onClose', () => {
    const onReplay = vi.fn()
    const onClose = vi.fn()
    render(<QuizEndScreen {...baseProps} myUsername="Bui" isHost onReplay={onReplay} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('end-host-replay'))
    expect(onReplay).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('end-host-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('analytics button only renders when onAnalytics is provided + wires the callback', () => {
    const { rerender } = render(<QuizEndScreen {...baseProps} myUsername="Bui" isHost />)
    expect(screen.queryByTestId('end-host-analytics')).not.toBeInTheDocument()

    const onAnalytics = vi.fn()
    rerender(<QuizEndScreen {...baseProps} myUsername="Bui" isHost onAnalytics={onAnalytics} />)
    const btn = screen.getByTestId('end-host-analytics')
    expect(btn).toHaveTextContent('Xem phân tích chi tiết')
    fireEvent.click(btn)
    expect(onAnalytics).toHaveBeenCalledOnce()
  })

  it('player actions wire to onShare/onNewRoom/onHome', () => {
    const onShare = vi.fn()
    const onNewRoom = vi.fn()
    const onHome = vi.fn()
    render(<QuizEndScreen {...baseProps} myUsername="An" isHost={false} onShare={onShare} onNewRoom={onNewRoom} onHome={onHome} />)
    fireEvent.click(screen.getByTestId('end-player-share'))
    fireEvent.click(screen.getByTestId('end-player-new-room'))
    fireEvent.click(screen.getByTestId('end-player-home'))
    expect(onShare).toHaveBeenCalledOnce()
    expect(onNewRoom).toHaveBeenCalledOnce()
    expect(onHome).toHaveBeenCalledOnce()
  })

  it('rankings list highlights the viewer with "(bạn)" suffix', () => {
    render(<QuizEndScreen {...baseProps} myUsername="An" isHost={false} />)
    expect(screen.getByText(/An.*\(bạn\)/)).toBeInTheDocument()
  })

  it('hero card shows "· 0 điểm" for a zero-score player (not swallowed by falsy check)', () => {
    const zero: PlayerScore[] = [
      { playerId: 'a', username: 'An', score: 100, correctAnswers: 5, totalAnswered: 10, accuracy: 0.5, finalRank: 1 },
      { playerId: 'z', username: 'Zo', score: 0,   correctAnswers: 0, totalAnswered: 10, accuracy: 0,   finalRank: 2 },
    ]
    render(<QuizEndScreen {...baseProps} results={zero} myUsername="Zo" isHost={false} />)
    expect(screen.getByTestId('end-hero-card')).toHaveTextContent(/Zo · 0 điểm/)
  })

  it('hero card avatar/name uses the server username when localStorage name drifted', () => {
    render(
      <QuizEndScreen {...baseProps} myUsername="stale-old-name" myUserId="b" isHost={false} />,
    )
    // resolved player b = Bui; hero must show the server name, not the stale one
    expect(screen.getByTestId('end-hero-card')).toHaveTextContent(/Bui/)
    expect(screen.getByTestId('end-hero-card')).not.toHaveTextContent(/stale-old-name/)
  })
})

describe('QuizEndScreen — số liệu theo mode (PCV-15)', () => {
  it('Đấu vương: bục vinh danh ghi số trận thắng thay cho điểm', () => {
    const results: PlayerScore[] = [
      { playerId: 'a', username: 'An', score: 300, correctAnswers: 6, totalAnswered: 8, accuracy: 75, finalRank: 1, matchesWon: 4 },
      { playerId: 'b', username: 'Bình', score: 500, correctAnswers: 7, totalAnswered: 9, accuracy: 77, finalRank: 2, matchesWon: 2 },
      { playerId: 'c', username: 'Châu', score: 100, correctAnswers: 2, totalAnswered: 5, accuracy: 40, finalRank: 3, matchesWon: 0 },
    ]
    render(<QuizEndScreen results={results} myUsername="An" myUserId="a" isHost totalQuestions={20}
      onReplay={noop} onClose={noop} onShare={noop} onNewRoom={noop} onHome={noop}
      metric={(p) => `${p.matchesWon ?? 0} trận thắng`} />)
    expect(screen.getByText('4 trận thắng')).toBeInTheDocument()
    expect(screen.queryByText('300 điểm')).toBeNull()
  })
})

describe('QuizEndScreen — ghi chú cuối trận (PCV-16)', () => {
  it('hiện "Khán giả tinh mắt" khi có', () => {
    render(<QuizEndScreen results={SAMPLE} myUsername="An" isHost totalQuestions={15}
      onReplay={noop} onClose={noop} onShare={noop} onNewRoom={noop} onHome={noop}
      note="Khán giả tinh mắt: Chi (3 lần đoán đúng)" />)
    expect(screen.getByTestId('end-note').textContent).toBe('Khán giả tinh mắt: Chi (3 lần đoán đúng)')
  })
})

describe('QuizEndScreen — chơi lại với nhóm (PCV-17)', () => {
  const props = {
    results: SAMPLE, totalQuestions: 15, myUsername: 'An', myUserId: 'a',
    onReplay: noop, onClose: noop, onShare: noop, onNewRoom: noop, onHome: noop,
  }

  it('chủ phòng đã mở ván mới: người chơi thấy "Vào ván mới"', () => {
    const onJoin = vi.fn()
    render(<QuizEndScreen {...props} isHost={false} rematchReady onJoinRematch={onJoin} />)
    fireEvent.click(screen.getByTestId('end-join-rematch'))
    expect(onJoin).toHaveBeenCalledOnce()
  })

  it('chưa có ván mới: không có nút vào', () => {
    render(<QuizEndScreen {...props} isHost={false} />)
    expect(screen.queryByTestId('end-join-rematch')).toBeNull()
  })

  it('Đấu nhanh: người chơi tự mở được ván mới', () => {
    const onRematch = vi.fn()
    render(<QuizEndScreen {...props} isHost={false} onPlayerRematch={onRematch} />)
    fireEvent.click(screen.getByTestId('end-player-rematch'))
    expect(onRematch).toHaveBeenCalledOnce()
  })
})
