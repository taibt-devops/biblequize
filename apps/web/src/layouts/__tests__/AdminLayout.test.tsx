import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: { name: 'Admin', role: 'ADMIN' }, logout: vi.fn() }),
}))

import AdminLayout from '../AdminLayout'

function renderLayout(route = '/admin') {
  return render(<MemoryRouter initialEntries={[route]}><AdminLayout /></MemoryRouter>)
}

describe('AdminLayout', () => {
  it('renders branding', () => {
    renderLayout()
    expect(screen.getByText('BIBLEQUIZ')).toBeInTheDocument()
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('renders the 7 core + Tier B nav items (i18n VI)', () => {
    renderLayout()
    // nav labels are i18n-ized; test runs under VI
    const items = ['Người dùng', 'Câu hỏi', 'Hàng đợi duyệt',
      'Phản hồi', 'Nhóm']
    for (const item of items) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
    expect(screen.getByText('Tổng quan')).toBeInTheDocument()
  })

  it('AIR-4: không còn mục "Trình tạo AI" (bỏ sinh câu bằng AI)', () => {
    renderLayout()
    expect(screen.queryByText('Trình tạo AI')).toBeNull()
  })

  it('hides Tier C nav items (ADM-1)', () => {
    renderLayout()
    const hidden = ['Seasons & Rankings', 'Events & Tournaments', 'Notifications',
      'Configuration', 'Export Center', 'Question Quality', 'Early Unlock']
    for (const item of hidden) {
      expect(screen.queryByText(item)).not.toBeInTheDocument()
    }
  })

  it('header has no placeholder controls or redundant CTA', () => {
    renderLayout()
    // search box, history/bell, and the New-question CTA were all removed
    expect(screen.queryByPlaceholderText('Search analytics or logs...')).not.toBeInTheDocument()
    expect(screen.queryByText('history')).not.toBeInTheDocument()
    expect(screen.queryByText('Câu hỏi mới')).not.toBeInTheDocument()
  })

  it('renders "Về trang chính" link', () => {
    renderLayout()
    const link = screen.getByText('Về trang chính')
    expect(link.closest('a')).toHaveAttribute('href', '/')
  })

  it('renders user info in sidebar', () => {
    renderLayout()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('renders the UI language toggle (VI/EN)', () => {
    renderLayout()
    expect(screen.getByTestId('admin-lang-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('admin-lang-vi')).toBeInTheDocument()
    expect(screen.getByTestId('admin-lang-en')).toBeInTheDocument()
  })

  it('renders logout button', () => {
    renderLayout()
    expect(screen.getByText('logout')).toBeInTheDocument()
  })
})
