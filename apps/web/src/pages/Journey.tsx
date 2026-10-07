import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import JourneyMap, { type RegionProgress } from '../components/journey/JourneyMap'
import { JOURNEY_REGIONS, regionOfOrder, type JourneyRegion, type JourneyRegionId } from '../data/journeyRegions'

interface BookProgress {
  book: string
  bookVi: string
  order: number
  testament: 'OLD' | 'NEW'
  totalQuestions: number
  masteredQuestions: number
  masteryPercent: number
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'
}

interface JourneySummary {
  totalBooks: number
  completedBooks: number
  inProgressBooks: number
  lockedBooks: number
  overallMasteryPercent: number
  oldTestamentCompleted: number
  newTestamentCompleted: number
  currentBook: string | null
}

interface JourneyData {
  summary: JourneySummary
  books: BookProgress[]
}

export default function Journey() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isVi = i18n.language === 'vi'

  const { data, isLoading, error } = useQuery<JourneyData>({
    queryKey: ['journey', i18n.language],
    queryFn: async () => (await api.get(`/api/me/journey?language=${i18n.language}`)).data,
  })

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto w-full">
        <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-6 space-y-3">
          <div className="animate-pulse bg-bq-inset h-6 w-48 rounded" />
          <div className="animate-pulse bg-bq-inset h-4 w-64 rounded" />
          <div className="animate-pulse bg-bq-inset h-3 w-full rounded-full" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-bq-inset h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="material-symbols-outlined text-5xl text-bq-ruby/40 mb-4">error</span>
        <p className="text-bq-ink2">{t('common.error')}</p>
      </div>
    )
  }

  const { summary, books } = data
  const pct = summary.totalBooks > 0 ? Math.round((summary.completedBooks / summary.totalBooks) * 100) : 0
  const onBookClick = (book: BookProgress) => navigate(`/practice?book=${encodeURIComponent(book.book)}`)

  // LKD-17 (SPEC_USER §6.3): the 66 books are walked land by land on a painted map.
  const booksOf = (r: JourneyRegion) => books.filter(b => b.order >= r.from && b.order <= r.to)
  const progress = Object.fromEntries(JOURNEY_REGIONS.map(r => {
    const bs = booksOf(r)
    return [r.id, { done: bs.filter(b => b.status === 'COMPLETED').length, total: bs.length || r.to - r.from + 1 }]
  })) as Record<JourneyRegionId, RegionProgress>
  const currentOrder = books.find(b => b.book === summary.currentBook)?.order
    ?? books.find(b => b.status !== 'COMPLETED')?.order
  const currentRegion = currentOrder ? regionOfOrder(currentOrder)?.id ?? null : null
  const scrollToLand = (id: JourneyRegionId) =>
    document.getElementById(`journey-land-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="space-y-7 max-w-5xl mx-auto w-full" data-testid="journey-page">
      {/* Summary */}
      <section className="bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card p-6" data-testid="journey-summary-card">
        <div className="flex items-center gap-3 mb-2">
          <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-10" />
          <h1 className="text-[30px] font-display font-extrabold text-bq-ink leading-tight">{t('journey.title')}</h1>
        </div>
        <p data-testid="journey-mastery-pct" className="font-read text-bq-ink2 text-[15px] mb-3">
          {t('journey.conquered', { count: summary.completedBooks, total: summary.totalBooks, percent: pct })}
        </p>
        <div className="w-full h-4 bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
          <div className="h-full bg-bq-amber transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-[14px] font-bold text-bq-ink">
          <span data-testid="journey-books-completed" className="px-3 py-0.5 rounded-full border-2 border-bq-ink bg-bq-leaf">
            ★ {t('journey.completed')}: {summary.completedBooks}
          </span>
          <span data-testid="journey-books-inprogress" className="px-3 py-0.5 rounded-full border-2 border-bq-ink bg-bq-amber">
            {t('journey.inProgress')}: {summary.inProgressBooks}
          </span>
          <span className="px-3 py-0.5 rounded-full border-2 border-bq-ink bg-bq-paper text-bq-ink2">
            {t('journey.notStarted')}: {summary.lockedBooks}
          </span>
        </div>
      </section>

      <JourneyMap progress={progress} currentRegion={currentRegion} onSelectRegion={scrollToLand} />

      {(['OLD', 'NEW'] as const).map(testament => (
        <div key={testament} data-testid={testament === 'OLD' ? 'journey-old-testament' : 'journey-new-testament'} className="space-y-6">
          <h2 className="font-display text-[26px] font-extrabold text-bq-ink px-1">
            {t(testament === 'OLD' ? 'journey.oldTestament' : 'journey.newTestament')}
          </h2>
          {JOURNEY_REGIONS.filter(r => r.testament === testament).map(r => (
            <LandSection key={r.id} region={r} books={booksOf(r)} isVi={isVi} onBookClick={onBookClick} t={t} />
          ))}
        </div>
      ))}
    </div>
  )
}

function LandSection({
  region, books, isVi, onBookClick, t
}: {
  region: JourneyRegion
  books: BookProgress[]
  isVi: boolean
  onBookClick: (b: BookProgress) => void
  t: (key: string, opts?: Record<string, any>) => string
}) {
  const done = books.filter(b => b.status === 'COMPLETED').length
  return (
    <section id={`journey-land-${region.id}`} data-testid={`journey-land-${region.id}`} className="scroll-mt-24">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 px-1">
        <span className="grid place-items-center w-9 h-9 rounded-full border-[3px] border-bq-ink bg-bq-white font-extrabold">{region.no}</span>
        <h3 className="font-display text-[22px] font-extrabold text-bq-ink">{t(`journey.regions.${region.id}.name`)}</h3>
        <span className="text-[15px] font-semibold text-bq-ink3">{t(`journey.regions.${region.id}.place`)}</span>
        <span className="ml-auto text-[15px] font-bold text-bq-ink2">{t('journey.regionBooks', { done, total: books.length })}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {books.map(book => (
          <BookCard key={book.order} book={book} isVi={isVi} onClick={() => onBookClick(book)} t={t} />
        ))}
      </div>
    </section>
  )
}

function BookCard({
  book, isVi, onClick, t
}: {
  book: BookProgress
  isVi: boolean
  onClick: () => void
  t: (key: string, opts?: Record<string, any>) => string
}) {
  const isCompleted = book.status === 'COMPLETED'
  const started = book.status === 'IN_PROGRESS'
  const bookName = isVi && book.bookVi ? book.bookVi : book.book

  return (
    <div data-testid="journey-book-card">
    <div
      data-testid={`journey-book-card-${book.book}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={`flex items-center gap-4 p-3.5 rounded-2xl border-[3px] border-bq-ink shadow-bq-btn cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-bq-btn-down ${
        isCompleted ? 'bg-bq-leaf' : 'bg-bq-white'
      }`}
    >
      {/* Status: gold star when conquered, the book number otherwise */}
      <div className={`w-11 h-11 rounded-full border-[3px] border-bq-ink grid place-items-center shrink-0 font-extrabold ${
        isCompleted ? 'bg-bq-amber text-[20px]' : started ? 'bg-bq-white text-[15px]' : 'bg-bq-paper text-bq-ink3 text-[15px]'
      }`}>
        {isCompleted ? '★' : book.order}
      </div>

      <div className="flex-1 min-w-0">
        <span data-testid="journey-book-name" className="font-bold text-[16px] text-bq-ink">
          {bookName}
        </span>
        {book.totalQuestions > 0 ? (
          <p data-testid="journey-book-mastery" className="text-[13px] font-semibold text-bq-ink2">
            {t('journey.questions', { count: book.totalQuestions })} · {book.masteredQuestions}/{book.totalQuestions}
          </p>
        ) : (
          <p data-testid="journey-book-mastery" className="text-[13px] text-bq-ink3">{t('journey.noQuestions')}</p>
        )}
      </div>

      {book.totalQuestions > 0 && (
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-20 h-3 bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${isCompleted ? 'bg-bq-emerald' : 'bg-bq-amber'}`}
              style={{ width: `${Math.min(book.masteryPercent, 100)}%` }}
            />
          </div>
          <span className="text-[14px] font-extrabold w-11 text-right text-bq-ink">
            {book.masteryPercent}%
          </span>
        </div>
      )}
    </div>
    </div>
  )
}
