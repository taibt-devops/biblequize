import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Medal, PlaceBackdrop, Plaque } from '../components/lk/Place'
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
            // Spec §5.4: Mystery Mode = 25s/câu. UI badge advertises 25s; without
            // this prop, Quiz.tsx silently falls back to DEFAULT_TIMER=30.
            timePerQuestion: 25,
          },
        })
      }
    } catch {
      setStarting(false)
    }
  }

  return (
    <div className="relative max-w-2xl lg:max-w-3xl mx-auto space-y-8" data-testid="mystery-page">
      {/* Header */}
      <PlaceBackdrop place="square" veil="strong" />
      <div className="text-center space-y-3">
        <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="mx-auto h-20" />
        <div><Plaque className="text-[30px] md:text-[38px]">{t('gameModes.mystery')}</Plaque></div>
        <p className="m-0 mx-auto w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[15px] text-bq-ink2">{t('gameModes.mysteryPage.subtitle')}</p>
      </div>

      {/* Info card */}
      <div className="bg-bq-white rounded-bq p-7 md:p-8 border-[3px] border-bq-ink shadow-bq-card text-center space-y-5" data-testid="mystery-info-card">
        <div className="space-y-2.5 max-w-xs mx-auto">
          <div className="flex items-center justify-between gap-4 px-4 py-2 rounded-2xl bg-bq-paper border-2 border-dashed border-bq-ink/30 text-[17px]">
            <span className="font-bold text-bq-ink2">{t('gameModes.mysteryPage.bookLabel')}</span>
            <span className="font-display text-[22px] font-extrabold text-bq-ink">???</span>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2 rounded-2xl bg-bq-paper border-2 border-dashed border-bq-ink/30 text-[17px]">
            <span className="font-bold text-bq-ink2">{t('gameModes.mysteryPage.difficultyLabel')}</span>
            <span className="font-display text-[22px] font-extrabold text-bq-ink">???</span>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2 rounded-2xl bg-bq-paper border-2 border-dashed border-bq-ink/30 text-[17px]">
            <span className="font-bold text-bq-ink2">{t('gameModes.mysteryPage.topicLabel')}</span>
            <span className="font-display text-[22px] font-extrabold text-bq-ink">???</span>
          </div>
        </div>

        {/* XP multiplier badge removed per Bui decision 2026-05-02: variety modes
            are "for fun, no XP" — advertising 1.5x XP misled users since no
            scoring path consumed the multiplier server-side. See
            apps/api/AUDIT_VARIETY_MODES_LEADERBOARD.md + VarietyQuizController
            JavaDoc for context. */}
        <div className="flex justify-center gap-6">
          <div className="flex flex-col items-center">
            <Medal size={62}><span className="font-display text-[20px] font-extrabold">25s</span></Medal>
            <p className="m-0 mt-2.5 text-[13px] font-bold text-bq-ink2">{t('gameModes.mysteryPage.timeLabel')}</p>
          </div>
          <div className="flex flex-col items-center">
            <Medal size={62}><span className="font-display text-[20px] font-extrabold">10</span></Medal>
            <p className="m-0 mt-2.5 text-[13px] font-bold text-bq-ink2">{t('gameModes.mysteryPage.questionsLabel')}</p>
          </div>
        </div>

        <button
          onClick={startQuiz}
          disabled={starting}
          data-testid="mystery-start-btn"
          className="lk-btn text-bq-ink text-[17px]"
        >
          {starting ? '...' : t('gameModes.mysteryBtn')}
        </button>
      </div>
    </div>
  )
}
