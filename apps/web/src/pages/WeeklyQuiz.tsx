import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Medal, PlaceBackdrop, Plaque } from '../components/lk/Place'
import { useBookName } from '../hooks/useBookName'
import { api } from '../api/client'

export default function WeeklyQuiz() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const getBookName = useBookName()
  const [starting, setStarting] = useState(false)

  const { data: theme, isLoading } = useQuery({
    queryKey: ['weekly-theme'],
    queryFn: () => api.get('/api/quiz/weekly/theme').then(r => r.data),
  })

  const startQuiz = async () => {
    setStarting(true)
    try {
      const res = await api.get('/api/quiz/weekly')
      const { questions } = res.data
      if (questions?.length > 0) {
        navigate('/quiz', {
          state: {
            questions,
            mode: 'weekly_quiz',
            showExplanation: true,
          },
        })
      }
    } catch {
      setStarting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="weekly-loading">
        <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-14 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative max-w-2xl lg:max-w-3xl mx-auto space-y-8" data-testid="weekly-page">
      {/* Header */}
      <PlaceBackdrop place="study" veil="strong" />
      <div className="text-center space-y-3">
        <img src="/images/lk/scroll.webp" alt="" aria-hidden className="mx-auto h-20" />
        <div><Plaque className="text-[30px] md:text-[38px]">{t('gameModes.weekly')}</Plaque></div>
        <p className="m-0 mx-auto w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[15px] text-bq-ink2">{t('gameModes.weeklyPage.subtitle')}</p>
      </div>

      {/* Theme card */}
      {theme && (
        <div className="bg-bq-white rounded-bq p-7 md:p-8 border-[3px] border-bq-ink shadow-bq-card text-center space-y-5" data-testid="weekly-quiz-theme-card">
          <span className="inline-block px-3 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[13px] font-extrabold">{t('gameModes.weeklyPage.themeLabel')}</span>
          <h2 className="m-0 font-display text-[30px] font-extrabold text-bq-ink" data-testid="weekly-theme-title">{theme.themeName}</h2>
          <p className="m-0 font-read text-[15px] text-bq-ink2" data-testid="weekly-theme-description">{theme.themeNameEn}</p>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {theme.books?.slice(0, 5).map((book: string) => (
              <span key={book} className="text-[13px] bg-bq-paper border-2 border-bq-ink/30 text-bq-ink px-2.5 py-0.5 rounded-full font-bold">
                {getBookName(book)}
              </span>
            ))}
            {theme.books?.length > 5 && (
              <span className="text-[13px] font-bold text-bq-ink2">+{theme.books.length - 5}</span>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-2 text-[14px] font-bold">
            <span className="px-3 py-0.5 rounded-full bg-bq-cream border-2 border-bq-ink">{t('gameModes.weeklyPage.questionCount')}</span>
            <span data-testid="weekly-quiz-countdown" className="px-3 py-0.5 rounded-full bg-bq-cream border-2 border-bq-ink">{t('gameModes.weeklyPage.daysLeft', { count: theme.daysLeft })}</span>
          </div>

          <span data-testid="weekly-quiz-start-btn" className="inline-block">
          <button
            onClick={startQuiz}
            disabled={starting}
            data-testid="weekly-start-btn"
            className="lk-btn text-bq-ink text-[17px]"
          >
            {starting ? '...' : t('gameModes.weeklyBtn')}
          </button>
          </span>
        </div>
      )}
    </div>
  )
}
