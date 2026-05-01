import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/authStore'
import { useRankedDataSync } from './useRankedDataSync'

export interface TierProgressData {
  tierLevel: number
  tierName: string
  totalPoints: number
  nextTierPoints: number
  tierProgressPercent: number
  starIndex: number
  starXp: number
  nextStarXp: number
  starProgressPercent: number
  milestone: string | null
  surgeActive?: boolean
  surgeUntil?: string | null
  surgeMultiplier?: number
}

export interface RankedStatus {
  date: string
  livesRemaining: number
  questionsCounted: number
  pointsToday: number
  cap: number
  dailyLives: number
  currentBook: string
  currentBookIndex: number
  isPostCycle: boolean
  currentDifficulty: string
  nextBook?: string
  resetAt: string
  bookProgress?: {
    currentIndex: number
    totalBooks: number
    currentBook: string
    nextBook: string
    isCompleted: boolean
    progressPercentage: number
  }
  askedQuestionIdsToday?: string[]
  askedQuestionCountToday?: number
  // Path A backend extensions. Each is null when the relevant signal
  // is unavailable (no answers today, no yesterday baseline,
  // leaderboard < N users, no active season). The component branches
  // off `null` rather than coalescing to 0 so missing-data and
  // zero-value stay visually distinguishable.
  dailyAccuracy: number | null
  dailyCorrectCount: number | null
  dailyTotalAnswered: number | null
  dailyDelta: number | null
  pointsToTop50: number | null
  pointsToTop10: number | null
  pointsToTop100?: number | null
}

/**
 * Page-level data hook for /ranked. Owns the 3 backend fetches the
 * page needs (status, daily rank, tier progress), the resetAt
 * countdown ticker, and the visibility/custom-event refresh
 * listeners. Extracted from Ranked.tsx so the page orchestrator
 * focuses on JSX assembly.
 */
export function useRankedPage() {
  const { user } = useAuth()
  const { isInitialized } = useRankedDataSync()
  const [rankedStatus, setRankedStatus] = useState<RankedStatus | null>(null)
  const [userRank, setUserRank] = useState<any>(null)
  const [tierData, setTierData] = useState<TierProgressData | null>(null)
  const [timeLeft, setTimeLeft] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const fetchStatus = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/api/me/ranked-status')
      const data = res.data
      if (data?.askedQuestionIdsToday?.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        localStorage.setItem('askedQuestionIds', JSON.stringify(data.askedQuestionIdsToday))
        localStorage.setItem('lastAskedDate', today)
      }
      setRankedStatus(data ?? null)
    } catch {
      setRankedStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMyRank = async () => {
    if (!user) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await api.get('/api/leaderboard/daily/my-rank', { params: { date: today } })
      setUserRank(res.data)
    } catch { /* rank info not available */ }
  }

  const fetchTierProgress = async () => {
    if (!user) return
    try {
      const res = await api.get('/api/me/tier-progress')
      setTierData(res.data)
    } catch { /* fallback to FE-computed tier info from totalPoints */ }
  }

  useEffect(() => {
    if (isInitialized) { fetchStatus(); fetchMyRank(); fetchTierProgress() }
  }, [isInitialized])

  useEffect(() => {
    if (!rankedStatus?.resetAt) return
    const tick = () => {
      const diff = new Date(rankedStatus.resetAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('00:00:00'); return false }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      return true
    }
    tick()
    const timer = setInterval(() => { if (!tick()) clearInterval(timer) }, 1000)
    return () => clearInterval(timer)
  }, [rankedStatus?.resetAt])

  useEffect(() => {
    const handler = () => { if (!document.hidden && isInitialized) fetchStatus() }
    const customHandler = (e: CustomEvent) => {
      try { setRankedStatus(prev => ({ ...prev!, ...e.detail })) } catch { /* ignore */ }
    }
    document.addEventListener('visibilitychange', handler)
    window.addEventListener('rankedStatusUpdate', customHandler as EventListener)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      window.removeEventListener('rankedStatusUpdate', customHandler as EventListener)
    }
  }, [isInitialized])

  return {
    rankedStatus,
    userRank,
    tierData,
    timeLeft,
    isLoading,
    isInitialized,
    refetch: fetchStatus,
  }
}
