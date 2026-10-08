import { useTranslation } from 'react-i18next'

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

  // Each state returns the main button/pill (single-line label only)
  // plus a hint string rendered as a separate caption row below the
  // bar — keeps the gold button visually clean and matches the mockup
  // where the energy estimate sits outside the button.
  const button = canPlay ? (
    <button
      data-testid="ranked-start-btn"
      onClick={onStart}
      className="lk-btn w-full text-bq-ink text-[17px]"
    >
      <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-6" />
      {t('ranked.ctaPlayMain')}
    </button>
  ) : (
    <button disabled className="lk-btn w-full !bg-bq-inset text-bq-ink2 text-[16px]">
      {capReached ? t('ranked.ctaCapMain') : t('ranked.ctaNoEnergyMain')}
    </button>
  )

  // Caption rendered OUTSIDE the button. testids on the disabled-state
  // captions are preserved (existing tests assert on
  // ranked-cap-reached-msg / ranked-no-energy-msg).
  const caption = canPlay
    ? t('ranked.ctaPlaySub', { count: questionsLeftFromEnergy })
    : capReached
      ? t('ranked.ctaCapSub', { time: resetTimeLeft })
      : t('ranked.ctaNoEnergySub', { time: resetTimeLeft })

  const captionTestId = canPlay
    ? undefined
    : capReached
      ? 'ranked-cap-reached-msg'
      : 'ranked-no-energy-msg'

  return (
    <div
      data-testid="ranked-sticky-cta"
      className="fixed bottom-[var(--mobile-nav-h)] md:bottom-0 left-0 md:left-72 right-0 z-30 pointer-events-none"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      {/* Gradient fade — softens the page → sticky CTA seam so the
          last visible row of content doesn't get cut by a hard edge. */}
      <div className="bg-bq-paper/95 backdrop-blur-md border-t-[3px] border-bq-ink px-4 md:px-10 lg:px-14 pt-3 pb-2 pointer-events-auto">
        <div className="max-w-5xl mx-auto">
          {button}
          <p
            data-testid={captionTestId}
            className="text-center text-bq-ink2 text-[13px] font-bold mt-2"
          >
            {caption}
          </p>
        </div>
      </div>
    </div>
  )
}
