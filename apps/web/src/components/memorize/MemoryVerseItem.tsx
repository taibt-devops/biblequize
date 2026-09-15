import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MemoryVerse } from '../../api/memorize'
import { daysUntilReview, formatReference, MAX_MASTERY_LEVEL } from '../../utils/memorize/schedule'

interface MemoryVerseItemProps {
  verse: MemoryVerse
  bookName: string
  onDelete: (id: string) => void
  deleting?: boolean
}

/** One verse card in the memorize list: reference, excerpt, mastery dots, schedule, 2-step delete. */
export default function MemoryVerseItem({ verse, bookName, onDelete, deleting = false }: MemoryVerseItemProps) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const days = daysUntilReview(verse.nextReviewAt)
  const status = verse.due
    ? t('memorize.list.due')
    : days === 0 ? t('memorize.list.reviewSoon') : t('memorize.list.reviewIn', { count: days })

  return (
    <li data-testid="memorize-item" className="rounded-2xl border border-bq-hair bg-bq-white p-4 shadow-bq-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-bq-ink">
            {formatReference(bookName, verse.chapter, verse.verseStart, verse.verseEnd)}
          </p>
          <p className="mt-1 line-clamp-2 font-literata text-sm text-bq-ink2">{verse.text}</p>
        </div>
        {verse.due && (
          <span className="shrink-0 rounded-full bg-bq-amber/15 px-2 py-0.5 text-[10px] font-bold text-bq-amberd">
            {t('memorize.list.due')}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2" aria-label={t('memorize.list.level', { level: verse.masteryLevel })}>
          <div className="flex gap-1">
            {Array.from({ length: MAX_MASTERY_LEVEL }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i < verse.masteryLevel ? 'bg-bq-emerald' : 'bg-bq-hair'}`}
              />
            ))}
          </div>
          {!verse.due && <span className="text-xs text-bq-ink3">{status}</span>}
        </div>

        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-bq-ink2">{t('memorize.list.deleteConfirm')}</span>
            <button
              type="button"
              data-testid="memorize-item-delete-confirm"
              disabled={deleting}
              onClick={() => onDelete(verse.id)}
              className="rounded-lg bg-bq-ruby/15 px-3 py-1 text-xs font-semibold text-bq-ruby hover:bg-bq-ruby/20 disabled:opacity-50"
            >
              {t('memorize.list.delete')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-bq-ink2 hover:bg-bq-inset"
            >
              {t('memorize.list.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="memorize-item-delete"
            onClick={() => setConfirming(true)}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-bq-ink3 hover:bg-bq-inset hover:text-bq-ruby"
          >
            {t('memorize.list.delete')}
          </button>
        )}
      </div>
    </li>
  )
}
