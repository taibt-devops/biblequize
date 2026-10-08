import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import JourneyMap, { type MapBook, type RegionProgress } from '../components/journey/JourneyMap'
import { BookDetailCard, JourneyBadges, RegionList, type SelectedBook } from '../components/journey/JourneyAside'
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

/**
 * Journey of the 66 books (SPEC_USER §6.3, LKF-6 — Journey artboard): the painted map with the
 * 8 lands and the open land's books as stations, the open book's card, the lands list, the
 * milestone badges, and below them the ledger of every book land by land.
 */
export default function Journey() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isVi = i18n.language === 'vi'
  const [openRegion, setOpenRegion] = useState<JourneyRegionId | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<JourneyData>({
    queryKey: ['journey', i18n.language],
    queryFn: async () => (await api.get(`/api/me/journey?language=${i18n.language}`)).data,
  })

  if (isLoading) {
    return (
      <div className="max-w-[1280px] mx-auto w-full space-y-5 animate-pulse">
        <div className="h-16 w-2/3 rounded-2xl bg-bq-inset" />
        <div className="flex flex-wrap gap-6">
          <div className="flex-[999_1_640px] aspect-[3/2] rounded-bq bg-bq-inset" />
          <div className="flex-[1_1_320px] h-[420px] rounded-bq bg-bq-inset" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="h-40 mb-4" />
        <p className="font-bold text-bq-ink2">{t('common.error')}</p>
      </div>
    )
  }

  const { summary, books } = data
  const nameOf = (b: BookProgress) => (isVi && b.bookVi ? b.bookVi : b.book)
  const pct = summary.totalBooks > 0 ? Math.round((summary.completedBooks / summary.totalBooks) * 100) : 0
  const practice = (key: string) => navigate(`/practice?book=${encodeURIComponent(key)}`)

  const booksOf = (r: JourneyRegion) => books.filter(b => b.order >= r.from && b.order <= r.to)
  const progress = Object.fromEntries(JOURNEY_REGIONS.map(r => {
    const bs = booksOf(r)
    return [r.id, { done: bs.filter(b => b.status === 'COMPLETED').length, total: bs.length || r.to - r.from + 1 }]
  })) as Record<JourneyRegionId, RegionProgress>

  const current = books.find(b => b.book === summary.currentBook) ?? books.find(b => b.status !== 'COMPLETED')
  const currentRegion = current ? regionOfOrder(current.order)?.id ?? null : null
  const open = JOURNEY_REGIONS.find(r => r.id === (openRegion ?? currentRegion)) ?? JOURNEY_REGIONS[0]
  const openBooks = booksOf(open)
  // mastery can exceed 100 in the API payload; show at most 100 %
  const pctOf = (b: BookProgress) => Math.min(100, Math.round(b.masteryPercent))
  const mapBooks: MapBook[] = openBooks.map(b => ({ key: b.book, name: nameOf(b), order: b.order, status: b.status, pct: pctOf(b) }))
  const selectedRaw = books.find(b => b.book === selected)
    ?? (current && regionOfOrder(current.order)?.id === open.id ? current : undefined)
    ?? openBooks.find(b => b.status !== 'COMPLETED') ?? openBooks[0]
  const selectedBook: SelectedBook | null = selectedRaw ? {
    key: selectedRaw.book, name: nameOf(selectedRaw), order: selectedRaw.order, status: selectedRaw.status,
    pct: pctOf(selectedRaw), mastered: selectedRaw.masteredQuestions, total: selectedRaw.totalQuestions,
    regionId: regionOfOrder(selectedRaw.order)?.id ?? open.id,
  } : null

  const openLand = (id: JourneyRegionId) => { setOpenRegion(id); setSelected(null) }
  const completedOrders = books.filter(b => b.status === 'COMPLETED').map(b => b.order)

  return (
    <div className="max-w-[1280px] mx-auto w-full" data-testid="journey-page">
      {/* header: title + what conquering means, and the tally */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="max-w-[720px]">
          <h1 className="m-0 font-display text-[34px] md:text-[42px] leading-[1.05] font-extrabold">{t('journey.lk.title')}</h1>
          <p className="mt-1.5 mb-0 font-read text-[15px] md:text-[16px] leading-relaxed text-bq-ink2">{t('journey.lk.subtitle')}</p>
        </div>
        <section data-testid="journey-summary-card" className="flex items-center gap-3 pl-2.5 pr-4 py-2 bg-bq-white border-[3px] border-bq-ink rounded-[18px] shadow-[0_5px_0_#1D2B22]">
          <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-11" />
          <div>
            <div className="text-[24px] font-extrabold leading-none">{t('journey.lk.conqueredOf', { done: summary.completedBooks, total: summary.totalBooks })}</div>
            <div className="text-[14px] font-bold text-bq-ink2">{t('journey.lk.conqueredLabel')}</div>
            <div className="flex flex-wrap gap-1.5 mt-1 text-[12px] font-extrabold">
              <span data-testid="journey-mastery-pct" className="px-2 bg-bq-cream border-2 border-bq-ink rounded-full">{t('journey.lk.masteryOverall', { pct })}</span>
              <span data-testid="journey-books-completed" className="px-2 bg-bq-leaf border-2 border-bq-ink rounded-full">★ {summary.completedBooks}</span>
              <span data-testid="journey-books-inprogress" className="px-2 bg-bq-amber border-2 border-bq-ink rounded-full">{t('journey.inProgress')}: {summary.inProgressBooks}</span>
            </div>
          </div>
        </section>
      </div>

      {/* map + the open book, the lands, the badges */}
      <div className="flex flex-wrap gap-6 items-start">
        <div className="flex-[999_1_640px] min-w-0">
          <JourneyMap
            progress={progress}
            currentRegion={currentRegion}
            openRegion={open.id}
            onSelectRegion={openLand}
            books={mapBooks}
            selectedBook={selectedBook?.key ?? null}
            currentBook={current?.book ?? null}
            onSelectBook={setSelected}
          />
        </div>
        <aside className="flex-[1_1_320px] min-w-0 flex flex-col gap-5">
          {selectedBook && <BookDetailCard book={selectedBook} onPractice={() => practice(selectedBook.key)} />}
          <RegionList progress={progress} currentRegion={currentRegion} openRegion={open.id} onOpen={openLand} />
          <JourneyBadges completedOrders={completedOrders} />
        </aside>
      </div>

      {/* ledger: every book, land by land */}
      <h2 className="mt-10 mb-4 font-display text-[28px] font-extrabold">{t('journey.lk.ledgerTitle')}</h2>
      <div className="grid gap-8 lg:grid-cols-2">
        {(['OLD', 'NEW'] as const).map(testament => (
          <div key={testament} data-testid={testament === 'OLD' ? 'journey-old-testament' : 'journey-new-testament'} className="space-y-5">
            <h3 className="m-0 font-display text-[22px] font-extrabold text-bq-ink2">
              {t(testament === 'OLD' ? 'journey.oldTestament' : 'journey.newTestament')}
            </h3>
            {JOURNEY_REGIONS.filter(r => r.testament === testament).map(r => (
              <LandSection key={r.id} region={r} books={booksOf(r)} nameOf={nameOf} onBookClick={b => practice(b.book)} t={t} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function LandSection({
  region, books, nameOf, onBookClick, t
}: {
  region: JourneyRegion
  books: BookProgress[]
  nameOf: (b: BookProgress) => string
  onBookClick: (b: BookProgress) => void
  t: (key: string, opts?: Record<string, any>) => string
}) {
  const done = books.filter(b => b.status === 'COMPLETED').length
  return (
    <section id={`journey-land-${region.id}`} data-testid={`journey-land-${region.id}`} className="scroll-mt-24">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-2.5">
        <span className="grid place-items-center w-8 h-8 rounded-full border-[3px] border-bq-ink bg-bq-white font-extrabold text-[14px]">{region.no}</span>
        <span className="font-display text-[19px] font-extrabold">{t(`journey.regions.${region.id}.name`)}</span>
        <span className="font-read text-[14px] text-bq-ink3">{t(`journey.regions.${region.id}.place`)}</span>
        <span className="ml-auto text-[14px] font-extrabold text-bq-ink2">{t('journey.regionBooks', { done, total: books.length })}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {books.map(book => (
          <BookTile key={book.order} book={book} name={nameOf(book)} onClick={() => onBookClick(book)} t={t} />
        ))}
      </div>
    </section>
  )
}

function BookTile({ book, name, onClick, t }: { book: BookProgress; name: string; onClick: () => void; t: (key: string, opts?: Record<string, any>) => string }) {
  const done = book.status === 'COMPLETED'
  return (
    <div data-testid="journey-book-card">
      <button
        type="button"
        data-testid={`journey-book-card-${book.book}`}
        onClick={onClick}
        className={`w-full text-left px-3 py-2.5 rounded-2xl border-[3px] border-bq-ink shadow-[0_4px_0_#1D2B22] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none ${done ? 'bg-bq-leaf' : 'bg-bq-white'}`}
      >
        <span className="flex items-center gap-2">
          <span className={`shrink-0 w-7 h-7 grid place-items-center rounded-full border-2 border-bq-ink text-[12px] font-extrabold ${done ? 'bg-bq-amber text-[15px]' : 'bg-bq-paper text-bq-ink2'}`}>
            {done ? '★' : book.order}
          </span>
          <span data-testid="journey-book-name" className="min-w-0 truncate font-extrabold text-[15px]">{name}</span>
        </span>
        <span className="flex items-center gap-2 mt-1.5">
          <span className="flex-1 h-2.5 bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
            <span className={`block h-full ${done ? 'bg-bq-emerald' : 'bg-bq-amber'}`} style={{ width: `${Math.min(100, book.masteryPercent)}%` }} />
          </span>
          <span data-testid="journey-book-mastery" className="text-[12px] font-extrabold tabular-nums text-bq-ink2">
            {book.totalQuestions > 0 ? `${Math.min(100, Math.round(book.masteryPercent))}%` : t('journey.noQuestions')}
          </span>
        </span>
      </button>
    </div>
  )
}
