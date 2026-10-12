import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChallengeWaitingDialog from '../ChallengeWaitingDialog'
import ChallengeInviteWatcher from '../ChallengeInviteWatcher'

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('../../../api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})


describe('ChallengeWaitingDialog (PCV-23)', () => {
  beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); mockNavigate.mockReset() })

  it('người kia nhận lời ⇒ vào sảnh phòng thách đấu', async () => {
    mockGet.mockResolvedValue({ data: { status: 'ACCEPTED', roomId: 'room-9' } })
    render(<MemoryRouter><ChallengeWaitingDialog challengeId="ch-1" name="Lan" secondsLeft={240} onClose={vi.fn()} /></MemoryRouter>)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/room/room-9/lobby'))
  })

  it('đang chờ: hiện tên + đếm ngược, bấm Hủy thì hủy lời thách', async () => {
    mockGet.mockResolvedValue({ data: { status: 'PENDING' } })
    mockPost.mockResolvedValue({ data: { status: 'CANCELLED' } })
    const onClose = vi.fn()
    render(<MemoryRouter><ChallengeWaitingDialog challengeId="ch-1" name="Lan" secondsLeft={240} onClose={onClose} /></MemoryRouter>)
    expect(screen.getByTestId('challenge-waiting').textContent).toMatch(/Lan/)
    expect(screen.getByTestId('challenge-waiting').textContent).toMatch(/[34]:\d\d/)
    fireEvent.click(screen.getByTestId('challenge-cancel'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/challenges/ch-1/cancel'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('rời hộp chờ (chuyển trang) khi còn chờ ⇒ tự hủy lời thách', async () => {
    mockGet.mockResolvedValue({ data: { status: 'PENDING' } })
    mockPost.mockResolvedValue({ data: { status: 'CANCELLED' } })
    const { unmount } = render(<MemoryRouter><ChallengeWaitingDialog challengeId="ch-1" name="Lan" secondsLeft={240} onClose={vi.fn()} /></MemoryRouter>)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/challenges/ch-1/cancel'))
  })

  it('đã vào sảnh (nhận lời) thì rời hộp chờ không hủy', async () => {
    mockGet.mockResolvedValue({ data: { status: 'ACCEPTED', roomId: 'room-9' } })
    const { unmount } = render(<MemoryRouter><ChallengeWaitingDialog challengeId="ch-1" name="Lan" secondsLeft={240} onClose={vi.fn()} /></MemoryRouter>)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/room/room-9/lobby'))
    unmount()
    await new Promise(r => setTimeout(r, 50))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('bị từ chối: báo cho người thách', async () => {
    mockGet.mockResolvedValue({ data: { status: 'DECLINED' } })
    render(<MemoryRouter><ChallengeWaitingDialog challengeId="ch-1" name="Lan" secondsLeft={240} onClose={vi.fn()} /></MemoryRouter>)
    expect(await screen.findByTestId('challenge-declined')).toBeInTheDocument()
  })
})

describe('ChallengeInviteWatcher (PCV-23)', () => {
  beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); mockNavigate.mockReset() })

  it('có lời thách: hiện hộp mời; Nhận ⇒ vào sảnh', async () => {
    mockGet.mockResolvedValue({ data: [{ challengeId: 'ch-1', challengerName: 'Minh', challengerId: 'minh', secondsLeft: 240 }] })
    mockPost.mockResolvedValue({ data: { status: 'ACCEPTED', roomId: 'room-9', roomCode: 'DUEL99' } })
    render(<MemoryRouter><ChallengeInviteWatcher /></MemoryRouter>)
    expect((await screen.findByTestId('challenge-invite')).textContent).toMatch(/Minh/)
    fireEvent.click(screen.getByTestId('challenge-accept'))
    // Phòng dùng ngôn ngữ câu hỏi của người nhận lời.
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/challenges/ch-1/accept', { language: 'vi' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/room/room-9/lobby'))
  })

  it('Để sau ⇒ từ chối và đóng hộp', async () => {
    mockGet.mockResolvedValue({ data: [{ challengeId: 'ch-1', challengerName: 'Minh', challengerId: 'minh', secondsLeft: 240 }] })
    mockPost.mockResolvedValue({ data: { status: 'DECLINED' } })
    render(<MemoryRouter><ChallengeInviteWatcher /></MemoryRouter>)
    fireEvent.click(await screen.findByTestId('challenge-later'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/challenges/ch-1/decline'))
    await waitFor(() => expect(screen.queryByTestId('challenge-invite')).toBeNull())
  })

  it('không có lời thách: không hiện gì', async () => {
    mockGet.mockResolvedValue({ data: [] })
    render(<MemoryRouter><ChallengeInviteWatcher /></MemoryRouter>)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/challenges/pending'))
    expect(screen.queryByTestId('challenge-invite')).toBeNull()
  })
})
