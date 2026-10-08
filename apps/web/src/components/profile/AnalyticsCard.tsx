import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { BookAccuracy, WeaknessData } from './types'
import { SkeletonBlock } from './SkeletonBlock'

export function AnalyticsCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery<WeaknessData>({
    queryKey: ['weaknesses'],
    queryFn: () => api.get('/api/me/weaknesses').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return <SkeletonBlock className="h-56" />
  if (isError || !data) return null
  if (data.weakBooks.length === 0 && data.strongBooks.length === 0) return null

  const suggested = data.suggestedPractice ?? data.weakBooks[0]?.book ?? null
  const suggestedBook = data.weakBooks.find(b => b.book === suggested) ?? data.weakBooks[0]

  return (
    <section data-testid="profile-weakness-widget" className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-[19px] font-extrabold text-bq-ink inline-flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[18px] text-bq-amberd">analytics</span>
        {t('profile.analyticsTitle')}
      </h2>

      {data.strongBooks.length > 0 && (
        <>
          <h3 className="text-[13.5px] font-extrabold text-bq-emerald inline-flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            {t('profile.strongBooks')}
          </h3>
          <div className="mb-5">
            {data.strongBooks.slice(0, 3).map(b => (
              <BookRow key={b.book} book={b} barClass="bg-gradient-to-r from-bq-emerald to-bq-emerald/70" />
            ))}
          </div>
        </>
      )}

      {data.weakBooks.length > 0 && (
        <>
          <h3 className="text-[13.5px] font-extrabold text-bq-ruby inline-flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-[16px]">trending_down</span>
            {t('profile.weakBooks')}
          </h3>
          <div className="mb-4">
            {data.weakBooks.slice(0, 3).map(b => (
              <BookRow key={b.book} book={b} barClass="bg-gradient-to-r from-bq-ruby to-bq-ruby/70" />
            ))}
          </div>
        </>
      )}

      {suggestedBook && (
        <button
          onClick={() => navigate(`/practice?book=${encodeURIComponent(suggestedBook.book)}`)}
          className="w-full mt-2 p-4 rounded-xl bg-gradient-to-br from-bq-amber/15 to-bq-amber/[0.05] border border-bq-amber/25 hover:bg-bq-amber/20 transition-colors flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-bq-amber/20 text-bq-amberd flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-bq-ink">{t('profile.practiceCtaTitle', { book: suggestedBook.book })}</p>
            <p className="text-[11px] text-bq-ink2 mt-0.5">
              {t('profile.practiceCtaSub', { n: suggestedBook.wrong })}
            </p>
          </div>
          <span className="material-symbols-outlined text-bq-amberd">arrow_forward</span>
        </button>
      )}
    </section>
  )
}

function BookRow({ book, barClass }: { book: BookAccuracy; barClass: string }) {
  const pct = Math.round(book.accuracy * 100)
  return (
    <div className="flex items-center gap-3 py-2 border-b border-bq-hair last:border-0">
      <div className="text-[13px] font-semibold text-bq-ink flex-1 truncate">{book.book}</div>
      <div className="w-24 h-1.5 bg-bq-inset rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs font-bold text-bq-ink min-w-[44px] text-right">{pct}%</div>
    </div>
  )
}
