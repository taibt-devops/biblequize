import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import QuizSetEditor, { type QuizSetEditorApi } from '../QuizSetEditor'

const question = {
  id: 'q1', book: 'Sáng Thế Ký', chapter: 1, verseStart: null, verseEnd: null, difficulty: 'easy', type: 'single',
  content: 'Ai đã tạo nên trời và đất?', options: ['Đức Chúa Trời', 'Môi-se', 'Áp-ra-ham', 'Nô-ê'], correctAnswer: [0],
  explanation: '', source: 'group-custom', language: 'vi',
}

function adapter(): QuizSetEditorApi {
  return {
    createQuizSet: vi.fn(),
    updateQuizSet: vi.fn(),
    publishQuizSet: vi.fn(),
    getQuizSetFull: vi.fn().mockResolvedValue({
      id: 's1', groupId: 'g1', name: 'Bộ thử', questionIds: ['q1'], totalQuestions: 1, createdBy: 'u1',
      createdAt: '2026-10-13T00:00:00', language: 'vi', playCount: 0, totalRatings: 0, publishStatus: 'DRAFT',
      questions: [question],
    }),
    addQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  } as unknown as QuizSetEditorApi
}

/** AIR-2/3 (13/10/2026): bỏ sinh câu bằng AI — trình soạn bộ câu (nhóm + cá nhân) chỉ còn soạn tay. */
describe('QuizSetEditor — không còn AI', () => {
  it('bộ câu nhóm: không còn "AI tạo nháp", "AI viết lại", hạn mức AI', async () => {
    render(
      <MemoryRouter>
        <QuizSetEditor setIdFromRoute="s1" ownership="group" ownerName="Nhóm" backHref="/groups/g1"
                       editPathBase="/groups/g1/quiz-sets/" detailPathBase="/groups/g1/quiz-sets/" api={adapter()} />
      </MemoryRouter>,
    )
    expect(await screen.findByDisplayValue('Ai đã tạo nên trời và đất?')).toBeInTheDocument()
    expect(screen.queryByText(/AI tạo nháp/)).toBeNull()
    expect(screen.queryByText(/AI viết lại/)).toBeNull()
    expect(screen.queryByText(/AI: \d+\/\d+/)).toBeNull()
    // Vẫn thêm câu bằng tay được.
    expect(screen.getByText(/Thêm thủ công/)).toBeInTheDocument()
  })
})
