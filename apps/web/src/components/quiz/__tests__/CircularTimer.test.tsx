import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CircularTimer, colorForSeconds, urgencyAnimClass } from '../CircularTimer'

const DEFAULT_SIZE = 80
const STROKE_WIDTH = 5
const RADIUS = DEFAULT_SIZE / 2 - STROKE_WIDTH - 1 // 34
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

describe('CircularTimer', () => {
  describe('Rendering', () => {
    it('renders an SVG with track + progress circles', () => {
      const { container } = render(<CircularTimer secondsLeft={20} totalSeconds={30} />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg?.getAttribute('viewBox')).toBe(`0 0 ${DEFAULT_SIZE} ${DEFAULT_SIZE}`)
      const circles = container.querySelectorAll('circle')
      expect(circles).toHaveLength(2)
    })

    it('renders the seconds-left number in a span', () => {
      const { container } = render(<CircularTimer secondsLeft={27} totalSeconds={30} />)
      const span = container.querySelector('span')
      expect(span?.textContent).toBe('27')
    })

    it('applies the testId prop to the visible number span', () => {
      const { getByTestId } = render(
        <CircularTimer secondsLeft={10} totalSeconds={30} testId="quiz-timer" />,
      )
      expect(getByTestId('quiz-timer').textContent).toBe('10')
    })
  })

  describe('Arc fill (strokeDashoffset)', () => {
    it('full ring (offset = 0) when secondsLeft === totalSeconds', () => {
      const { container } = render(<CircularTimer secondsLeft={30} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle.getAttribute('stroke-dashoffset')).toBe('0')
    })

    it('empty ring (offset = circumference) when secondsLeft = 0', () => {
      const { container } = render(<CircularTimer secondsLeft={0} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(Number(progressCircle.getAttribute('stroke-dashoffset')))
        .toBeCloseTo(CIRCUMFERENCE, 3)
    })

    it('offset is proportional at midway (15 of 30)', () => {
      const { container } = render(<CircularTimer secondsLeft={15} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      const offset = Number(progressCircle.getAttribute('stroke-dashoffset'))
      expect(offset).toBeCloseTo(CIRCUMFERENCE * 0.5, 3)
    })

    it('defensive: totalSeconds = 0 keeps ring full (offset = 0)', () => {
      const { container } = render(<CircularTimer secondsLeft={5} totalSeconds={0} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle.getAttribute('stroke-dashoffset')).toBe('0')
    })

    it('defensive: secondsLeft > totalSeconds clamps to full ring', () => {
      const { container } = render(<CircularTimer secondsLeft={50} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle.getAttribute('stroke-dashoffset')).toBe('0')
    })

    it('defensive: negative secondsLeft clamps to empty ring', () => {
      const { container } = render(<CircularTimer secondsLeft={-5} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(Number(progressCircle.getAttribute('stroke-dashoffset')))
        .toBeCloseTo(CIRCUMFERENCE, 3)
    })
  })

  describe('Colour bands (4 states)', () => {
    it('15s → gold (#e8a832)', () => {
      const { container } = render(<CircularTimer secondsLeft={15} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle.getAttribute('stroke')).toBe('#e8a832')
    })

    it('8s → yellow (#eab308)', () => {
      const { container } = render(<CircularTimer secondsLeft={8} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle.getAttribute('stroke')).toBe('#eab308')
    })

    it('4s → orange (#ff8c42)', () => {
      const { container } = render(<CircularTimer secondsLeft={4} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle.getAttribute('stroke')).toBe('#ff8c42')
    })

    it('2s → red (#ef4444)', () => {
      const { container } = render(<CircularTimer secondsLeft={2} totalSeconds={30} />)
      const progressCircle = container.querySelectorAll('circle')[1]
      expect(progressCircle.getAttribute('stroke')).toBe('#ef4444')
    })

    it('boundary: exactly 11s → gold (>10 rule)', () => {
      expect(colorForSeconds(11)).toBe('#e8a832')
    })

    it('boundary: exactly 10s → yellow (NOT >10)', () => {
      expect(colorForSeconds(10)).toBe('#eab308')
    })

    it('boundary: exactly 5s → orange (NOT >5)', () => {
      expect(colorForSeconds(5)).toBe('#ff8c42')
    })

    it('boundary: exactly 3s → red (NOT >3)', () => {
      expect(colorForSeconds(3)).toBe('#ef4444')
    })
  })

  describe('Urgency animations', () => {
    it('seconds > 5: no animation class', () => {
      const { container } = render(<CircularTimer secondsLeft={7} totalSeconds={30} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).not.toContain('timer-warning-anim')
      expect(wrapper.className).not.toContain('timer-critical-anim')
    })

    it('seconds = 5 (in 4-5 band): timer-warning-anim', () => {
      const { container } = render(<CircularTimer secondsLeft={5} totalSeconds={30} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('timer-warning-anim')
      expect(wrapper.className).not.toContain('timer-critical-anim')
    })

    it('seconds <= 3: timer-critical-anim (not warning)', () => {
      const { container } = render(<CircularTimer secondsLeft={2} totalSeconds={30} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('timer-critical-anim')
      expect(wrapper.className).not.toContain('timer-warning-anim')
    })

    it('urgencyAnimClass mapping is exhaustive', () => {
      expect(urgencyAnimClass(15)).toBe('')
      expect(urgencyAnimClass(6)).toBe('')
      expect(urgencyAnimClass(5)).toBe('timer-warning-anim')
      expect(urgencyAnimClass(4)).toBe('timer-warning-anim')
      expect(urgencyAnimClass(3)).toBe('timer-critical-anim')
      expect(urgencyAnimClass(0)).toBe('timer-critical-anim')
    })
  })
})
