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
      className="rounded-2xl border border-[rgba(96,165,250,0.2)] bg-[linear-gradient(135deg,rgba(96,165,250,0.08)_0%,rgba(50,52,64,0.4)_60%)] p-5 md:p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 md:gap-5 items-center">
        <div
          data-testid="motivation-card-icon"
          className="w-14 h-14 rounded-2xl grid place-items-center text-[#60a5fa] border border-[rgba(96,165,250,0.3)] bg-[linear-gradient(135deg,rgba(96,165,250,0.2)_0%,rgba(59,130,246,0.1)_100%)]"
        >
          <span className="material-symbols-outlined text-[28px]" style={FILL_1}>
            tips_and_updates
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-on-surface">
            <span
              data-testid="motivation-card-step"
              className="px-2 py-0.5 rounded-lg bg-[rgba(96,165,250,0.15)] text-[#93c5fd] text-[11px] font-bold"
            >
              {t('home.motivation.step')}
            </span>
            <span data-testid="motivation-card-title">{t('home.motivation.title')}</span>
          </div>
          <div
            data-testid="motivation-card-desc"
            className="text-[13px] text-on-surface-variant mt-1 leading-snug"
          >
            {t('home.motivation.description')}
          </div>
        </div>

        <Link
          to="/daily"
          data-testid="motivation-card-cta"
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border border-[rgba(96,165,250,0.3)] bg-[rgba(96,165,250,0.1)] text-[#93c5fd] text-sm font-bold hover:bg-[rgba(96,165,250,0.18)] transition-colors"
        >
          {t('home.motivation.cta')}
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}
