import { describe, it, expect } from 'vitest'
import { anchorQuestionStart, coreGameReducer, initialCoreGameState } from '../roomQuizCore'
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
