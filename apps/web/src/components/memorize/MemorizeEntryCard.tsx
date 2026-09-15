import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useBibleTextAvailable, useMemoryDueCount } from '../../hooks/useMemoryVerses'

interface MemorizeEntryCardProps {
  isAuthenticated: boolean
}

/**
 * Practice page entry into Memorize mode (SPEC_USER §5.1.1). Guests are sent to login.
 * Hidden until Bible text is imported, so the feature never ships empty.
 */
export default function MemorizeEntryCard({ isAuthenticated }: MemorizeEntryCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const available = useBibleTextAvailable()
  const { data: dueCount = 0 } = useMemoryDueCount(isAuthenticated && available)
  if (!available) return null

  return (
    <div
      data-testid="memorize-entry-card"
      className="flex items-center gap-3 rounded-xl border border-bq-sapphire/25 bg-gradient-to-r from-bq-sapphire/10 to-bq-white px-4 py-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bq-sapphire/15">
        <span className="material-symbols-outlined text-lg text-bq-sapphire">auto_stories</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-bq-ink">{t('memorize.entry.title')}</p>
          {isAuthenticated && dueCount > 0 && (
            <span className="rounded-full bg-bq-amber/20 px-2 py-0.5 text-[10px] font-bold text-bq-amberd">
              {t('memorize.entry.due', { count: dueCount })}
            </span>
          )}
        </div>
        <p className="text-xs text-bq-ink2">
          {isAuthenticated ? t('memorize.entry.desc') : t('memorize.entry.loginHint')}
        </p>
      </div>
      <button
        type="button"
        data-testid="memorize-entry-btn"
        onClick={() => navigate(isAuthenticated ? '/practice/memorize' : '/login')}
        className="rounded-lg border border-bq-sapphire/35 bg-bq-sapphire/15 px-4 py-2 text-xs font-semibold text-bq-sapphire transition-all hover:bg-bq-sapphire/20 active:scale-95"
      >
        {isAuthenticated ? t('memorize.entry.open') : t('memorize.entry.login')} →
      </button>
    </div>
  )
}
