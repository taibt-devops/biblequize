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
  /** "{HH}:{MM}:{SS}" countdown to next reset for the disabled states. */
  resetTimeLeft: string
  /** Click handler for the primary CTA — already wired in Ranked.tsx
   *  (creates a session, hits /api/sessions, navigates to /quiz). */
  onStart: () => void
}

/**
 * Sticky bottom CTA on /ranked — always visible while the page scrolls
 * so a returning user doesn't have to scroll past every section to
 * reach the primary action.
 *
 * Layout offsets:
 *   - Mobile: sits above MobileBottomTabs (fixed bottom-0 z-40, ~64-80px
 *     tall). Uses bottom-20 + z-30 to stack just above the tabs without
 *     covering them.
 *   - Desktop (md+): tabs are hidden; CTA pins to the viewport bottom
 *     and stops at the sidebar (left-72 = 288px to match AppLayout's
 *     w-72 sidebar) so it doesn't overlay the navigation column.
 *   - iOS notch / home indicator: env(safe-area-inset-bottom) on
 *     paddingBottom so the button doesn't sit under the home pill.
 *
 * Three CTA visual states are preserved:
 *   - canPlay: gold-filled primary with ctaPlayMain + ctaPlaySub.
 *   - capReached: disabled muted button surfacing the limit-reached
 *     sub-line via `ranked-cap-reached-msg` testid.
 *   - noEnergy: disabled muted button + recovery countdown surfaced
 *     via `ranked-no-energy-msg` testid.
 *
 * Soft path links (Practice / Switch mode / Full history) were dropped
 * during the sticky refactor — Practice already lives in the left nav,
 * the full history is one tap from the Recent matches "view all" link,
 * and "switch mode" maps to the same left nav. Less crowded sticky bar.
 */
export default function RankedActionFooter({
  canPlay,
  capReached,
  energy,
  resetTimeLeft,
  onStart,
}: RankedActionFooterProps) {
  const { t } = useTranslation()
  const questionsLeftFromEnergy = Math.floor(energy / 5)

  const primaryButton = canPlay ? (
    <button
      data-testid="ranked-start-btn"
      onClick={onStart}
      className="w-full gold-gradient text-on-secondary font-medium rounded-xl shadow-[0_8px_30px_rgb(248,189,69,0.25)] hover:shadow-[0_12px_36px_rgb(248,189,69,0.4)] active:scale-[0.98] transition-all py-3.5 px-6 flex flex-col items-center gap-0.5"
    >
      <span className="text-[15px] tracking-tight flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]" style={FILL_1}>
          play_arrow
        </span>
        {t('ranked.ctaPlayMain')}
      </span>
      <span className="text-[11px] font-normal opacity-80">
        {t('ranked.ctaPlaySub', { count: questionsLeftFromEnergy })}
      </span>
    </button>
  ) : capReached ? (
    <div
      className="w-full bg-surface-container-high text-on-surface-variant rounded-xl py-3.5 px-6 flex flex-col items-center gap-0.5 opacity-60 cursor-not-allowed"
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
      className="w-full bg-surface-container-high text-on-surface-variant rounded-xl py-3.5 px-6 flex flex-col items-center gap-0.5 opacity-60 cursor-not-allowed"
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
    <div
      data-testid="ranked-sticky-cta"
      className="fixed bottom-20 md:bottom-0 left-0 md:left-72 right-0 z-30 pointer-events-none"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      {/* Gradient fade — softens the page → sticky CTA seam so the
          last visible row of content doesn't get cut by a hard edge. */}
      <div
        aria-hidden
        className="h-6 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(17,19,30,0) 0%, rgba(17,19,30,0.95) 100%)',
        }}
      />
      <div className="bg-[#11131e]/95 backdrop-blur-md border-t border-secondary/15 px-4 md:px-10 lg:px-14 py-3 pointer-events-auto">
        <div className="max-w-5xl mx-auto">
          {primaryButton}
        </div>
      </div>
    </div>
  )
}
