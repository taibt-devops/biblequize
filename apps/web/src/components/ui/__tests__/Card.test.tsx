import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardContent, CardTitle } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="my-class">Content</Card>)
    expect(container.firstChild).toHaveClass('my-class')
  })

  it('has default styling', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild).toHaveClass('rounded-bq')
    expect(container.firstChild).toHaveClass('border-bq-ink')
    expect(container.firstChild).toHaveClass('shadow-bq-card')
  })
})

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header</CardHeader>)
    expect(screen.getByText('Header')).toBeInTheDocument()
  })

  it('has padding class', () => {
    const { container } = render(<CardHeader>Header</CardHeader>)
    expect(container.firstChild).toHaveClass('p-6')
  })
})

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content area</CardContent>)
    expect(screen.getByText('Content area')).toBeInTheDocument()
  })
})

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>)
    const title = screen.getByText('Title')
    expect(title.tagName).toBe('H3')
  })

  it('has text styling', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByText('Title')).toHaveClass('text-2xl')
  })
})

describe('Card composition', () => {
  it('renders full card with all subcomponents', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Card</CardTitle>
        </CardHeader>
        <CardContent>Body text</CardContent>
      </Card>
    )
    expect(screen.getByText('My Card')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })
})
