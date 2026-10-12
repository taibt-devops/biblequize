import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RoomQuizShell from '../RoomQuizShell'
import { initialCoreGameState, type CoreGameState } from '../roomQuizCore'
import { useBattleRoyale } from '../hooks/useBattleRoyale'
import { useTeamVsTeam } from '../hooks/useTeamVsTeam'
import { useSuddenDeath } from '../hooks/useSuddenDeath'
import { useSequentialMode } from '../hooks/useSequentialMode'
import type { PlayerScore } from '../../../types/room'

vi.mock('../../../api/client', () => ({ api: { post: vi.fn(() => Promise.resolve({})), get: vi.fn(() => Promise.resolve({ data: {} })) } }))

const question = { id: 'q1', content: 'Ai dẫn dân Y-sơ-ra-ên qua Biển Đỏ?', options: ['Môi-se', 'A-rôn', 'Giô-suê', 'Ca-lép'] }
const players = (scores: number[]): PlayerScore[] =>
  scores.map((s, i) => ({ playerId: `p${i}`, username: `Người ${i}`, score: s }))

function Harness({ core, gameMode = 'SPEED_RACE' }: { core: CoreGameState; gameMode?: string }) {
  const br = useBattleRoyale('p0')
  const team = useTeamVsTeam('p0', null)
  const sd = useSuddenDeath('p0')
  const seq = useSequentialMode()
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>
      <RoomQuizShell
        gameMode={gameMode} isBattleRoyale={gameMode === 'BATTLE_ROYALE'} isTeamVsTeam={gameMode === 'TEAM_VS_TEAM'}
        isSuddenDeath={gameMode === 'SUDDEN_DEATH'} isSequential={false} isHost={false}
        myUserId="p0" myUsername="Người 0" showHostHint={false} connected reconnecting={false}
        core={core} timeLeft={10} isPaused={false} skipToast={false} hostBroadcast={null}
        reactions={[]} feedHistory={[]} roundAnswered={new Set()} comboBanner={null} onDismissCombo={() => {}}
        revealStats={null} br={br.state} team={team.state} sd={sd.state} seq={seq.state}
        onDismissSdResult={() => {}} onSubmitAnswer={() => {}} onAdvance={() => {}} onSendReaction={() => {}}
      />
    </MemoryRouter>
    </QueryClientProvider>
  )
}

const playing = (over: Partial<CoreGameState> = {}): CoreGameState => ({
  ...initialCoreGameState, question, questionIndex: 0, totalQuestions: 10, timeLimit: 20, ...over,
})

describe('RoomQuizShell — Phòng chơi v2 (PCV-9/11)', () => {
  it('thanh trên hiện tên mode tiếng Việt, không phải mã mode', () => {
    render(<Harness core={playing()} />)
    expect(screen.getByTestId('quiz-header-mode').textContent).toBe('Đua tốc độ')
    expect(screen.queryByText('SPEED RACE')).toBeNull()
  })

  it('câu chốt: hiện "Câu chốt · ×2"', () => {
    render(<Harness core={playing({ questionIndex: 9, multiplier: 2 })} />)
    expect(screen.getByTestId('quiz-final-question').textContent).toMatch(/Câu chốt.*×2/)
  })

  it('không phải câu chốt thì không hiện', () => {
    render(<Harness core={playing({ questionIndex: 3 })} />)
    expect(screen.queryByTestId('quiz-final-question')).toBeNull()
  })

  it('Đua tốc độ: sau câu 3 hiện bảng 5 người dẫn đầu kèm lên/xuống hạng', () => {
    const before = players([500, 400, 300, 200, 100, 50])
    const after = [before[1], before[0], before[2], before[3], before[5], before[4]].map((p, i) => ({ ...p, score: 900 - i * 100 }))
    render(<Harness core={playing({
      questionIndex: 2, correctIndex: 0, selected: 0, scores: after, previousScores: before,
      reveal: { answerCounts: [3, 1, 1, 1], results: [] },
    })} />)
    const flash = screen.getByTestId('standings-flash')
    const rows = flash.querySelectorAll('[data-testid^="standings-row-"]')
    expect(rows.length).toBe(5)
    expect(rows[0].getAttribute('data-move')).toBe('up')
    expect(rows[1].getAttribute('data-move')).toBe('down')
    expect(rows[2].getAttribute('data-move')).toBe('same')
    expect(rows[4].getAttribute('data-move')).toBe('up')
  })

  it('không hiện bảng dẫn đầu ở câu cuối hoặc ở câu không chia hết cho 3', () => {
    const s = players([300, 200])
    const { unmount } = render(<Harness core={playing({ questionIndex: 9, correctIndex: 0, scores: s, previousScores: s, reveal: {} })} />)
    expect(screen.queryByTestId('standings-flash')).toBeNull()
    unmount()
    render(<Harness core={playing({ questionIndex: 3, correctIndex: 0, scores: s, previousScores: s, reveal: {} })} />)
    expect(screen.queryByTestId('standings-flash')).toBeNull()
  })
})

