import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

export default function WeeklyQuiz() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-bq-sapphire/30 border-t-bq-sapphire rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto space-y-8" data-testid="weekly-page">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-bq-sapphire/10 border border-bq-sapphire/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-bq-sapphire" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
        </div>
        <h1 className="text-3xl font-black font-display text-bq-ink">{t('gameModes.weekly')}</h1>
        <p className="text-bq-ink2 text-sm">{t('gameModes.weeklyPage.subtitle')}</p>
      </div>

      {/* Theme card */}
      {theme && (
        <div className="bg-bq-white rounded-2xl p-8 border border-bq-hair shadow-bq-soft text-center space-y-4" data-testid="weekly-quiz-theme-card">
          <p className="text-xs font-bold text-bq-sapphire uppercase tracking-wider">{t('gameModes.weeklyPage.themeLabel')}</p>
          <h2 className="text-2xl font-black text-bq-ink" data-testid="weekly-theme-title">{theme.themeName}</h2>
          <p className="text-sm text-bq-ink2" data-testid="weekly-theme-description">{theme.themeNameEn}</p>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {theme.books?.slice(0, 5).map((book: string) => (
              <span key={book} className="text-xs bg-bq-sapphire/10 text-bq-sapphire px-2 py-1 rounded-full font-medium">
                {book}
              </span>
            ))}
            {theme.books?.length > 5 && (
              <span className="text-xs text-bq-ink2">+{theme.books.length - 5}</span>
            )}
          </div>

          <div className="flex justify-center gap-6 pt-4 text-sm text-bq-ink2">
            <span>{t('gameModes.weeklyPage.questionCount')}</span>
            <span>•</span>
            <span data-testid="weekly-quiz-countdown">{t('gameModes.weeklyPage.daysLeft', { count: theme.daysLeft })}</span>
          </div>

          <span data-testid="weekly-quiz-start-btn" className="inline-block">
          <button
            onClick={startQuiz}
            disabled={starting}
            data-testid="weekly-start-btn"
            className="mt-4 px-8 py-3 bg-bq-action text-bq-ink font-black rounded-xl shadow-bq-action transition-colors disabled:opacity-50"
          >
            {starting ? '...' : t('gameModes.weeklyBtn')}
          </button>
          </span>
        </div>
      )}
    </div>
  )
}
