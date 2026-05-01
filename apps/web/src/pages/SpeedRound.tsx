import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

export default function SpeedRound() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [starting, setStarting] = useState(false)

  const startQuiz = async () => {
    setStarting(true)
    try {
      const res = await api.get('/api/quiz/speed-round')
      const { questions } = res.data
      if (questions?.length > 0) {
        navigate('/quiz', {
          state: {
            questions,
            mode: 'speed_round',
            showExplanation: false, // Too fast for explanations
            timePerQuestion: 10,
          },
        })
      }
    } catch {
      setStarting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8" data-testid="speed-round-page">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-orange-400" style={{ fontVariationSettings: "'FILL' 1" }}>speed</span>
        </div>
        <h1 className="text-3xl font-black text-on-surface">Speed Round</h1>
        <p className="text-on-surface-variant text-sm">{t('gameModes.speedPage.subtitle')}</p>
      </div>

      {/* Info card */}
      <div className="bg-surface-container rounded-2xl p-8 border border-orange-500/20 text-center space-y-6" data-testid="speed-round-stats-card">
        <div className="flex justify-center gap-6">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-5 py-3 text-center">
            <p className="text-3xl font-black text-orange-400">10</p>
            <p className="text-xs text-on-surface-variant mt-1">{t('gameModes.speedPage.questionsSuffix')}</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-5 py-3 text-center" data-testid="speed-round-timer-stat">
            <p className="text-3xl font-black text-orange-400">10s</p>
            <p className="text-xs text-on-surface-variant mt-1">{t('gameModes.speedPage.perQuestionSuffix')}</p>
          </div>
          {/* "2x XP bonus" stat removed per Bui decision 2026-05-02: variety
              modes are "for fun, no XP" — see MysteryMode.tsx + audit. */}
        </div>

        <div className="space-y-2 text-sm text-on-surface-variant">
          <p>{t('gameModes.speedPage.onlyEasyNote')} <span className="text-emerald-400 font-bold">{t('gameModes.speedPage.easyWord')}</span> {t('gameModes.speedPage.easyReason')}</p>
          <p>{t('gameModes.speedPage.autoAdvanceNote')}</p>
        </div>

        <button
          onClick={startQuiz}
          disabled={starting}
          data-testid="speed-round-start-btn"
          className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl transition-colors disabled:opacity-50"
        >
          {starting ? '...' : t('gameModes.speedBtn')}
        </button>
      </div>
    </div>
  )
}
