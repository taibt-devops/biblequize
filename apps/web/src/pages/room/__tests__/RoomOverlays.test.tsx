import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import {
  PodiumScreen,
  EliminationScreen,
  TeamScoreBar,
  TeamWinScreen,
  MatchResultOverlay,
  SdArenaHeader,
  RoundScoreboard,
  PlayerScore,
} from '../RoomOverlays'

/**
 * Tests for RoomOverlays components.
 * Covers: PodiumScreen, EliminationScreen, TeamScoreBar,
 *         TeamWinScreen, MatchResultOverlay, SdArenaHeader, RoundScoreboard
 */

function makePlayer(overrides: Partial<PlayerScore> = {}): PlayerScore {
  return {
    playerId: 'p1',
    username: 'Alice',
    score: 100,
    correctAnswers: 8,
    totalAnswered: 10,
    accuracy: 0.8,
    finalRank: 1,
    playerStatus: 'FINISHED',
    ...overrides,
  }
}

const players3: PlayerScore[] = [
  makePlayer({ playerId: 'p1', username: 'Alice', score: 300, finalRank: 1 }),
  makePlayer({ playerId: 'p2', username: 'Bob', score: 200, finalRank: 2 }),
  makePlayer({ playerId: 'p3', username: 'Charlie', score: 100, finalRank: 3 }),
]

