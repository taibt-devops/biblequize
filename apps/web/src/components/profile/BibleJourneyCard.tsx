import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { getQuizLanguage } from '../../utils/quizLanguage'
import type { BookProgress, BookStatus, JourneyResponse } from './types'
import { SkeletonBlock } from './SkeletonBlock'

const STATUS_TILE: Record<BookStatus, string> = {
  COMPLETED: 'bg-bq-emerald/15 border-bq-emerald/40 text-bq-emerald hover:bg-bq-emerald/25',
  IN_PROGRESS: 'bg-bq-amber/15 border-bq-amber/40 text-bq-amberd hover:bg-bq-amber/25',
  LOCKED: 'bg-bq-inset border-bq-hair text-bq-ink3',
}

const STATUS_ICON: Record<BookStatus, string> = {
  COMPLETED: 'check_circle',
  IN_PROGRESS: 'pending',
  LOCKED: 'lock',
}

export function BibleJourneyCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const lang = getQuizLanguage()
  const { data, isLoading, isError } = useQuery<JourneyResponse>({
    queryKey: ['profile-journey', lang],
    queryFn: () => api.get(`/api/me/journey?language=${lang}`).then(r => r.data),
    staleTime: 60_000,
  })

  const grouped = useMemo(() => {
    const old: BookProgress[] = []
    const newT: BookProgress[] = []
    for (const b of data?.books ?? []) {
      if (b.testament === 'OLD') old.push(b)
      else newT.push(b)
    }
    return { old, newT }
  }, [data])

  if (isLoading) return <SkeletonBlock className="h-72" />
  if (isError || !data) return null

  const { summary } = data

  return (
    <section data-testid="profile-journey" className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-[19px] font-extrabold text-bq-ink inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-bq-amberd">menu_book</span>
            {t('profile.journeyTitle')}
          </h2>
          <p className="text-xs text-bq-ink2 mt-0.5">
            {t('profile.journeyBooksLabel', { n: summary.total })}
          </p>
        </div>
        <div className="text-xs text-bq-ink2 text-right">
          <p>
            <span className="text-bq-ink font-bold">{summary.overallMastery}%</span>{' '}
            {t('profile.journeyMasteryOverall')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5 text-center">
        <div className="bg-bq-emerald/10 border border-bq-emerald/20 rounded-xl py-2">
          <p className="text-base font-extrabold text-bq-emerald">{summary.completed}</p>
          <p className="text-[12px] font-bold text-bq-ink2 mt-0.5">
            {t('profile.journeyCompleted')}
          </p>
        </div>
        <div className="bg-bq-amber/10 border border-bq-amber/20 rounded-xl py-2">
          <p className="text-base font-extrabold text-bq-amberd">{summary.inProgress}</p>
          <p className="text-[12px] font-bold text-bq-ink2 mt-0.5">
            {t('profile.journeyInProgress')}
          </p>
        </div>
        <div className="bg-bq-inset border border-bq-hair rounded-xl py-2">
          <p className="text-base font-extrabold text-bq-ink3">{summary.locked}</p>
          <p className="text-[12px] font-bold text-bq-ink2 mt-0.5">
            {t('profile.journeyLocked')}
          </p>
        </div>
      </div>

      <JourneyTestamentSection
        title={t('profile.journeyOldTestament')}
        books={grouped.old}
        completedCount={summary.oldTestamentCompleted}
        onClick={(b) => b.status !== 'LOCKED' && navigate(`/practice?book=${encodeURIComponent(b.book)}`)}
      />
      <JourneyTestamentSection
        title={t('profile.journeyNewTestament')}
        books={grouped.newT}
        completedCount={summary.newTestamentCompleted}
        onClick={(b) => b.status !== 'LOCKED' && navigate(`/practice?book=${encodeURIComponent(b.book)}`)}
      />
    </section>
  )
}

function JourneyTestamentSection({ title, books, completedCount, onClick }: {
  title: string
  books: BookProgress[]
  completedCount: number
  onClick: (book: BookProgress) => void
}) {
  if (books.length === 0) return null
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13.5px] font-extrabold text-bq-ink2">{title}</h3>
        <span className="text-[10px] text-bq-ink2">{completedCount}/{books.length}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {books.map((b) => (
          <button
            key={b.book}
            onClick={() => onClick(b)}
            disabled={b.status === 'LOCKED'}
            title={`${b.bookVi} · ${b.masteryPercent}%`}
            className={`relative rounded-lg border px-2 py-1.5 text-left transition-colors ${STATUS_TILE[b.status]} ${b.status === 'LOCKED' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold truncate flex-1">{b.bookVi}</span>
              <span className="material-symbols-outlined text-[12px] shrink-0">{STATUS_ICON[b.status]}</span>
            </div>
            <p className="text-[9px] opacity-70 mt-0.5">{b.masteryPercent}%</p>
          </button>
        ))}
      </div>
    </div>
  )
}
