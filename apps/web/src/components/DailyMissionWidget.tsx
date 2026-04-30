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
        className="rounded-[10px] px-3.5 py-3 animate-pulse"
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="h-2 w-20 mb-2 rounded"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        />
        <div
          className="h-3 w-full rounded"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
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
  let captionColor: string
  if (allDone) {
    caption = 'Tất cả nhiệm vụ hoàn thành! 🎉'
    captionColor = '#e8a832' // gold
  } else if (totalCompleted > 0) {
    caption = `Tiếp tục — còn ${totalTarget - totalCompleted} nhiệm vụ`
    captionColor = 'rgba(225,225,241,0.7)'
  } else {
    caption = 'Bắt đầu nhiệm vụ ngày'
    captionColor = 'rgba(225,225,241,0.5)'
  }

  return (
    <button
      type="button"
      data-testid="daily-mission-widget"
      onClick={() => navigate('/')}
      aria-label="Xem chi tiết nhiệm vụ ngày"
      className="rounded-[10px] px-3.5 py-3 w-full text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="text-[10px] uppercase font-bold mb-1.5"
        style={{ letterSpacing: '0.12em', color: 'rgba(225,225,241,0.5)' }}
      >
        🎯 Nhiệm vụ ngày
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span
          data-testid="daily-mission-widget-progress"
          className="text-[15px] font-bold text-white"
        >
          {totalCompleted}/{totalTarget}
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(225,225,241,0.5)' }}>
          hoàn thành
        </span>
      </div>
      <div
        className="h-1 w-full rounded-full overflow-hidden mb-1.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <div
          data-testid="daily-mission-widget-bar"
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: '#4ade80' }}
        />
      </div>
      <p
        data-testid="daily-mission-widget-caption"
        className="text-[10px] leading-snug"
        style={{ color: captionColor }}
      >
        {caption}
      </p>
    </button>
  )
}