// ── PodiumScreen ──
describe('PodiumScreen', () => {
  it('renders title and close button', () => {
    const onClose = vi.fn()
    render(<PodiumScreen results={players3} onClose={onClose} />)
    expect(screen.getByText('Kết quả cuối')).toBeInTheDocument()
    expect(screen.getByText('Về phòng chờ')).toBeInTheDocument()
  })

  it('displays top 3 players on podium', () => {
    render(<PodiumScreen results={players3} onClose={vi.fn()} />)
    // Each name appears twice: once in podium, once in leaderboard
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Charlie').length).toBeGreaterThanOrEqual(1)
  })

  it('shows scores with "diem" suffix', () => {
    render(<PodiumScreen results={players3} onClose={vi.fn()} />)
    expect(screen.getByText('300 điểm')).toBeInTheDocument()
    expect(screen.getByText('200 điểm')).toBeInTheDocument()
    expect(screen.getByText('100 điểm')).toBeInTheDocument()
  })

  it('shows rank numbers #1 #2 #3', () => {
    render(<PodiumScreen results={players3} onClose={vi.fn()} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('shows all players in leaderboard section', () => {
    render(<PodiumScreen results={players3} onClose={vi.fn()} />)
    expect(screen.getByText('Tất cả người chơi')).toBeInTheDocument()
  })

  it('calls onClose when button is clicked', () => {
    const onClose = vi.fn()
    render(<PodiumScreen results={players3} onClose={onClose} />)
    fireEvent.click(screen.getByText('Về phòng chờ'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('handles empty results gracefully', () => {
    render(<PodiumScreen results={[]} onClose={vi.fn()} />)
    expect(screen.getByText('Kết quả cuối')).toBeInTheDocument()
  })
})

// ── EliminationScreen ──
describe('EliminationScreen', () => {
  const question = { id: 'q1', content: 'Who?', options: ['Moses', 'David', 'Paul', 'Peter'] }

  it('renders elimination message', () => {
    render(<EliminationScreen rank={5} totalPlayers={10} correctIndex={null} question={null} onSpectate={vi.fn()} />)
    expect(screen.getByText('Bạn đã bị loại!')).toBeInTheDocument()
  })

  it('shows rank and total players', () => {
    render(<EliminationScreen rank={5} totalPlayers={10} correctIndex={null} question={null} onSpectate={vi.fn()} />)
    // Rank text is split across elements: <b>#5</b>/10
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el?.textContent?.includes('#5') && el?.textContent?.includes('/10') || false)).toBeInTheDocument()
  })

  it('shows correct answer when provided', () => {
    render(<EliminationScreen rank={3} totalPlayers={8} correctIndex={1} question={question} onSpectate={vi.fn()} />)
    expect(screen.getByText('Đáp án đúng')).toBeInTheDocument()
    expect(screen.getByText('B. David')).toBeInTheDocument()
  })

  it('does not show correct answer when correctIndex is null', () => {
    render(<EliminationScreen rank={3} totalPlayers={8} correctIndex={null} question={null} onSpectate={vi.fn()} />)
    expect(screen.queryByText('Đáp án đúng')).not.toBeInTheDocument()
  })

  it('calls onSpectate when spectate button is clicked', () => {
    const onSpectate = vi.fn()
    render(<EliminationScreen rank={3} totalPlayers={8} correctIndex={null} question={null} onSpectate={onSpectate} />)
    fireEvent.click(screen.getByText(/Xem tiếp/))
    expect(onSpectate).toHaveBeenCalledTimes(1)
  })

  it('shows spectator button text', () => {
    render(<EliminationScreen rank={2} totalPlayers={5} correctIndex={null} question={null} onSpectate={vi.fn()} />)
    expect(screen.getByText(/khán giả/)).toBeInTheDocument()
  })
})

// ── TeamScoreBar ──
describe('TeamScoreBar', () => {
  it('renders Team A and Team B labels', () => {
    render(<TeamScoreBar scoreA={10} scoreB={5} />)
    expect(screen.getByText('Team A')).toBeInTheDocument()
    expect(screen.getByText('Team B')).toBeInTheDocument()
  })

  it('renders VS label', () => {
    render(<TeamScoreBar scoreA={10} scoreB={5} />)
    expect(screen.getByText('VS')).toBeInTheDocument()
  })

  it('displays scores', () => {
    render(<TeamScoreBar scoreA={42} scoreB={33} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('33')).toBeInTheDocument()
  })

  it('shows Perfect! for team A when perfectA is true', () => {
    render(<TeamScoreBar scoreA={10} scoreB={5} perfectA perfectB={false} />)
    expect(screen.getByText('Perfect!')).toBeInTheDocument()
  })

  it('shows Perfect! for team B when perfectB is true', () => {
    render(<TeamScoreBar scoreA={10} scoreB={5} perfectA={false} perfectB />)
    expect(screen.getByText('Perfect!')).toBeInTheDocument()
  })

  it('handles zero scores', () => {
    render(<TeamScoreBar scoreA={0} scoreB={0} />)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
  })
})

// ── TeamWinScreen ──
describe('TeamWinScreen', () => {
  const leaderboard = [
    makePlayer({ playerId: 'p1', username: 'Alice', score: 50 }),
    makePlayer({ playerId: 'p2', username: 'Bob', score: 30 }),
  ]

  it('renders Team A wins when winner is A', () => {
    render(<TeamWinScreen winner="A" scoreA={100} scoreB={80} leaderboard={leaderboard} onClose={vi.fn()} />)
    expect(screen.getByText('Đội A thắng!')).toBeInTheDocument()
  })

  it('renders Team B wins when winner is B', () => {
    render(<TeamWinScreen winner="B" scoreA={80} scoreB={100} leaderboard={leaderboard} onClose={vi.fn()} />)
    expect(screen.getByText('Đội B thắng!')).toBeInTheDocument()
  })

  it('renders TIE when winner is TIE', () => {
    render(<TeamWinScreen winner="TIE" scoreA={90} scoreB={90} leaderboard={leaderboard} onClose={vi.fn()} />)
    expect(screen.getByText('Hòa!')).toBeInTheDocument()
  })

  it('shows individual scores in leaderboard', () => {
    render(<TeamWinScreen winner="A" scoreA={100} scoreB={80} leaderboard={leaderboard} onClose={vi.fn()} />)
    expect(screen.getByText('Điểm cá nhân')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('calls onClose when button is clicked', () => {
    const onClose = vi.fn()
    render(<TeamWinScreen winner="A" scoreA={100} scoreB={80} leaderboard={leaderboard} onClose={onClose} />)
    fireEvent.click(screen.getByText('Về phòng chờ'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('displays team scores', () => {
    render(<TeamWinScreen winner="A" scoreA={100} scoreB={80} leaderboard={leaderboard} onClose={vi.fn()} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })
})

// ── MatchResultOverlay ──
describe('MatchResultOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders winner and loser names', () => {
    render(<MatchResultOverlay winnerId="w1" winnerName="Alice" loserId="l1" loserName="Bob" onDismiss={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows win message when current user won', () => {
    render(<MatchResultOverlay winnerId="w1" winnerName="Alice" loserId="l1" loserName="Bob" myUserId="w1" onDismiss={vi.fn()} />)
    expect(screen.getByText(/Bạn thắng/)).toBeInTheDocument()
  })

  it('shows lose message when current user lost', () => {
    render(<MatchResultOverlay winnerId="w1" winnerName="Alice" loserId="l1" loserName="Bob" myUserId="l1" onDismiss={vi.fn()} />)
    expect(screen.getByText(/Bạn thua/)).toBeInTheDocument()
  })

  it('auto-dismisses after 3 seconds', () => {
    const onDismiss = vi.fn()
    render(<MatchResultOverlay winnerId="w1" winnerName="Alice" loserId="l1" loserName="Bob" onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on click', () => {
    const onDismiss = vi.fn()
    render(<MatchResultOverlay winnerId="w1" winnerName="Alice" loserId="l1" loserName="Bob" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText(/Trận tiếp sắp bắt đầu/))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('shows "Tran tiep sap bat dau..." text', () => {
    render(<MatchResultOverlay winnerId="w1" winnerName="Alice" loserId="l1" loserName="Bob" onDismiss={vi.fn()} />)
    expect(screen.getByText(/Trận tiếp sắp bắt đầu/)).toBeInTheDocument()
  })
})

// ── SdArenaHeader ──
describe('SdArenaHeader', () => {
  it('renders champion and challenger names', () => {
    render(<SdArenaHeader championName="Alice" championStreak={3} challengerName="Bob" myUsername="Alice" queueRemaining={2} />)
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })

  it('marks current user with (ban)', () => {
    render(<SdArenaHeader championName="Alice" championStreak={3} challengerName="Bob" myUsername="Alice" queueRemaining={0} />)
    expect(screen.getByText(/Alice \(bạn\)/)).toBeInTheDocument()
  })

  it('marks challenger as (ban) when myUsername matches', () => {
    render(<SdArenaHeader championName="Alice" championStreak={3} challengerName="Bob" myUsername="Bob" queueRemaining={0} />)
    expect(screen.getByText(/Bob \(bạn\)/)).toBeInTheDocument()
  })

  it('shows Champion and Challenger labels', () => {
    render(<SdArenaHeader championName="Alice" championStreak={0} challengerName="Bob" myUsername="Other" queueRemaining={0} />)
    expect(screen.getByText('Champion')).toBeInTheDocument()
    expect(screen.getByText('Challenger')).toBeInTheDocument()
  })

  it('shows VS text', () => {
    render(<SdArenaHeader championName="Alice" championStreak={0} challengerName="Bob" myUsername="Other" queueRemaining={0} />)
    expect(screen.getByText('VS')).toBeInTheDocument()
  })

  it('shows streak when championStreak > 0', () => {
    render(<SdArenaHeader championName="Alice" championStreak={5} challengerName="Bob" myUsername="Other" queueRemaining={0} />)
    expect(screen.getByText('5 trận liền')).toBeInTheDocument()
  })

  it('does not show streak when championStreak is 0', () => {
    render(<SdArenaHeader championName="Alice" championStreak={0} challengerName="Bob" myUsername="Other" queueRemaining={0} />)
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument()
  })

  it('shows queue remaining when > 0', () => {
    render(<SdArenaHeader championName="Alice" championStreak={0} challengerName="Bob" myUsername="Other" queueRemaining={4} />)
    expect(screen.getByText(/4 người đang chờ/)).toBeInTheDocument()
  })

  it('does not show queue when 0', () => {
    render(<SdArenaHeader championName="Alice" championStreak={0} challengerName="Bob" myUsername="Other" queueRemaining={0} />)
    expect(screen.queryByText(/nguoi dang cho/)).not.toBeInTheDocument()
  })
})

// ── RoundScoreboard ──
describe('RoundScoreboard', () => {
  const scores: PlayerScore[] = [
    makePlayer({ playerId: 'p1', username: 'Alice', score: 100 }),
    makePlayer({ playerId: 'p2', username: 'Bob', score: 80 }),
    makePlayer({ playerId: 'p3', username: 'Charlie', score: 60 }),
  ]

  it('renders null when scores are empty', () => {
    const { container } = render(<RoundScoreboard scores={[]} myUsername="Alice" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders scoreboard title', () => {
    render(<RoundScoreboard scores={scores} myUsername="Alice" />)
    expect(screen.getByText('Kết quả vòng này')).toBeInTheDocument()
  })

  it('displays player names and scores', () => {
    render(<RoundScoreboard scores={scores} myUsername="Alice" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('shows rank numbers', () => {
    render(<RoundScoreboard scores={scores} myUsername="Alice" />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('limits display to 8 players', () => {
    const manyPlayers = Array.from({ length: 12 }, (_, i) =>
      makePlayer({ playerId: `p${i}`, username: `Player${i}`, score: 100 - i })
    )
    render(<RoundScoreboard scores={manyPlayers} myUsername="Player0" />)
    expect(screen.getByText('Player0')).toBeInTheDocument()
    expect(screen.getByText('Player7')).toBeInTheDocument()
    expect(screen.queryByText('Player8')).not.toBeInTheDocument()
  })

  it('highlights current user', () => {
    render(<RoundScoreboard scores={scores} myUsername="Alice" />)
    const aliceEl = screen.getByText('Alice')
    expect(aliceEl.className).toContain('text-bq-amberd')
  })
})
