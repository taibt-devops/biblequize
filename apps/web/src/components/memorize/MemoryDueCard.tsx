import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMemoryDueCount } from '../../hooks/useMemoryVerses'

interface MemoryDueCardProps {
  enabled: boolean
}

/**
 * Home shortcut "memory verses due today" (SPEC_USER §5.1.1). Renders only when
 * at least one verse is due — a secondary nudge, so loading/error stay silent.
 */
export default function MemoryDueCard({ enabled }: MemoryDueCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: dueCount = 0 } = useMemoryDueCount(enabled)
  if (!enabled || dueCount <= 0) return null

  return (
    <div
      data-testid="home-memory-due-card"
      className="mx-auto mt-6 flex max-w-[740px] items-center gap-3 rounded-2xl border border-bq-sapphire/25 border-l-[3px] border-l-bq-sapphire bg-bq-sapphire/10 px-4 py-3.5"
    >
      <span aria-hidden className="material-symbols-outlined shrink-0 text-[26px] text-bq-sapphire">auto_stories</span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-bq-sapphire">
          {t('memorize.homeCard.label')}
        </div>
        <div className="text-[14px] font-bold leading-tight text-bq-ink">
          {t('memorize.homeCard.title', { count: dueCount })}
        </div>
      </div>
      <button
        type="button"
        data-testid="home-memory-due-btn"
        onClick={() => navigate('/practice/memorize/session')}
        className="shrink-0 rounded-lg bg-bq-sapphire px-4 py-2 text-xs font-semibold text-white transition hover:brightness-105 active:scale-95"
      >
        {t('memorize.homeCard.cta')}
      </button>
    </div>
  )
}
