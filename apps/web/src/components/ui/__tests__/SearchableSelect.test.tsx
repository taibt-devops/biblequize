import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchableSelect from '../SearchableSelect'

const options = [
  { value: 'genesis', label: 'Genesis' },
  { value: 'exodus', label: 'Exodus' },
  { value: 'leviticus', label: 'Leviticus' },
]

describe('SearchableSelect', () => {
  it('renders with placeholder when no value selected', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} />)
    expect(screen.getByText('Tất cả')).toBeInTheDocument()
  })

  it('renders selected option label', () => {
    render(<SearchableSelect options={options} value="exodus" onChange={vi.fn()} />)
    expect(screen.getByText('Exodus')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /tất cả/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('shows all options when opened', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /tất cả/i }))

    expect(screen.getByText('Genesis')).toBeInTheDocument()
    expect(screen.getByText('Exodus')).toBeInTheDocument()
    expect(screen.getByText('Leviticus')).toBeInTheDocument()
  })

  it('calls onChange when option is selected', () => {
    const onChange = vi.fn()
    render(<SearchableSelect options={options} value="" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /tất cả/i }))
    fireEvent.click(screen.getByText('Genesis'))

    expect(onChange).toHaveBeenCalledWith('genesis')
  })

  it('calls onChange with empty string when "All" is selected', () => {
    const onChange = vi.fn()
    render(<SearchableSelect options={options} value="genesis" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /genesis/i }))
    // Click the "Tất cả" option in dropdown
    const allButtons = screen.getAllByText('Tất cả')
    fireEvent.click(allButtons[allButtons.length - 1])

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('filters options by search query', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /tất cả/i }))

    const searchInput = screen.getByPlaceholderText('Chọn...')
    fireEvent.change(searchInput, { target: { value: 'exo' } })

    expect(screen.getByText('Exodus')).toBeInTheDocument()
    expect(screen.queryByText('Genesis')).not.toBeInTheDocument()
    expect(screen.queryByText('Leviticus')).not.toBeInTheDocument()
  })

  it('shows "Không tìm thấy" when no options match', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /tất cả/i }))

    const searchInput = screen.getByPlaceholderText('Chọn...')
    fireEvent.change(searchInput, { target: { value: 'xyz' } })

    expect(screen.getByText('Không tìm thấy')).toBeInTheDocument()
  })

  it('uses custom allLabel', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} allLabel="All Books" />)
    expect(screen.getByText('All Books')).toBeInTheDocument()
  })

  it('has aria-haspopup attribute', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('toggles aria-expanded', () => {
    render(<SearchableSelect options={options} value="" onChange={vi.fn()} />)
    const button = screen.getByRole('button')

    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('hideAll: shows the placeholder until a choice is made and offers no "all" row', () => {
    render(
      <SearchableSelect options={options} value="" onChange={vi.fn()}
        placeholder="Chọn một câu chuyện" searchPlaceholder="Tìm câu chuyện..." hideAll />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Chọn một câu chuyện' }))

    expect(screen.getByPlaceholderText('Tìm câu chuyện...')).toBeInTheDocument()
    expect(screen.queryByText('Tất cả')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(options.length)
  })
})
