import React from 'react'
import { useTranslation } from 'react-i18next'
import { useBookName } from '../../../hooks/useBookName'

interface BookCoverage {
  book: string; easy: number; medium: number; hard: number; total: number; meetsMinimum: boolean
}

export default function CoverageChart({ books }: { books: BookCoverage[] }) {
  const { t, i18n } = useTranslation()
  const getBookName = useBookName()
  const lang = i18n.language === 'en' ? 'en' : 'vi'

  return (
    <div className="bg-[#FFF8E7] rounded-xl border border-[#1D2B22]/10 p-6">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[#1D2B22]">{t('admin.dashboard.coverage.title')}</h2>
          <p className="text-[11px] text-[#4D3A1F]/45 mt-1 uppercase tracking-widest font-medium">{t('admin.dashboard.coverage.subtitle')}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] uppercase text-[#4D3A1F]/70">{t('admin.dashboard.coverage.healthy')}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-[10px] uppercase text-[#4D3A1F]/70">{t('admin.dashboard.coverage.fair')}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] uppercase text-[#4D3A1F]/70">{t('admin.dashboard.coverage.critical')}</span></span>
        </div>
      </div>

      {!books || books.length === 0 ? (
        <div className="text-[#4D3A1F]/40 text-sm py-8 text-center">{t('admin.dashboard.coverage.noData')}</div>
      ) : (() => {
        const healthy = books.filter(b => b.meetsMinimum).length
        const total = books.length
        const healthyPct = total > 0 ? Math.round((healthy / total) * 100) : 0
        return (
          <>
            {/* Summary stat */}
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[#1D2B22]/10">
              <div className="shrink-0">
                <span className="text-2xl font-bold text-[#1D2B22] font-mono leading-none">
                  {healthy}<span className="text-[#4D3A1F]/35 text-base">/{total}</span>
                </span>
                <p className="text-[10px] uppercase tracking-wider text-[#4D3A1F]/50 mt-1">{t('admin.dashboard.coverage.summary')}</p>
              </div>
              <div className="flex-1 h-2 bg-[#EFE3C3] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${healthyPct}%` }} />
              </div>
              <span className="text-sm font-mono text-[#2E7D4F] shrink-0">{healthyPct}%</span>
            </div>

            {/* Per-book bars */}
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-2">
              {books.map(b => {
                const pct = Math.min(100, Math.round((b.total / 60) * 100))
                const bar = b.meetsMinimum ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                const txt = b.meetsMinimum ? 'text-[#2E7D4F]' : pct >= 50 ? 'text-[#8A5A12]' : 'text-[#B3452F]'
                return (
                  <div key={b.book} data-testid="coverage-book-bar" className="grid grid-cols-12 items-center gap-4 group">
                    <span className="col-span-3 lg:col-span-2 text-[10px] font-mono text-[#4D3A1F]/80 group-hover:text-[#8A5A12] transition-colors uppercase truncate">{getBookName(b.book, lang)}</span>
                    <div className="col-span-8 lg:col-span-9 h-1.5 bg-[#EFE3C3] overflow-hidden rounded-full">
                      <div className={`h-full ${bar} rounded-full transition-all group-hover:brightness-125`} style={{ width: `${pct}%` }} />
                    </div>
                    <span data-testid="coverage-pct" className={`col-span-1 text-[10px] font-mono text-right ${txt}`}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}
    </div>
  )
}
