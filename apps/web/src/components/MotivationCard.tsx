import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/**
 * Onboarding nudge for brand-new users (mockup
 * docs/designs/home_redesign_mockup.html `.motivation-card`).
 *
 * Purely presentational — Home decides when to render this (HR-6 will
 * gate it on `totalPoints < 1000`). Friendly hint that doing today's
 * Daily Challenge unlocks the rest of the rail (missions/leaderboard
 * become visible once the user has some progress).
 */
export default function MotivationCard() {
  const { t } = useTranslation()

  return (
    <div
      data-testid="motivation-card"
      className="rounded-2xl bg-bq-white border border-bq-hair shadow-bq-soft p-4 md:p-6"
    >
      <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] gap-3 md:gap-5 items-center">
        <div
          data-testid="motivation-card-icon"
          className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl grid place-items-center text-bq-sapphire border border-bq-hair bg-bq-inset shrink-0"
        >
          <span className="material-symbols-outlined text-[20px] md:text-[28px]" style={FILL_1}>
            tips_and_updates
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px] md:text-[15px] font-bold text-bq-ink">
            <span
              data-testid="motivation-card-step"
              className="px-1.5 md:px-2 py-0.5 rounded-md md:rounded-lg bg-bq-inset text-bq-sapphire text-[10px] md:text-[11px] font-bold"
            >
              {t('home.motivation.step')}
            </span>
            <span data-testid="motivation-card-title">{t('home.motivation.title')}</span>
          </div>
          <div
            data-testid="motivation-card-desc"
            className="text-[12px] md:text-[13px] text-bq-ink2 mt-1 leading-snug"
          >
            {t('home.motivation.description')}
          </div>
        </div>

        {/* Mobile: full-width CTA below; Desktop: third grid col (right side) */}
        <Link
          to="/daily"
          data-testid="motivation-card-cta"
          className="col-span-2 md:col-span-1 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 md:py-2.5 rounded-xl bg-bq-action text-bq-ink shadow-bq-action text-[13px] md:text-sm font-bold transition-opacity hover:opacity-90"
        >
          {t('home.motivation.cta')}
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}
