import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

/** Mirror of {@code JourneyResponse} on the BE — we only consume the
 *  summary (counts + currentBook) for the Home widget. The full books
 *  array is reserved for the standalone /journey screen. */
interface JourneyData {
  summary: {
    totalBooks: number
    completedBooks: number
    oldTestamentCompleted: number
    newTestamentCompleted: number
    overallMasteryPercent: number
    currentBook: string | null
  }
  books?: Array<{ book: string; testament: string }>
}

const OT_TOTAL = 39
const NT_TOTAL = 27

/**
 * Bible Journey card on Home — H6 elevated treatment.
 *
 * Uses the BE-provided OT/NT split so we don't have to re-derive it on
 * the client (see PROMPT_HOME_REDESIGN.md pre-flight). Renders a split
 * progress bar with two flex segments (39 OT slots / 27 NT slots), each
 * filled by its own count. The whole card is a Link to /journey for
 * the deeper book-by-book view.
 */
export default function BibleJourneyCard() {
  const { t, i18n } = useTranslation()

  const { data } = useQuery<JourneyData>({
    queryKey: ['journey-summary', i18n.language],
    queryFn: async () => (await api.get(`/api/me/journey?language=${i18n.language}`)).data,
    staleTime: 60_000,
  })

  if (!data) return null

  const { summary, books } = data
  const otDone = summary.oldTestamentCompleted ?? 0
  const ntDone = summary.newTestamentCompleted ?? 0
  const totalDone = summary.completedBooks
  const total = summary.totalBooks || 66
  const otPct = Math.min(100, (otDone / OT_TOTAL) * 100)
  const ntPct = Math.min(100, (ntDone / NT_TOTAL) * 100)

  // Decide subtitle copy. Order matters: max-tier wins, then "not
  // started", then OT-vs-NT phase. The OT/NT decision uses the
  // current book's testament when the books array is present, falling
  // back to count-based heuristics otherwise.
  const currentBookEntry = data.books?.find(b => b.book === summary.currentBook)
  const isAllDone = totalDone >= total
  const isNotStarted = !summary.currentBook && totalDone === 0
  const inOldTestament = currentBookEntry
    ? currentBookEntry.testament === 'OLD'
    : otDone < OT_TOTAL

  let subtitle: string
  if (isAllDone) {
    subtitle = t('home.journey.subtitleDone')
  } else if (isNotStarted) {
    subtitle = t('home.journey.subtitleStart')
  } else if (inOldTestament) {
    subtitle = t('home.journey.subtitleOT', { book: summary.currentBook ?? 'Genesis' })
  } else {
    subtitle = t('home.journey.subtitleNT', {
      book: summary.currentBook ?? '',
      count: NT_TOTAL - ntDone,
    })
  }

  return (
    <Link
      to="/journey"
      data-testid="bible-journey-card"
      className="block rounded-2xl border border-[rgba(74,158,255,0.2)] p-3.5 md:p-4 bg-gradient-to-br from-[rgba(74,158,255,0.06)] to-[rgba(168,85,247,0.06)] hover:from-[rgba(74,158,255,0.1)] hover:to-[rgba(168,85,247,0.1)] transition-colors"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <div className="text-on-surface text-[12px] md:text-[13px] font-medium">
            {t('home.journey.title')}
          </div>
          <div
            data-testid="bible-journey-subtitle"
            className="text-on-surface-variant/55 text-[10px] md:text-[11px] mt-0.5 leading-snug"
          >
            {subtitle}
          </div>
        </div>
        <div
          data-testid="bible-journey-count"
          className="text-on-surface-variant/40 text-[10px] md:text-[11px] shrink-0"
        >
          {totalDone} / {total}
        </div>
      </div>

      {/* Split bar: 39 OT segments + 27 NT segments */}
      <div className="flex gap-[3px] h-[5px] md:h-[6px]" data-testid="bible-journey-bar">
        <div
          className="rounded-[2px] overflow-hidden"
          style={{ flex: OT_TOTAL, background: 'rgba(74,158,255,0.15)' }}
        >
          <div
            data-testid="bible-journey-ot-fill"
            className="h-full rounded-[2px] transition-[width] duration-500"
            style={{ width: `${otPct}%`, background: '#4a9eff' }}
          />
        </div>
        <div
          className="rounded-[2px] overflow-hidden"
          style={{ flex: NT_TOTAL, background: 'rgba(168,85,247,0.15)' }}
        >
          <div
            data-testid="bible-journey-nt-fill"
            className="h-full rounded-[2px] transition-[width] duration-500"
            style={{ width: `${ntPct}%`, background: '#a855f7' }}
          />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] md:text-[10px]" style={{ color: 'rgba(74,158,255,0.7)' }}>
          {t('home.journey.otLabel')}
        </span>
        <span className="text-[9px] md:text-[10px]" style={{ color: 'rgba(168,85,247,0.7)' }}>
          {t('home.journey.ntLabel')}
        </span>
      </div>
    </Link>
  )
}