describe('RoomQuizShell — Sinh tồn (PCV-12)', () => {
  it('bảng người chơi hiện tim (mạng) thay cho điểm', () => {
    const scores = [
      { playerId: 'p0', username: 'Người 0', score: 950, correctAnswers: 6, totalAnswered: 7, accuracy: 85, lives: 2, playerStatus: 'ACTIVE' },
      { playerId: 'p1', username: 'Người 1', score: 980, correctAnswers: 6, totalAnswered: 7, accuracy: 85, lives: 1, playerStatus: 'ACTIVE' },
      { playerId: 'p2', username: 'Người 2', score: 400, correctAnswers: 2, totalAnswered: 4, accuracy: 50, lives: 0, playerStatus: 'ELIMINATED' },
    ]
    render(<Harness gameMode="BATTLE_ROYALE" core={playing({ scores })} />)
    const board = screen.getByTestId('quiz-scoreboard-left')
    expect(board.querySelector('[data-testid="lives-p0"]')?.getAttribute('data-lives')).toBe('2')
    expect(board.querySelector('[data-testid="lives-p1"]')?.getAttribute('data-lives')).toBe('1')
    expect(board.textContent).not.toContain('950')
    // còn nhiều mạng xếp trên dù ít điểm hơn
    const rows = Array.from(board.querySelectorAll('[data-testid^="lives-"]')).map(n => n.getAttribute('data-testid'))
    expect(rows[0]).toBe('lives-p0')
  })

  it('vùng nguy hiểm và câu quyết định có nhãn riêng', () => {
    const { unmount } = render(<Harness gameMode="BATTLE_ROYALE" core={playing({ questionIndex: 11, dangerZone: true })} />)
    expect(screen.getByTestId('quiz-danger-zone').textContent).toMatch(/Vùng nguy hiểm/)
    expect(screen.queryByTestId('quiz-showdown')).toBeNull()
    unmount()
    render(<Harness gameMode="BATTLE_ROYALE" core={playing({ questionIndex: 15, dangerZone: true, showdown: true })} />)
    expect(screen.getByTestId('quiz-showdown').textContent).toMatch(/Câu quyết định/)
  })
})

describe('RoomQuizShell — bóng Sinh tồn (PCV-13)', () => {
  const ghostScores = (ghostStreak: number, revived = false) => [
    { playerId: 'p1', username: 'Người 1', score: 500, correctAnswers: 4, totalAnswered: 4, accuracy: 100, lives: 2, playerStatus: 'ACTIVE' },
    { playerId: 'p0', username: 'Người 0', score: 100, correctAnswers: 1, totalAnswered: 3, accuracy: 33, lives: 0, playerStatus: 'ELIMINATED', ghostStreak, revived },
  ]

  function GhostHarness({ core }: { core: CoreGameState }) {
    // Người xem p0 đã bị loại và chọn trả lời tiếp dưới dạng bóng.
    const br = useBattleRoyale('p0')
    const team = useTeamVsTeam('p0', null)
    const sd = useSuddenDeath('p0')
    const seq = useSequentialMode()
    const ghostState = { ...br.state, isEliminated: true, isSpectator: true }
    return (
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RoomQuizShell
            gameMode="BATTLE_ROYALE" isBattleRoyale isTeamVsTeam={false} isSuddenDeath={false} isSequential={false} isHost={false}
            myUserId="p0" myUsername="Người 0" showHostHint={false} connected reconnecting={false}
            core={core} timeLeft={10} isPaused={false} skipToast={false} hostBroadcast={null}
            reactions={[]} feedHistory={[]} roundAnswered={new Set()} comboBanner={null} onDismissCombo={() => {}}
            revealStats={null} br={ghostState} team={team.state} sd={sd.state} seq={seq.state}
            onDismissSdResult={() => {}} onSubmitAnswer={() => {}} onAdvance={() => {}} onSendReaction={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('còn kịp: "Đúng N câu liên tiếp nữa để hồi sinh (còn M câu)"', () => {
    render(<GhostHarness core={playing({ questionIndex: 3, scores: ghostScores(1) })} />)
    expect(screen.getByTestId('quiz-ghost-hint').textContent).toMatch(/Đúng 2 câu liên tiếp nữa để hồi sinh \(còn 6 câu\)/)
  })

  it('không còn kịp hoặc đã hồi sinh một lần: báo vẫn trả lời được để luyện', () => {
    const { unmount } = render(<GhostHarness core={playing({ questionIndex: 8, scores: ghostScores(0) })} />)
    expect(screen.getByTestId('quiz-ghost-hint').textContent).toMatch(/vẫn trả lời được/)
    unmount()
    render(<GhostHarness core={playing({ questionIndex: 2, scores: ghostScores(2, true) })} />)
    expect(screen.getByTestId('quiz-ghost-hint').textContent).toMatch(/đã dùng lượt hồi sinh/)
  })

  it('bóng vẫn bấm được đáp án', () => {
    render(<GhostHarness core={playing({ questionIndex: 3, scores: ghostScores(0) })} />)
    const answer = screen.getByText('Môi-se').closest('button')
    expect(answer?.hasAttribute('disabled')).toBe(false)
  })
})

describe('RoomQuizShell — Đấu vương (PCV-15)', () => {
  it('bảng người chơi ghi số trận thắng', () => {
    const scores = [
      { playerId: 'p0', username: 'Người 0', score: 200, correctAnswers: 3, totalAnswered: 4, accuracy: 75, matchesWon: 2 },
      { playerId: 'p1', username: 'Người 1', score: 300, correctAnswers: 4, totalAnswered: 5, accuracy: 80, matchesWon: 0 },
    ]
    render(<Harness gameMode="SUDDEN_DEATH" core={playing({ scores })} />)
    const board = screen.getByTestId('quiz-scoreboard-left')
    expect(board.querySelector('[data-testid="sd-wins-p0"]')?.textContent).toBe('2 thắng')
  })
})
