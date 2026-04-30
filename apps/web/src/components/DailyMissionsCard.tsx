import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
 * Daily missions section per Home redesign V2 (mockup line 159-200).
 * Compact card with three rows; each row has an outline circle (filled
 * gold when completed), the mission description, and an inline 3px
 * progress bar with X/Y count on the right. Sidebar shares the same
 * TanStack query key so the data is fetched once.
 */
export default function DailyMissionsCard() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery<DailyMissionsData>({
    queryKey: ['daily-missions'],
    queryFn: () => api.get('/api/me/daily-missions').then(r => r.data),
    staleTime: 30_000,
  })

  if (isLoading || !data) return null

  const { missions, allCompleted, bonusClaimed, bonusXp } = data
  const completedCount = missions.filter(m => m.completed).length

  return (
    <div className="rounded-2xl bg-[rgba(50,52,64,0.4)] border border-secondary/15 p-4 md:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-on-surface text-[12px] md:text-[13px] font-medium">
          {t('home.dailyMissionsHeader')}
        </h3>
        <span className="text-on-surface-variant/40 text-[10px] md:text-[11px]">
          {t('home.dailyMissionsCount', { completed: completedCount, total: missions.length })}
        </span>
      </div>

      {/* Mission rows */}
      <div className="flex flex-col gap-2">
        {missions.map((m) => {
          const pct = m.completed ? 100 : Math.min(100, (m.progress / m.target) * 100)
          return (
            <div
              key={m.slot}
              data-testid="mission-item"
              className="flex items-center gap-2 md:gap-2.5"
            >
              {/* Outline circle — filled gold when completed */}
              <div
                className={`w-4 h-4 md:w-[18px] md:h-[18px] rounded-full flex-shrink-0 flex items-center justify-center ${
                  m.completed
                    ? 'bg-secondary text-[#11131e]'
                    : 'border-[1.5px] border-white/25'
                }`}
              >
                {m.completed && (
                  <span
                    className="material-symbols-outlined text-[10px] md:text-[12px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                )}
              </div>

              {/* Description + inline 3px progress bar */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[11px] md:text-[12px] truncate ${
                    m.completed ? 'text-on-surface/85 line-through opacity-70' : 'text-on-surface/85'
                  }`}
                >
                  {m.description}
                </div>
                <div className="bg-white/[0.06] rounded-[2px] h-[2px] md:h-[3px] mt-0.5 md:mt-1 overflow-hidden">
                  <div
                    data-testid={`mission-${m.slot}-progress`}
                    className="bg-secondary h-full rounded-[2px] transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Right-aligned count */}
              <span className="text-[9px] md:text-[10px] text-on-surface-variant/45 font-medium">
                {m.progress}/{m.target}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bonus row — only when all 3 are done */}
      {allCompleted && (
        <div className="mt-3 pt-3 border-t border-secondary/15 flex items-center gap-2">
          <span className="text-base">🎁</span>
          <span className="text-[11px] font-medium text-secondary">
            +{bonusXp} XP{' '}
            {bonusClaimed && <span className="text-on-surface-variant/50">{t('home.received', 'nhận được!')}</span>}
          </span>
        </div>
      )}
    </div>
  )
}
