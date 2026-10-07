import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'

// Shape returned by GET /api/admin/questions/coverage. BE returns either form
// depending on grouping mode; FE normalises to array via Object.entries below.
interface BookCoverage {
  book?: string
  easy?: number
  medium?: number
  hard?: number
}
type CoverageResponse = Record<string, BookCoverage> | BookCoverage[]

export default function QuestionQuality() {
  const { t } = useTranslation()
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    api.get('/api/admin/questions/coverage')
      .then(res => setCoverage(res.data))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div data-testid="admin-quality-page" className="space-y-6">
      <div><h2 className="text-3xl font-extrabold text-[#1D2B22] tracking-tight">{t('admin.questionQuality.title')}</h2><p className="text-[#4D3A1F] text-sm mt-1">{t('admin.questionQuality.subtitle')}</p></div>

      {/* Coverage Map — the only real, backed view. ADM-5 removed the hardcoded
          "overall score" (72) + the 3 "needs API" problem-category placeholders. */}
      <div data-testid="quality-coverage-map" className="rounded-lg border border-[#1D2B22]/10 bg-[#FFF8E7] p-5">
        <h3 className="font-medium text-[#1D2B22] mb-4">{t('admin.questionQuality.coverageTitle')}</h3>
        {isLoading ? <p className="text-[#4D3A1F]/40 text-sm">{t('admin.questionQuality.loading')}</p>
         : !coverage ? <p className="text-[#4D3A1F]/40 text-sm">{t('admin.questionQuality.loadError')}</p>
         : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(Array.isArray(coverage)
              ? coverage
              : Object.entries(coverage).map(([book, data]) => ({ book, ...(data as BookCoverage) }))
            ).map((item: BookCoverage, i: number) => {
              const easy = item.easy || 0
              const medium = item.medium || 0
              const hard = item.hard || 0
              const total = easy + medium + hard
              const minPool = 60 // 30+20+10
              const pct = Math.min(100, Math.round((total / minPool) * 100))
              return (
                <div key={i} data-testid="coverage-book-bar" className="flex items-center gap-3">
                  <span className="text-[#4D3A1F]/60 text-xs w-28 truncate">{item.book || t('admin.questionQuality.bookFallback', { index: i + 1 })}</span>
                  <div className="flex-1 h-2 bg-[#F0DFB8] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-[#FFC93C]' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span data-testid="coverage-pct" className="text-[#4D3A1F]/40 text-xs w-8 text-right">{total}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
