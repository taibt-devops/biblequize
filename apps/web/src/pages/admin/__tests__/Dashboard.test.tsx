import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockApiGet = vi.fn()
vi.mock('../../../api/client', () => ({ api: { get: (...a: any[]) => mockApiGet(...a) } }))

import AdminDashboard from '../Dashboard'

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter><AdminDashboard /></MemoryRouter></QueryClientProvider>)
}

// Dashboard trimmed to core (ADM-2, 2026-06-16): only kpis + questionQueue.pendingReview
// + coverage are real. actionItems / recentActivity / sessions+userReg charts removed.
const FULL_DATA = {
  kpis: { totalUsers: 1247, totalQuestions: 3420, pendingReview: 23, activeSessions: 856, activeUsers: 342 },
  questionQueue: { pendingReview: 23 },
}

describe('Admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/dashboard')) return Promise.resolve({ data: FULL_DATA })
      if (url.includes('/coverage')) return Promise.resolve({ data: { books: [
        { book: 'Genesis', easy: 30, medium: 20, hard: 10, total: 60, meetsMinimum: true },
      ] } })
      return Promise.reject(new Error('Not found'))
    })
  })

  it('renders KPI values without dashes', async () => {
    renderDashboard()
    await waitFor(() => { expect(screen.getByText('1,247')).toBeInTheDocument() })
    expect(screen.getByText(/3,420/)).toBeInTheDocument()
    expect(screen.getByText('856')).toBeInTheDocument()
  })

  it('renders KPI as 0 when null, not dash', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/dashboard')) return Promise.resolve({ data: {
        kpis: { totalUsers: 0, totalQuestions: 0, pendingReview: 0 },
        questionQueue: { pendingReview: 0 },
      } })
      if (url.includes('/coverage')) return Promise.resolve({ data: { books: [] } })
      return Promise.reject(new Error('Not found'))
    })
    renderDashboard()
    await waitFor(() => { expect(screen.getByText('Phiên hôm nay')).toBeInTheDocument() })
    // Should show "0" not "—"
    const sessionCard = screen.getByText('Phiên hôm nay').closest('div')!
    expect(sessionCard.textContent).toContain('0')
    expect(sessionCard.textContent).not.toContain('—')
  })

  it('renders Question Queue panel (pending review only)', async () => {
    renderDashboard()
    await waitFor(() => { expect(screen.getByText('Hàng đợi câu hỏi')).toBeInTheDocument() })
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('Duyệt 50 câu tiếp')).toBeInTheDocument()
    // Removed placeholder rows
    expect(screen.queryByText('AI tạo')).not.toBeInTheDocument()
  })

  it('does not render removed placeholder panels', async () => {
    renderDashboard()
    await waitFor(() => { expect(screen.getByText('Hàng đợi câu hỏi')).toBeInTheDocument() })
    expect(screen.queryByText('Cần xử lý')).not.toBeInTheDocument()
    expect(screen.queryByText('Hoạt động Admin')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessions 7 ngày qua')).not.toBeInTheDocument()
    expect(screen.queryByText('User registrations 30 ngày')).not.toBeInTheDocument()
  })

  it('renders coverage chart', async () => {
    renderDashboard()
    await waitFor(() => { expect(screen.getByText(/Độ phủ câu hỏi/)).toBeInTheDocument() })
  })

  it('shows skeleton during loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    renderDashboard()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network'))
    renderDashboard()
    await waitFor(() => { expect(document.body).toBeInTheDocument() })
  })

  it('AIR-4: không còn thẻ KPI "AI hôm nay"', async () => {
    renderDashboard()
    await waitFor(() => { expect(screen.getByText('1,247')).toBeInTheDocument() })
    expect(screen.queryByText('AI hôm nay')).toBeNull()
  })
})
