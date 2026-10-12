import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

import QuestionEditPage from '../QuestionEditPage'

/** AIR-4 (13/10/2026): soạn câu trong Quản trị vẫn có bảng tự kiểm, không còn "Đề xuất từ AI". */
describe('QuestionEditPage', () => {
  it('câu mới: còn bảng tự kiểm chất lượng, không còn nút đề xuất AI', () => {
    render(<MemoryRouter><QuestionEditPage /></MemoryRouter>)
    expect(screen.getByTestId('quality-eval-result')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-suggest-btn')).toBeNull()
  })
})
