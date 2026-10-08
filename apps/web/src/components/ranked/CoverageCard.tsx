import { useTranslation } from 'react-i18next'
import type { CoverageStatus } from '../../hooks/useCoverageStatus'

interface CoverageCardProps {
  coverage: CoverageStatus
  onUnlockNext?: () => void
}

const PHASE_KEYS: Record<CoverageStatus['currentWeek']['phase'], string> = {
  FOUNDATION: 'coverage.phase.foundation',
  ACCELERATION: 'coverage.phase.acceleration',
  CLIMAX: 'coverage.phase.climax',
  MASTERY: 'coverage.phase.mastery',
  UNKNOWN: 'coverage.phase.unknown',
}

/**
 * Liturgical Coverage current-week card on /ranked (SPEC_USER_v3.2 §7.8.1).
 *
 * Replaces the legacy OT/NT CurrentBookCard for users in the Liturgical
 * Coverage rollout. Shows week number + phase + 6 books with covered/
 * answered count chips. Surfaces "Unlock next week" CTA when 6/6 books
 * reach the ≥4 answered threshold.
 */
export default function CoverageCard({ coverage, onUnlockNext }: CoverageCardProps) {
  const { t } = useTranslation()
  const { weekNumber, phase, books, completed, canUnlockNext } = coverage.currentWeek
  const { totalCovered, currentBadgePreview } = coverage.seasonProgress

  return (
    <section
      data-testid="ranked-coverage-card"
      className="rounded-bq border-[3px] border-bq-ink bg-bq-white shadow-bq-card p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-8" />
          <span className="font-display text-bq-ink text-[18px] font-extrabold">
            {t('coverage.weekLabel', { n: weekNumber })}
          </span>
          <span className="px-2.5 py-0.5 rounded-full border-2 border-bq-ink bg-bq-amber text-[12.5px] font-extrabold">
            {t(PHASE_KEYS[phase])}
          </span>
        </div>
        <span
          data-testid="ranked-coverage-progress-text"
          className="text-bq-ink2 text-[13px] font-bold"
        >
          {t('coverage.totalCovered', { n: totalCovered, total: 66 })}
        </span>
      </div>

      <ul
        data-testid="ranked-coverage-books"
        className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3"
      >
        {books.map((book) => (
          <li
            key={book.code}
            data-testid={`coverage-book-${book.code}`}
            className={`flex items-center justify-between rounded-2xl border-2 px-3 py-2 text-[14px] font-bold ${
              book.covered
                ? 'bg-bq-leaf border-bq-ink text-bq-ink'
                : 'bg-bq-paper border-bq-ink/25 text-bq-ink2'
            }`}
          >
            <span className="truncate">{book.code}</span>
            <span className="text-[13px] font-extrabold tabular-nums shrink-0 ml-2">
              {book.covered ? '✓' : `${book.answeredCount}/4`}
            </span>
          </li>
        ))}
      </ul>

      {completed && canUnlockNext && (
        <button
          type="button"
          data-testid="ranked-coverage-unlock-cta"
          onClick={onUnlockNext}
          className="lk-btn w-full text-bq-ink text-[15px]"
        >
          {t('coverage.unlockNextCta', { n: weekNumber + 1 })}
        </button>
      )}

      {!completed && currentBadgePreview && (
        <div className="font-read text-bq-ink2 text-[13.5px] mt-1">
          {t('coverage.badgePreview', { badge: currentBadgePreview })}
        </div>
      )}
    </section>
  )
}
