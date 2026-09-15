import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { chunkPhrases, orderPassed, shuffleSeeded, tokenize } from '../../utils/memorize/exercises'

export interface ExerciseResult {
  passed: boolean
  mistakes: number
}

interface PhraseOrderExerciseProps {
  text: string
  chunkSize: number
  seed: number
  onComplete: (result: ExerciseResult) => void
}

/**
 * Tap-to-place phrase ordering (SPEC_USER §5.1.1, levels 0–1). Only the next
 * correct phrase is accepted; a wrong tap counts a mistake and flashes. No
 * drag-and-drop dependency — works the same on touch (Capacitor) and desktop.
 */
export default function PhraseOrderExercise({ text, chunkSize, seed, onComplete }: PhraseOrderExerciseProps) {
  const { t } = useTranslation()
  const chunks = useMemo(() => chunkPhrases(tokenize(text), chunkSize), [text, chunkSize])
  const bank = useMemo(() => shuffleSeeded(chunks.map((_, i) => i), seed), [chunks, seed])
  const [placed, setPlaced] = useState<number[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [wrongIndex, setWrongIndex] = useState<number | null>(null)

  const done = chunks.length > 0 && placed.length === chunks.length

  const tap = (index: number) => {
    if (done) return
    // Identical phrase text is interchangeable, so compare text rather than index.
    if (chunks[index] === chunks[placed.length]) {
      const next = [...placed, index]
      setPlaced(next)
      setWrongIndex(null)
      if (next.length === chunks.length) onComplete({ passed: orderPassed(mistakes), mistakes })
    } else {
      setMistakes(m => m + 1)
      setWrongIndex(index)
    }
  }

  return (
    <div data-testid="memorize-order-exercise" className="space-y-5">
      <p className="text-sm text-bq-ink2">{t('memorize.exercise.orderPrompt')}</p>

      <div className="min-h-[96px] rounded-2xl border border-bq-hair bg-bq-inset p-4 font-literata text-lg leading-relaxed text-bq-ink">
        {placed.length === 0
          ? <span className="text-sm text-bq-ink3">{t('memorize.exercise.orderAnswerEmpty')}</span>
          : placed.map(i => chunks[i]).join(' ')}
      </div>

      <div className="flex flex-wrap gap-2">
        {bank.filter(i => !placed.includes(i)).map(i => (
          <button
            key={i}
            type="button"
            data-testid="memorize-order-chunk"
            onClick={() => tap(i)}
            className={`rounded-xl border px-3 py-2 text-base font-medium transition active:scale-95 ${
              wrongIndex === i
                ? 'border-bq-ruby/50 bg-bq-ruby/10 text-bq-ruby'
                : 'border-bq-hair bg-bq-white text-bq-ink shadow-bq-soft hover:border-bq-sapphire/40'
            }`}
          >
            {chunks[i]}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="text-xs text-bq-ink3">
        {wrongIndex !== null ? `${t('memorize.exercise.wrongTry')} · ` : ''}
        {mistakes > 0 ? t('memorize.exercise.mistakes', { count: mistakes }) : ''}
      </p>
    </div>
  )
}
