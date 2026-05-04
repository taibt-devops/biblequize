import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnswerButton } from '../AnswerButton'

describe('AnswerButton', () => {
  const baseProps = {
    index: 0 as const,
    letter: 'A' as const,
    text: 'Trên đường đi đến Ép-ra-ta',
    state: 'default' as const,
  }

  describe('Rendering', () => {
    it('renders the letter and text content', () => {
      render(<AnswerButton {...baseProps} />)
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('Trên đường đi đến Ép-ra-ta')).toBeInTheDocument()
    })

    it('applies testId as data-testid', () => {
      render(<AnswerButton {...baseProps} testId="quiz-answer-0" />)
      expect(screen.getByTestId('quiz-answer-0')).toBeInTheDocument()
    })

    it('compact prop sets data-compact and applies smaller min-h class on mobile', () => {
      render(<AnswerButton {...baseProps} compact testId="qa" />)
      const btn = screen.getByTestId('qa')
      expect(btn).toHaveAttribute('data-compact', 'true')
      expect(btn.className).toContain('min-h-[44px]')
      expect(btn.className).toContain('md:min-h-[64px]')
    })

    it('omits data-compact attribute when compact is false', () => {
      render(<AnswerButton {...baseProps} testId="qa" />)
      const btn = screen.getByTestId('qa')
      expect(btn).not.toHaveAttribute('data-compact')
      expect(btn.className).toContain('min-h-[64px]')
    })

    it('exposes index and state via data attributes', () => {
      render(<AnswerButton {...baseProps} index={2} letter="C" state="selected" />)
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('data-answer-index', '2')
      expect(btn).toHaveAttribute('data-answer-state', 'selected')
    })
  })

  describe('Color Mapping (4 positions = 4 colors)', () => {
    it('index 0 (A) uses Coral color tokens (answer-a)', () => {
      render(<AnswerButton {...baseProps} index={0} letter="A" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('answer-a')
    })

    it('index 1 (B) uses Sky color tokens (answer-b)', () => {
      render(<AnswerButton {...baseProps} index={1} letter="B" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('answer-b')
    })

    it('index 2 (C) uses Gold color tokens (answer-c)', () => {
      render(<AnswerButton {...baseProps} index={2} letter="C" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('answer-c')
    })

    it('index 3 (D) uses Sage color tokens (answer-d)', () => {
      render(<AnswerButton {...baseProps} index={3} letter="D" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('answer-d')
    })
  })

  describe('States', () => {
    it('default state is interactive (not disabled)', () => {
      render(<AnswerButton {...baseProps} state="default" />)
      const btn = screen.getByRole('button')
      expect(btn).not.toBeDisabled()
      expect(btn).toHaveAttribute('aria-disabled', 'false')
    })

    it('selected state shows ring + gold glow', () => {
      render(<AnswerButton {...baseProps} state="selected" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toMatch(/ring-2/)
      expect(btn.className).toContain('gold-glow')
    })

    it('correct state shows green border + check_circle icon', () => {
      render(<AnswerButton {...baseProps} state="correct" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('border-green-500')
      expect(screen.getByText('check_circle')).toBeInTheDocument()
    })

    it('wrong state shows error border + cancel icon', () => {
      render(<AnswerButton {...baseProps} state="wrong" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('border-error')
      expect(screen.getByText('cancel')).toBeInTheDocument()
    })

    it('eliminated state is non-interactive + line-through + close icon', () => {
      render(<AnswerButton {...baseProps} state="eliminated" />)
      const btn = screen.getByRole('button')
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('aria-disabled', 'true')
      expect(btn.className).toContain('opacity-40')
      expect(btn.className).toContain('pointer-events-none')
      expect(screen.getByText('close')).toBeInTheDocument()
    })

    it('disabled state is non-interactive + faded', () => {
      render(<AnswerButton {...baseProps} state="disabled" />)
      const btn = screen.getByRole('button')
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('aria-disabled', 'true')
      expect(btn.className).toContain('opacity-60')
    })
  })

  describe('Interactions', () => {
    it('fires onClick when clicked in default state', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<AnswerButton {...baseProps} state="default" onClick={onClick} />)
      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does NOT fire onClick when state is disabled', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<AnswerButton {...baseProps} state="disabled" onClick={onClick} />)
      await user.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('does NOT fire onClick when state is eliminated', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<AnswerButton {...baseProps} state="eliminated" onClick={onClick} />)
      // pointer-events-none makes click impossible from user-event side too
      await user.click(screen.getByRole('button')).catch(() => {})
      expect(onClick).not.toHaveBeenCalled()
    })

    it('does NOT fire onClick when state is correct (post-reveal)', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<AnswerButton {...baseProps} state="correct" onClick={onClick} />)
      await user.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })
})
