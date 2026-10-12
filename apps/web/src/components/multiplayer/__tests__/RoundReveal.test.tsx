import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import RoundReveal from '../RoundReveal'

vi.mock('../../../api/client', () => ({ api: { post: vi.fn(() => Promise.resolve({})) } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'room.reveal.reference': 'Câu gốc',
        'room.reveal.explanation': 'Giải thích',
        'room.reveal.showExplanation': 'Xem giải thích',
        'room.reveal.hideExplanation': 'Ẩn giải thích',
        'room.reveal.distribution': 'Mọi người đã chọn',
        'room.reveal.save': 'Lưu câu này để ôn',
        'room.reveal.saved': 'Đã lưu để ôn',
      }
      if (k === 'room.reveal.people') return `${o?.count} người`
      if (k === 'room.reveal.streak') return `Chuỗi ${o?.n} · +${o?.bonus}`
      return map[k] ?? k
    },
  }),
}))

const base = {
  questionId: 'q1',
  correctIndex: 2,
  referenceLabel: 'Sáng Thế Ký 27:5–8',
  explanation: 'Rê-bê-ca nghe Y-sác nói với Ê-sau.',
  answerCounts: [1, 0, 3, 0],
}

describe('RoundReveal (PCV-3)', () => {
  it('trả lời sai: hiện câu gốc và giải thích mở sẵn', () => {
    render(<RoundReveal {...base} selected={0} />)
    expect(screen.getByText('Sáng Thế Ký 27:5–8')).toBeInTheDocument()
    expect(screen.getByText('Rê-bê-ca nghe Y-sác nói với Ê-sau.')).toBeInTheDocument()
  })

  it('trả lời đúng: giải thích gập lại, bấm mới hiện', () => {
    render(<RoundReveal {...base} selected={2} />)
    expect(screen.queryByText('Rê-bê-ca nghe Y-sác nói với Ê-sau.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem giải thích' }))
    expect(screen.getByText('Rê-bê-ca nghe Y-sác nói với Ê-sau.')).toBeInTheDocument()
  })

  it('không trả lời: giải thích mở sẵn', () => {
    render(<RoundReveal {...base} selected={null} />)
    expect(screen.getByText('Rê-bê-ca nghe Y-sác nói với Ê-sau.')).toBeInTheDocument()
  })

  it('hiện số người chọn từng phương án, đánh dấu phương án đúng', () => {
    render(<RoundReveal {...base} selected={0} />)
    const rows = screen.getAllByTestId(/reveal-dist-/)
    expect(rows).toHaveLength(4)
    expect(screen.getByTestId('reveal-dist-2')).toHaveAttribute('data-correct', 'true')
    expect(screen.getByTestId('reveal-dist-2')).toHaveTextContent('3 người')
  })

  it('không có giải thích, không có câu gốc: chỉ còn phần số người chọn', () => {
    render(<RoundReveal {...base} explanation={null} referenceLabel={null} selected={1} />)
    expect(screen.queryByRole('button', { name: 'Xem giải thích' })).toBeNull()
    expect(screen.queryByText('Câu gốc')).toBeNull()
    expect(screen.getByText('Mọi người đã chọn')).toBeInTheDocument()
  })
})

describe('RoundReveal — chuỗi đúng (PCV-11)', () => {
  it('đúng liên tiếp từ 2 câu: hiện "Chuỗi n · +x"', () => {
    render(<RoundReveal {...base} selected={2} streak={3} streakBonus={20} />)
    expect(screen.getByTestId('round-reveal-streak').textContent).toBe('Chuỗi 3 · +20')
  })

  it('chuỗi < 2 hoặc không có thưởng: không hiện', () => {
    render(<RoundReveal {...base} selected={2} streak={1} streakBonus={0} />)
    expect(screen.queryByTestId('round-reveal-streak')).toBeNull()
  })
})
