import { describe, it, expect } from 'vitest'
import { anchorQuestionStart, coreGameReducer, initialCoreGameState, normalizeQuizEnd } from '../roomQuizCore'
import type { QuestionStartData } from '../../../types/room'

const NOW = 1_700_000_000_000

const q = (startedAtMs?: number, timeLimit = 20): QuestionStartData => ({
  questionIndex: 0,
  totalQuestions: 10,
  question: { id: 'q1', content: 'Câu hỏi', options: ['A', 'B', 'C', 'D'] },
  timeLimit,
  startedAtMs,
})

describe('anchorQuestionStart (PCV-3 — chống đồng hồ máy lệch)', () => {
  it('câu vừa phát: dùng mốc máy chủ khi lệch ≤ 2 s', () => {
    expect(anchorQuestionStart(q(NOW - 500), NOW, true)).toBe(NOW - 500)
  })

  it('câu vừa phát mà mốc máy chủ lệch > 2 s: đồng hồ máy lệch → dùng giờ máy', () => {
    expect(anchorQuestionStart(q(NOW - 10_000), NOW, true)).toBe(NOW)
    expect(anchorQuestionStart(q(NOW + 5_000), NOW, true)).toBe(NOW)
  })

  it('vào lại giữa câu: chấp nhận mốc trong phạm vi câu còn chạy', () => {
    expect(anchorQuestionStart(q(NOW - 8_000), NOW, false)).toBe(NOW - 8_000)
  })

  it('vào lại giữa câu: mốc ở tương lai hoặc quá cũ so với độ dài câu → giờ máy', () => {
    expect(anchorQuestionStart(q(NOW + 5_000), NOW, false)).toBe(NOW)
    expect(anchorQuestionStart(q(NOW - 40_000, 20), NOW, false)).toBe(NOW)
  })

  it('không có mốc máy chủ → giờ máy', () => {
    expect(anchorQuestionStart(q(undefined), NOW, true)).toBe(NOW)
  })
})

describe('coreGameReducer — dữ liệu công bố (PCV-3)', () => {
  it('ROUND_END lưu giải thích/câu gốc/số người chọn; QUESTION_START xoá', () => {
    const reveal = {
      explanation: 'Giải thích',
      reference: { book: 'Genesis', chapter: 1, verseStart: 1, verseEnd: 2 },
      answerCounts: [1, 0, 2, 0],
      results: [{ playerId: 'u1', answered: true, isCorrect: true, pointsEarned: 140, streak: 0 }],
    }
    const after = coreGameReducer(initialCoreGameState, { type: 'ROUND_END', correctIndex: 2, scores: [], reveal })
    expect(after.correctIndex).toBe(2)
    expect(after.reveal).toEqual(reveal)

    const next = coreGameReducer(after, { type: 'QUESTION_START', data: q(NOW) })
    expect(next.reveal).toBeNull()
    expect(next.correctIndex).toBeNull()
  })
})

describe('coreGameReducer — Phòng chơi v2 đợt 2 (PCV-11)', () => {
  it('QUESTION_START lưu hệ số + cờ câu; thiếu trường thì ×1, không cờ', () => {
    const s1 = coreGameReducer(initialCoreGameState, { type: 'QUESTION_START', data: { ...q(NOW), multiplier: 2, dangerZone: true, showdown: true } })
    expect(s1.multiplier).toBe(2)
    expect(s1.dangerZone).toBe(true)
    expect(s1.showdown).toBe(true)
    const s2 = coreGameReducer(s1, { type: 'QUESTION_START', data: q(NOW) })
    expect(s2.multiplier).toBe(1)
    expect(s2.dangerZone).toBe(false)
    expect(s2.showdown).toBe(false)
  })

  it('ROUND_END giữ bảng điểm trước để tính lên/xuống hạng', () => {
    const before = [{ playerId: 'a', username: 'An', score: 300 }, { playerId: 'b', username: 'Bình', score: 200 }]
    const after = [{ playerId: 'b', username: 'Bình', score: 450 }, { playerId: 'a', username: 'An', score: 300 }]
    const s1 = coreGameReducer({ ...initialCoreGameState, scores: before }, { type: 'ROUND_END', correctIndex: 1, scores: after })
    expect(s1.previousScores).toEqual(before)
    expect(s1.scores).toEqual(after)
  })
})

describe('normalizeQuizEnd — QUIZ_END mọi mode (PCV-19)', () => {
  const p = (id: string, rank?: number) => ({ playerId: id, username: id, score: 100, correctAnswers: 1, totalAnswered: 2, accuracy: 50, finalRank: rank })

  it('Đội đấu đội: máy chủ bọc kết quả đội trong finalResults — vẫn lấy được đội thắng + bảng', () => {
    const data = { roomId: 'r', timestamp: 1, finalResults: { teamWinner: 'A', scoreA: 980, scoreB: 363, leaderboard: [p('a', 1), p('b', 2)] } }
    const n = normalizeQuizEnd(data)
    expect(n.teamWinner).toBe('A')
    expect(n.scoreA).toBe(980)
    expect(n.scoreB).toBe(363)
    expect(n.results.map(r => r.playerId)).toEqual(['a', 'b'])
  })

  it('các mode khác: finalResults là danh sách', () => {
    const n = normalizeQuizEnd({ roomId: 'r', timestamp: 1, finalResults: [p('x', 1)] })
    expect(n.results).toHaveLength(1)
    expect(n.teamWinner).toBeNull()
  })

  it('dạng cũ: chính là danh sách', () => {
    expect(normalizeQuizEnd([p('y')]).results).toHaveLength(1)
  })

  it('trống hoặc hỏng: danh sách rỗng', () => {
    expect(normalizeQuizEnd(null).results).toEqual([])
    expect(normalizeQuizEnd({ finalResults: 'x' }).results).toEqual([])
  })
})
