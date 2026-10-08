import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

interface Mission {
  slot: number
  type: string
  description: string
  progress: number
  target: number
  completed: boolean
}

interface DailyMissionsData {
  date: string
  missions: Mission[]
  allCompleted: boolean
  bonusClaimed: boolean
  bonusXp: number
}

/**
 * Sidebar widget showing today's mission completion progress.
 *
 * - Reuses query key ['daily-missions'] so it shares cache with the Home
 *   DailyMissionsCard — one network request serves both surfaces.
 * - Returns null on error or empty data so the sidebar never renders a
 *   broken/error UI in a corner the user has no context for.
 * - Click navigates to / (Home) where the full DailyMissionsCard shows
 *   per-mission detail. There is no dedicated /profile?tab=missions
 *   route — Home is the canonical surface today.
 */
export default function DailyMissionWidget() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery<DailyMissionsData>({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/api/me/daily-missions').then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div
        data-testid="daily-mission-widget-skeleton"
        className="rounded-[10px] px-3.5 py-3 animate-pulse bg-bq-white border border-bq-hair shadow-bq-soft"
      >
        <div className="h-2 w-20 mb-2 rounded bg-bq-inset" />
        <div className="h-3 w-full rounded bg-bq-inset" />
      </div>
    )
  }

  // Error / empty / no missions → render nothing rather than show broken UI
  if (isError || !data || !data.missions || data.missions.length === 0) {
    return null
  }

  const totalCompleted = data.missions.filter((m) => m.completed).length
  const totalTarget = data.missions.length
  if (totalTarget === 0) return null

  const pct = Math.round((totalCompleted / totalTarget) * 100)
  const allDone = totalCompleted === totalTarget

  let caption: string
  let captionClass: string
  if (allDone) {
    caption = 'Tất cả nhiệm vụ hoàn thành! 🎉'
    captionClass = 'text-bq-amberd' // gold
  } else if (totalCompleted > 0) {
    caption = `Tiếp tục — còn ${totalTarget - totalCompleted} nhiệm vụ`
    captionClass = 'text-bq-ink2'
  } else {
    caption = 'Bắt đầu nhiệm vụ ngày'
    captionClass = 'text-bq-ink3'
  }

  return (
    <button
      type="button"
      data-testid="daily-mission-widget"
      onClick={() => navigate('/')}
      aria-label="Xem chi tiết nhiệm vụ ngày"
      className="rounded-[10px] px-3.5 py-3 w-full text-left bg-bq-white border border-bq-hair shadow-bq-soft hover:bg-bq-paper transition-colors cursor-pointer"
    >
      <div
        className="text-[12px] font-bold mb-1.5 text-bq-ink3"
        style={{ letterSpacing: '0.12em' }}
      >
        🎯 Nhiệm vụ ngày
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span
          data-testid="daily-mission-widget-progress"
          className="text-[15px] font-bold text-bq-ink"
        >
          {totalCompleted}/{totalTarget}
        </span>
        <span className="text-[10px] text-bq-ink3">
          hoàn thành
        </span>
      </div>
      <div className="h-1 w-full rounded-full overflow-hidden mb-1.5 bg-bq-inset">
        <div
          data-testid="daily-mission-widget-bar"
          className="h-full transition-all duration-700 ease-out bg-bq-emerald"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        data-testid="daily-mission-widget-caption"
        className={`text-[10px] leading-snug ${captionClass}`}
      >
        {caption}
      </p>
    </button>
  )
}
