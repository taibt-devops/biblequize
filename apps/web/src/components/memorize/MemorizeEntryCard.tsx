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
      className="flex flex-wrap items-center gap-3 rounded-bq border-[3px] border-bq-ink bg-bq-white px-4 py-3.5 shadow-bq-card"
    >
      <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[16px] font-extrabold text-bq-ink">{t('memorize.entry.title')}</p>
          {isAuthenticated && dueCount > 0 && (
            <span className="rounded-full border-2 border-bq-ink bg-bq-ruby px-2 text-[12px] font-extrabold text-bq-white">
              {t('memorize.entry.due', { count: dueCount })}
            </span>
          )}
        </div>
        <p className="font-read text-[13.5px] text-bq-ink2">
          {isAuthenticated ? t('memorize.entry.desc') : t('memorize.entry.loginHint')}
        </p>
      </div>
      <button
        type="button"
        data-testid="memorize-entry-btn"
        onClick={() => navigate(isAuthenticated ? '/practice/memorize' : '/login')}
        className="lk-btn lk-btn-2 text-bq-ink text-[15px]"
      >
        {isAuthenticated ? t('memorize.entry.open') : t('memorize.entry.login')}
      </button>
    </div>
  )
}
