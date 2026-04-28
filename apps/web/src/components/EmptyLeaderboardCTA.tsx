import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

/**
 * Replaces the bare "no leaderboard data" paragraph that used to render
 * when the leaderboard list was empty. At launch v1 the empty case is
 * the most likely first paint for a brand-new user, so the message
 * needs to give them an action — not just inform them there is nothing
 * here.
 *
 * CTA points to {@code /practice} since Practice is the only mode a
 * tier-1 user can play immediately (no energy gate, no tier gate).
 * Once the user finishes a few practice questions and starts earning
 * XP via Ranked the leaderboard fills in naturally.
 */
export default function EmptyLeaderboardCTA() {
  const { t } = useTranslation()

  return (
    <div
      data-testid="empty-leaderboard-cta"
      className="flex flex-col items-center text-center gap-3 py-6"
    >
      <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
        <span
          className="material-symbols-outlined text-secondary text-2xl"
          style={FILL_1}
        >
          leaderboard
        </span>
      </div>
      <p className="text-sm font-bold text-on-surface">
        {t('home.emptyLeaderboard.title')}
      </p>
      <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
        {t('home.emptyLeaderboard.body')}
      </p>
      <Link
        to="/practice"
        data-testid="empty-leaderboard-cta-button"
        className="inline-flex items-center gap-2 mt-2 px-5 py-2 rounded-xl gold-gradient text-on-secondary text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
      >
        {t('home.emptyLeaderboard.cta')} →
      </Link>
    </div>
  )
}
