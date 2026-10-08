import { useTranslation } from 'react-i18next'
import { Plaque } from '../../components/lk/Place'

interface PageHeaderProps {
  todayLabel: string
  seasonName?: string
}

/** /daily title (LKF-10): the post house plaque with the dove, today's date and the season. */
export function PageHeader({ todayLabel, seasonName }: PageHeaderProps) {
  const { t } = useTranslation()
  return (
    <div className="mb-6 space-y-3">
      <Plaque className="text-[22px] md:text-[32px]">
        <img src="/images/lk/dove-letter.webp" alt="" aria-hidden className="h-[1.3em] -my-1" />
        {t('daily.heading')}
      </Plaque>
      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-bq-white border-2 border-bq-ink text-[13.5px] font-bold">
          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
          {todayLabel}
        </span>
        {seasonName && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-bq-amber border-2 border-bq-ink text-[13.5px] font-extrabold">
            ★ {seasonName}
          </span>
        )}
      </div>
    </div>
  )
}
