import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clozeDistractors, clozePassed, normalizeWord, pickClozeIndices, shuffleSeeded, tokenize,
} from '../../utils/memorize/exercises'
import type { ExerciseResult } from './PhraseOrderExercise'

interface ClozeExerciseProps {
  text: string
  ratio: number
  seed: number
  /** Surrounding passage — source of the two distractor words. */
  contextText?: string
  onComplete: (result: ExerciseResult) => void
}

/**
 * Progressive cloze (SPEC_USER §5.1.1, levels 2–5). Tap a blank (the first open
 * one is active by default), then tap a word from the bank. A wrong word counts
 * a mistake; passed when mistakes ≤ max(1, 10% of blanks).
 */
export default function ClozeExercise({ text, ratio, seed, contextText = '', onComplete }: ClozeExerciseProps) {
  const { t } = useTranslation()
  const tokens = useMemo(() => tokenize(text), [text])
  const hidden = useMemo(() => pickClozeIndices(tokens, ratio, seed), [tokens, ratio, seed])
  const bank = useMemo(() => {
    const answers = [...new Set(hidden.map(i => normalizeWord(tokens[i])))]
    const extra = clozeDistractors(answers, tokenize(contextText), 2, seed)
    return shuffleSeeded([...answers, ...extra], seed + 1)
  }, [hidden, tokens, contextText, seed])

  const [filled, setFilled] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [wrongWord, setWrongWord] = useState<string | null>(null)

  const open = hidden.filter(i => !filled.has(i))
  const active = selected !== null && !filled.has(selected) ? selected : open[0]

  const pick = (word: string) => {
    if (active === undefined) return
    if (normalizeWord(tokens[active]) === word) {
      const next = new Set(filled).add(active)
      setFilled(next)
      setSelected(null)
      setWrongWord(null)
      if (next.size === hidden.length) onComplete({ passed: clozePassed(mistakes, hidden.length), mistakes })
    } else {
      setMistakes(m => m + 1)
      setWrongWord(word)
    }
  }

  return (
    <div data-testid="memorize-cloze-exercise" className="space-y-5">
      <p className="text-sm text-bq-ink2">{t('memorize.exercise.clozePrompt')}</p>

      <p className="rounded-2xl border border-bq-hair bg-bq-inset p-4 font-literata text-lg leading-loose text-bq-ink">
        {tokens.map((token, i) => {
          if (!hidden.includes(i)) return <span key={i}>{token} </span>
          if (filled.has(i)) return <span key={i} className="font-semibold text-bq-emerald">{token} </span>
          return (
            <span key={i}>
              <button
                type="button"
                data-testid="memorize-cloze-blank"
                data-index={i}
                aria-pressed={active === i}
                onClick={() => setSelected(i)}
                className={`mx-0.5 inline-block min-w-[3.5rem] rounded-md border-b-2 px-2 align-baseline transition ${
                  active === i ? 'border-bq-sapphire bg-bq-sapphire/10' : 'border-bq-ink3/40 bg-bq-white'
                }`}
              >
                &nbsp;
              </button>{' '}
            </span>
          )
        })}
      </p>

      <div className="flex flex-wrap gap-2">
        {bank.map(word => (
          <button
            key={word}
            type="button"
            data-testid="memorize-cloze-word"
            onClick={() => pick(word)}
            disabled={active === undefined}
            className={`rounded-xl border px-3 py-2 text-base font-medium transition active:scale-95 disabled:opacity-50 ${
              wrongWord === word
                ? 'border-bq-ruby/50 bg-bq-ruby/10 text-bq-ruby'
                : 'border-bq-hair bg-bq-white text-bq-ink shadow-bq-soft hover:border-bq-sapphire/40'
            }`}
          >
            {word}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="text-xs text-bq-ink3">
        {wrongWord !== null ? `${t('memorize.exercise.wrongTry')} · ` : ''}
        {mistakes > 0 ? t('memorize.exercise.mistakes', { count: mistakes }) : ''}
      </p>
    </div>
  )
}
