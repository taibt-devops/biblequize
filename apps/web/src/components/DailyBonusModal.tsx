import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { soundManager } from '../services/soundManager'

interface DailyBonusData {
  hasBonus: boolean
  bonusType?: string
  message?: string
  value?: number
}

const BONUS_ICONS: Record<string, string> = {
  DOUBLE_XP: '⭐',
  EXTRA_ENERGY: '⚡',
  FREE_FREEZE: '🧊',
  BONUS_STREAK: '🔥',
}

// Persist per-day so navigating away from Home (or switching browser tabs,
// which refetches on focus) doesn't re-show the modal the user already
// dismissed. The backend roll is deterministic per user per day, so a date
// key is exactly as granular as the server's answer.
const DISMISS_KEY = 'dailyBonusDismissed'
const today = () => new Date().toISOString().slice(0, 10) // YYYY-MM-DD

export default function DailyBonusModal() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === today()
    } catch {
      return false
    }
  })

  const { data } = useQuery<DailyBonusData>({
    queryKey: ['daily-bonus'],
    queryFn: () => api.get('/api/quiz/daily-bonus').then(r => r.data),
    staleTime: 24 * 60 * 60_000, // 24h — check once per day
  })

  if (!data?.hasBonus || dismissed) return null

  const handleConfirm = () => {
    soundManager.play('badgeUnlock')
    try {
      window.localStorage.setItem(DISMISS_KEY, today())
    } catch {
      // Private mode / quota exceeded — modal will re-show on next mount,
      // but that's strictly better than crashing.
    }
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(29,43,34,0.45)] backdrop-blur-sm">
      <div className="bg-bq-white rounded-2xl p-8 max-w-sm w-full mx-4 border border-bq-hair shadow-bq-soft text-center space-y-5">
        <div className="text-5xl">{BONUS_ICONS[data.bonusType ?? ''] ?? '🎁'}</div>
        <div>
          <h2 className="font-display text-xl font-black text-bq-ink">{t('modals.dailyBonus.title')}</h2>
          <p className="text-bq-amberd font-bold mt-2">{data.message}</p>
        </div>
        <button
          onClick={handleConfirm}
          className="w-full px-6 py-3 bg-bq-action shadow-bq-action text-bq-ink font-black rounded-xl hover:brightness-105 transition"
        >
          {t('modals.dailyBonus.confirmButton')}
        </button>
      </div>
    </div>
  )
}
