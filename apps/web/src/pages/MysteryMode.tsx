import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

export default function MysteryMode() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [starting, setStarting] = useState(false)

  const startQuiz = async () => {
    setStarting(true)
    try {
      const res = await api.post('/api/quiz/mystery')
      const { questions } = res.data
      if (questions?.length > 0) {
        navigate('/quiz', {
          state: {
            questions,
            mode: 'mystery_mode',
            showExplanation: true,
          },
        })
      }
    } catch {
      setStarting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8" data-testid="mystery-page">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-pink-400" style={{ fontVariationSettings: "'FILL' 1" }}>casino</span>
        </div>
        <h1 className="text-3xl font-black text-on-surface">Mystery Mode</h1>
        <p className="text-on-surface-variant text-sm">{t('gameModes.mysteryPage.subtitle')}</p>
      </div>

      {/* Info card */}
      <div className="bg-surface-container rounded-2xl p-8 border border-pink-500/20 text-center space-y-6" data-testid="mystery-info-card">
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-4 text-lg">
            <span className="text-on-surface-variant">{t('gameModes.mysteryPage.bookLabel')}</span>
            <span className="font-black text-pink-400">???</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-lg">
            <span className="text-on-surface-variant">{t('gameModes.mysteryPage.difficultyLabel')}</span>
            <span className="font-black text-pink-400">???</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-lg">
            <span className="text-on-surface-variant">{t('gameModes.mysteryPage.topicLabel')}</span>
            <span className="font-black text-pink-400">???</span>
          </div>
        </div>

        {/* XP multiplier badge removed per Bui decision 2026-05-02: variety modes
            are "for fun, no XP" — advertising 1.5x XP misled users since no
            scoring path consumed the multiplier server-side. See
            apps/api/AUDIT_VARIETY_MODES_LEADERBOARD.md + VarietyQuizController
            JavaDoc for context. */}
        <div className="flex justify-center gap-6">
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-on-surface-variant">{t('gameModes.mysteryPage.timeLabel')}</p>
            <p className="text-lg font-black text-pink-400">25s</p>
          </div>
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-on-surface-variant">{t('gameModes.mysteryPage.questionsLabel')}</p>
            <p className="text-lg font-black text-pink-400">10</p>
          </div>
        </div>

        <button
          onClick={startQuiz}
          disabled={starting}
          data-testid="mystery-start-btn"
          className="px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl transition-colors disabled:opacity-50"
        >
          {starting ? '...' : t('gameModes.mysteryBtn')}
        </button>
      </div>
    </div>
  )
}
