import { useEffect, useState } from 'react'

interface FeaturedDailyCardProps {
  /** Default 5 questions per Daily Challenge spec. */
  questionCount?: number
  /** Default ~3 minutes per Daily Challenge spec. */
  estimatedMinutes?: number
  /** Optional explicit countdown override (used by tests). When omitted,
   *  the component computes time-to-UTC-midnight on its own. */
  countdownText?: string
  /** Optional fixed date override for tests; otherwise uses today. */
  todayOverride?: Date
  onStart: () => void
}

function msUntilMidnightUtc(): number {
  const now = new Date()
  const utcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  )
  return utcMidnight.getTime() - now.getTime()
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDayMonth(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function FeaturedDailyCard({
  questionCount = 5,
  estimatedMinutes = 3,
  countdownText,
  todayOverride,
  onStart,
}: FeaturedDailyCardProps) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (countdownText !== undefined) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [countdownText])
  void tick
  const computed = countdownText ?? formatCountdown(msUntilMidnightUtc())
  const today = todayOverride ?? new Date()
  const dayLabel = formatDayMonth(today)

  return (
    <div
      data-testid="featured-daily-card"
      className="relative overflow-hidden rounded-2xl bg-bq-white border border-bq-amber/30 p-5 md:p-6 mb-5 shadow-bq-amb transition-all duration-200 hover:border-bq-amber/50 hover:-translate-y-px"
    >
      {/* Signature spectrum top strip */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[5px] bg-bq-spectrum" />

      {/* Label row: dot + label + date */}
      <div
        data-testid="featured-daily-card-label"
        className="text-[10px] font-bold tracking-[0.22em] uppercase text-bq-amberd mb-2 flex items-center gap-2"
      >
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-bq-amber animate-pulse"
        />
        <span>Thử thách hôm nay</span>
        <span className="opacity-50">·</span>
        <span data-testid="featured-daily-card-date" className="text-bq-ink2 font-semibold tracking-[0.1em]">
          {dayLabel}
        </span>
      </div>

      {/* Heading with "Lời Chúa" gold serif emphasis */}
      <h2 className="font-display text-[16px] sm:text-[18px] md:text-[22px] font-extrabold text-bq-ink leading-[1.25] tracking-[-0.02em] mb-3.5 whitespace-nowrap">
        Bắt đầu ngày mới với{' '}
        <span className="font-literata text-bq-amberd italic font-bold">
          Lời Chúa
        </span>
      </h2>

      {/* Pill chips row */}
      <div
        data-testid="featured-daily-card-meta"
        className="flex flex-nowrap gap-1.5 mb-3.5 whitespace-nowrap"
      >
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-bq-hair bg-bq-paper text-[11px] text-bq-ink2">
          <span aria-hidden>📖</span>
          {questionCount} câu
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-bq-hair bg-bq-paper text-[11px] text-bq-ink2">
          <span aria-hidden>⏱</span>
          ~{estimatedMinutes} phút
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-bq-hair bg-bq-paper text-[11px] text-bq-ink2">
          <span aria-hidden>🌐</span>
          Cùng cộng đồng
        </span>
      </div>

      {/* Reward block */}
      <div
        data-testid="featured-daily-card-reward"
        className="flex items-center gap-2.5 px-3.5 py-2.5 mb-4 rounded-xl border border-bq-amber/30 bg-bq-paper"
      >
        <span aria-hidden className="text-[16px]">🏆</span>
        <span className="text-[13px] text-bq-ink">
          <span className="text-bq-ink2">Phần thưởng:</span>{' '}
          <span className="font-bold text-bq-amberd">+150 XP</span>
        </span>
      </div>

      {/* Footer: countdown + CTA */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            data-testid="featured-daily-card-countdown-label"
            className="text-[10px] font-semibold tracking-[0.12em] uppercase text-bq-ink3 whitespace-nowrap"
          >
            Còn lại trong ngày
          </div>
          <div
            data-testid="featured-daily-card-countdown"
            className="text-[18px] font-extrabold text-bq-amberd tabular-nums tracking-[0.04em] mt-0.5"
          >
            {computed}
          </div>
        </div>
        <button
          data-testid="featured-daily-card-cta"
          type="button"
          onClick={onStart}
          className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 px-5 py-3 rounded-[12px] bg-bq-action text-bq-ink shadow-bq-action font-bold text-[14px] tracking-[0.01em] whitespace-nowrap transition-transform duration-200 hover:translate-x-[3px]"
        >
          Bắt đầu
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
