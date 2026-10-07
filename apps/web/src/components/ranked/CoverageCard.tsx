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
      className="rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-soft p-4 md:p-5"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-bq-ink text-[14px] font-semibold">
            {t('coverage.weekLabel', { n: weekNumber })}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-bq-amber/15 text-bq-amberd">
            {t(PHASE_KEYS[phase])}
          </span>
        </div>
        <span
          data-testid="ranked-coverage-progress-text"
          className="text-bq-ink2 text-[11px]"
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
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-[12px] ${
              book.covered
                ? 'bg-bq-amber/15 text-bq-amberd'
                : 'bg-bq-inset text-bq-ink2'
            }`}
          >
            <span className="truncate">{book.code}</span>
            <span className="font-mono text-[11px] tabular-nums shrink-0 ml-2">
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
          className="w-full rounded-lg px-3 py-2 text-[13px] font-bold bg-bq-action text-bq-ink shadow-bq-action hover:opacity-90 transition-opacity"
        >
          {t('coverage.unlockNextCta', { n: weekNumber + 1 })}
        </button>
      )}

      {!completed && currentBadgePreview && (
        <div className="text-bq-ink3 text-[11px] mt-1">
          {t('coverage.badgePreview', { badge: currentBadgePreview })}
        </div>
      )}
    </section>
  )
}
