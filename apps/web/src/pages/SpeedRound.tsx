import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Medal, PlaceBackdrop, Plaque } from '../components/lk/Place'
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
    <div className="relative max-w-2xl lg:max-w-3xl mx-auto space-y-8" data-testid="speed-round-page">
      {/* Header */}
      <PlaceBackdrop place="arena" veil="strong" />
      <div className="text-center space-y-3">
        <img src="/images/lk/sword.webp" alt="" aria-hidden className="mx-auto h-20" />
        <div><Plaque className="text-[30px] md:text-[38px]">{t('gameModes.speed')}</Plaque></div>
        <p className="m-0 mx-auto w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[15px] text-bq-ink2">{t('gameModes.speedPage.subtitle')}</p>
      </div>

      {/* Info card */}
      <div className="bg-bq-white rounded-bq p-7 md:p-8 border-[3px] border-bq-ink shadow-bq-card text-center space-y-5" data-testid="speed-round-stats-card">
        <div className="flex justify-center gap-6">
          <div className="flex flex-col items-center">
            <Medal size={70}><span className="font-display text-[24px] font-extrabold">10</span></Medal>
            <p className="m-0 mt-2.5 text-[13px] font-bold text-bq-ink2">{t('gameModes.speedPage.questionsSuffix')}</p>
          </div>
          <div className="flex flex-col items-center" data-testid="speed-round-timer-stat">
            <Medal size={70}><span className="font-display text-[24px] font-extrabold">10s</span></Medal>
            <p className="m-0 mt-2.5 text-[13px] font-bold text-bq-ink2">{t('gameModes.speedPage.perQuestionSuffix')}</p>
          </div>
          {/* "2x XP bonus" stat removed per Bui decision 2026-05-02: variety
              modes are "for fun, no XP" — see MysteryMode.tsx + audit. */}
        </div>

        <div className="space-y-1.5 font-read text-[15px] text-bq-ink2">
          <p>{t('gameModes.speedPage.onlyEasyNote')} <span className="text-bq-emerald font-bold">{t('gameModes.speedPage.easyWord')}</span> {t('gameModes.speedPage.easyReason')}</p>
          <p>{t('gameModes.speedPage.autoAdvanceNote')}</p>
        </div>

        <button
          onClick={startQuiz}
          disabled={starting}
          data-testid="speed-round-start-btn"
          className="lk-btn text-bq-ink text-[17px]"
        >
          {starting ? '...' : t('gameModes.speedBtn')}
        </button>
      </div>
    </div>
  )
}
