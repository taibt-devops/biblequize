import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

interface BookAccuracy {
  book: string
  totalAnswered: number
  correct: number
  wrong: number
  accuracy: number
}

interface WeaknessData {
  weakBooks: BookAccuracy[]
  strongBooks: BookAccuracy[]
  suggestedPractice: string | null
}

export default function WeaknessWidget() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<WeaknessData>({
    queryKey: ['weaknesses'],
    queryFn: () => api.get('/api/me/weaknesses').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  if (isLoading || !data) return null
  if (data.weakBooks.length === 0 && data.strongBooks.length === 0) return null

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-bq-amberd" style={{ fontVariationSettings: "'FILL' 1" }}>
          analytics
        </span>
        <h2 className="text-lg font-black text-bq-ink">{t('components.weakness.title')}</h2>
      </div>

      <div className="bg-bq-white rounded-xl p-5 border border-bq-hair shadow-bq-soft space-y-5">
        {/* Strong books */}
        {data.strongBooks.length > 0 && (
          <div>
            <p className="text-[12.5px] font-bold text-bq-ink2 mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-bq-emerald">trending_up</span>
              {t('components.weakness.strongLabel')}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.strongBooks.map(b => (
                <div key={b.book} className="flex items-center gap-2 bg-bq-emerald/10 border border-bq-emerald/20 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-bold text-bq-emerald">{b.book}</span>
                  <span className="text-[10px] font-black text-bq-emerald">{b.accuracy}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak books */}
        {data.weakBooks.length > 0 && (
          <div>
            <p className="text-[12.5px] font-bold text-bq-ink2 mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-bq-amberd">menu_book</span>
              {t('components.weakness.weakLabel')}
            </p>
            <div className="space-y-2">
              {data.weakBooks.map(b => (
                <div key={b.book} data-testid="profile-weakness-item" className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-bq-ink">{b.book}</span>
                    <span className="text-[10px] text-bq-ink2">
                      {t('components.weakness.correctFraction', { correct: b.correct, total: b.totalAnswered })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-bq-inset rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${b.accuracy >= 60 ? 'bg-bq-amber' : 'bg-bq-ruby'}`}
                        style={{ width: `${b.accuracy}%` }}
                      />
                    </div>
                    <span className={`text-xs font-black ${b.accuracy >= 60 ? 'text-bq-amberd' : 'text-bq-ruby'}`}>
                      {b.accuracy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested practice */}
        {data.suggestedPractice && (
          <button
            onClick={() => navigate('/practice', { state: { book: data.suggestedPractice } })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-bq-amber/10 border border-bq-amber/20 rounded-xl text-bq-amberd text-sm font-bold hover:bg-bq-amber/20 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">play_circle</span>
            {t('components.weakness.practiceCta', { book: data.suggestedPractice })}
          </button>
        )}
      </div>
    </section>
  )
}
