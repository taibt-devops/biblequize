import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface CurrentBookCardProps {
  bookName: string
  /** 0-based index in canonical 66-book order. Genesis = 0, Revelation = 65. */
  bookIndex: number
  /** 0..100 — % of questions in this book the user has mastered. */
  masteryPct: number
  /** Localized difficulty label (already translated by caller). */
  difficultyLabel: string
}

const OT_BOOK_COUNT = 39

/**
 * Current-book card on /ranked — replaces the previous wide card
 * (RK-P0-3 math mismatch + RK-P1-6 unclear tap area).
 *
 * Two key changes vs the previous version:
 *
 * - Position label disambiguated: instead of the original "Book 2/66"
 *   string — which was read as "you've played 2 out of 66" but
 *   actually meant the book's index in canon — we now render the
 *   localized "Book N of OT/NT" pattern. The testament split (OT
 *   1-39, NT 40-66) is computed from the 0-based index returned by
 *   /ranked-status.bookProgress.
 *
 * - "Change book" affordance moved out of the card into a section-
 *   header link, so the whole card no longer competes for the same
 *   tap zone as a tiny disabled button.
 */
export default function CurrentBookCard({
  bookName,
  bookIndex,
  masteryPct,
  difficultyLabel,
}: CurrentBookCardProps) {
  const { t } = useTranslation()
  const positionInTestament = bookIndex < OT_BOOK_COUNT
    ? bookIndex + 1
    : bookIndex - OT_BOOK_COUNT + 1
  const positionKey = bookIndex < OT_BOOK_COUNT
    ? 'ranked.bookPositionOT'
    : 'ranked.bookPositionNT'

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-on-surface/85 text-[13px] font-medium">
          {t('ranked.currentBookSection')}
        </span>
        <Link
          to="/practice"
          data-testid="ranked-change-book-link"
          className="text-secondary text-[11px] hover:underline"
        >
          {t('ranked.changeBookLink')}
        </Link>
      </div>

      <div
        data-testid="ranked-current-book"
        className="rounded-2xl border border-secondary/15 p-3 md:p-4 flex items-center gap-3"
        style={{ background: 'rgba(50,52,64,0.4)' }}
      >
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 text-[20px]"
          style={{ background: 'rgba(232,168,50,0.15)' }}
        >
          📖
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              data-testid="ranked-current-book-name"
              className="text-on-surface text-[14px] font-medium"
            >
              {bookName}
            </span>
            <span className="text-on-surface-variant/50 text-[11px]">
              {t(positionKey, { n: positionInTestament })}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider bg-secondary/15 text-secondary"
            >
              {difficultyLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/[0.06] rounded-[2px] h-1 flex-1 max-w-[200px] overflow-hidden">
              <div
                data-testid="ranked-current-book-progress"
                className="h-full rounded-[2px] bg-secondary transition-[width] duration-500"
                style={{ width: `${Math.min(100, masteryPct)}%` }}
              />
            </div>
            <span className="text-on-surface-variant/50 text-[10px]">
              {t('ranked.bookMasteryShort', { percent: Math.round(masteryPct) })}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
