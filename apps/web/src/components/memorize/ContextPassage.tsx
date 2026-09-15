import { useTranslation } from 'react-i18next'
import type { Passage } from '../../api/memorize'
import { Skeleton } from '../Skeleton'

interface ContextPassageProps {
  reference: string
  verseStart: number
  verseEnd: number
  /** Verse text from the memorize item — shown alone when the surrounding passage is unavailable. */
  fallbackText: string
  passage?: Passage
  loading: boolean
  onStart: () => void
}

/** Pre-exercise screen: surrounding verses (±2) with the memory verse highlighted. */
export default function ContextPassage({
  reference, verseStart, verseEnd, fallbackText, passage, loading, onStart,
}: ContextPassageProps) {
  const { t } = useTranslation()

  return (
    <div data-testid="memorize-context" className="space-y-5">
      <div>
        <p className="font-display text-lg font-bold text-bq-ink">{reference}</p>
        <p className="text-sm text-bq-ink2">{t('memorize.session.contextHint')}</p>
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (
        <div className="rounded-2xl border border-bq-hair bg-bq-inset p-5 font-literata text-lg leading-relaxed">
          {passage && passage.verses.length > 0
            ? passage.verses.map(v => {
                const target = v.verse >= verseStart && v.verse <= verseEnd
                return (
                  <span key={v.verse} className={target ? 'font-semibold text-bq-ink' : 'text-bq-ink3'}>
                    <sup className="mr-1 text-xs text-bq-ink3">{v.verse}</sup>{v.text}{' '}
                  </span>
                )
              })
            : <span className="font-semibold text-bq-ink">{fallbackText}</span>}
        </div>
      )}

      <button
        type="button"
        data-testid="memorize-context-start"
        onClick={onStart}
        className="w-full rounded-xl bg-bq-action px-5 py-3 text-sm font-semibold text-white shadow-bq-action transition hover:brightness-105 md:w-auto"
      >
        {t('memorize.session.start')}
      </button>
    </div>
  )
}
