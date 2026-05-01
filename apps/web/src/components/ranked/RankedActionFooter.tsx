import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

interface RankedActionFooterProps {
  /** True when the user has both energy and questions remaining today. */
  canPlay: boolean
  /** True when daily question cap reached — disabled CTA, the
   *  "limit reached" sub-text shows. */
  capReached: boolean
  /** Energy used to compute the "~N questions" descriptor on the
   *  active CTA. */
  energy: number
  /** Active book name; appears in the resume sub-line. */
  currentBook: string
  /** "{HH}:{MM}:{SS}" countdown to next reset for the disabled states. */
  resetTimeLeft: string
  /** Click handler for the primary CTA — already wired in Ranked.tsx
   *  (creates a session, hits /api/sessions, navigates to /quiz). */
  onStart: () => void
}

/**
 * Bottom action footer on /ranked (mockup line 250-262) — primary
 * gold-filled CTA + 3 soft-path links + a contextual subtitle. The 3
 * soft paths address RK-P2-2 (no alternative actions for users who
 * aren't ready to ranked-grind right now).
 *
 * Three CTA visual states are preserved from the previous inline
 * version:
 *   - canPlay: gold-filled primary with the existing ctaPlayMain +
 *     ctaPlaySub i18n strings.
 *   - capReached: disabled muted button surfacing the limit-reached
 *     sub-line via `ranked-cap-reached-msg` testid.
 *   - noEnergy: disabled muted button + recovery countdown surfaced
 *     via `ranked-no-energy-msg` testid.
 *
 * Soft path links sit below the primary CTA and never gate behind a
 * state — even when CTA is disabled the user still has somewhere to
 * go (Practice / mode switcher / full history).
 */
export default function RankedActionFooter({
  canPlay,
  capReached,
  energy,
  currentBook,
  resetTimeLeft,
  onStart,
}: RankedActionFooterProps) {
  const { t } = useTranslation()
  const questionsLeftFromEnergy = Math.floor(energy / 5)

  const primaryButton = canPlay ? (
    <button
      data-testid="ranked-start-btn"
      onClick={onStart}
      className="w-full gold-gradient text-on-secondary font-medium rounded-xl shadow-[0_8px_30px_rgb(248,189,69,0.25)] hover:shadow-[0_12px_36px_rgb(248,189,69,0.4)] active:scale-[0.98] transition-all py-4 px-6 flex flex-col items-center gap-1"
    >
      <span className="text-[15px] tracking-tight flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]" style={FILL_1}>
          play_arrow
        </span>
        {t('ranked.ctaPlayMain')}
      </span>
      <span className="text-[11px] font-normal opacity-80">
        {t('ranked.ctaPlaySub', {
          book: currentBook,
          count: questionsLeftFromEnergy,
        })}
      </span>
    </button>
  ) : capReached ? (
    <div
      className="w-full bg-surface-container-high text-on-surface-variant rounded-xl py-4 px-6 flex flex-col items-center gap-1 opacity-60 cursor-not-allowed"
    >
      <span className="text-[15px] font-medium tracking-tight">
        {t('ranked.ctaCapMain')}
      </span>
      <span data-testid="ranked-cap-reached-msg" className="text-[11px] font-normal">
        {t('ranked.ctaCapSub', { time: resetTimeLeft })}
      </span>
    </div>
  ) : (
    <div
      className="w-full bg-surface-container-high text-on-surface-variant rounded-xl py-4 px-6 flex flex-col items-center gap-1 opacity-60 cursor-not-allowed"
    >
      <span className="text-[15px] font-medium tracking-tight">
        {t('ranked.ctaNoEnergyMain')}
      </span>
      <span data-testid="ranked-no-energy-msg" className="text-[11px] font-normal">
        {t('ranked.ctaNoEnergySub', { time: resetTimeLeft })}
      </span>
    </div>
  )

  return (
    <section className="mt-2">
      {primaryButton}

      {/* Soft path actions — always visible, even when primary CTA
          is disabled, so users have somewhere to go. */}
      <div className="flex justify-center gap-3 mt-2.5 flex-wrap">
        <Link
          to="/practice"
          data-testid="ranked-soft-path-practice"
          className="text-on-surface-variant/50 hover:text-on-surface-variant text-[11px] transition-colors"
        >
          {t('ranked.softPathPractice')}
        </Link>
        <span className="text-on-surface-variant/20">·</span>
        <Link
          to="/"
          data-testid="ranked-soft-path-modes"
          className="text-on-surface-variant/50 hover:text-on-surface-variant text-[11px] transition-colors"
        >
          {t('ranked.softPathChangeMode')}
        </Link>
        <span className="text-on-surface-variant/20">·</span>
        <Link
          to="/profile?tab=history"
          data-testid="ranked-soft-path-history"
          className="text-on-surface-variant/50 hover:text-on-surface-variant text-[11px] transition-colors"
        >
          {t('ranked.softPathFullHistory')}
        </Link>
      </div>
    </section>
  )
}
