import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

type FilterType = 'all' | 'wrong' | 'correct'

export default function Review() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const { t } = useTranslation()
  const stats = location.state?.stats

  const [filter, setFilter] = useState<FilterType>('all')
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [retrying, setRetrying] = useState(false)

  const questions = stats?.questions ?? []
  const userAnswers = stats?.userAnswers ?? []
  const totalCorrect = stats?.correctAnswers ?? 0
  const totalQuestions = stats?.totalQuestions ?? questions.length
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
  const totalTimeSec = Math.floor((stats?.totalTime ?? 0) / 1000)
  const totalMin = Math.floor(totalTimeSec / 60)
  const totalSec = totalTimeSec % 60

  const questionsWithStatus = useMemo(() =>
    questions.map((q: any, idx: number) => ({
      ...q,
      index: idx,
      userAnswer: userAnswers[idx],
      isCorrect: userAnswers[idx] !== null && userAnswers[idx] === q.correctAnswer?.[0],
    })),
    [questions, userAnswers]
  )

  const filtered = useMemo(() => {
    if (filter === 'wrong') return questionsWithStatus.filter((q: any) => !q.isCorrect)
    if (filter === 'correct') return questionsWithStatus.filter((q: any) => q.isCorrect)
    return questionsWithStatus
  }, [questionsWithStatus, filter])

  const wrongCount = questionsWithStatus.filter((q: any) => !q.isCorrect).length
  const correctCount = questionsWithStatus.filter((q: any) => q.isCorrect).length

  const toggleBookmark = async (questionId: string) => {
    const next = new Set(bookmarks)
    if (next.has(questionId)) {
      next.delete(questionId)
      try { await api.delete(`/api/me/bookmarks/${questionId}`) } catch { /* ignore */ }
    } else {
      next.add(questionId)
      try { await api.post('/api/me/bookmarks', { questionId }) } catch { /* ignore */ }
    }
    setBookmarks(next)
  }

  const handleRetry = async () => {
    if (!stats?.sessionId) return
    setRetrying(true)
    try {
      const res = await api.post(`/api/sessions/${stats.sessionId}/retry`)
      navigate('/quiz', { state: { sessionId: res.data.sessionId, mode: 'practice' } })
    } catch {
      setRetrying(false)
    }
  }

  // ── Empty state ──
  if (!stats || questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 px-4 bg-bq-paper" data-testid="review-empty-state">
        <div className="bg-bq-white p-8 rounded-2xl text-center max-w-md border border-bq-hair shadow-bq-soft">
          <span className="material-symbols-outlined text-bq-ink2 text-5xl mb-4 block">quiz</span>
          <h2 className="text-xl font-bold font-display text-bq-ink mb-2">{t('review.noData')}</h2>
          <p className="text-bq-ink2 text-sm mb-6">{t('review.completeFirst')}</p>
          <button onClick={() => navigate('/practice')} className="bg-bq-action text-bq-ink font-bold px-6 py-3 rounded-xl shadow-bq-action">
            {t('review.backToPractice')}
          </button>
        </div>
      </div>
    )
  }

  const diffBadge = (d: string) => {
    const map: Record<string, string> = {
      easy: 'bg-bq-emerald/10 text-bq-emerald border-bq-emerald/20',
      medium: 'bg-bq-amber/10 text-bq-amberd border-bq-amber/20',
      hard: 'bg-bq-ruby/10 text-bq-ruby border-bq-ruby/20',
    }
    const label: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${map[d] ?? ''}`}>{label[d] ?? d}</span>
  }

  return (
    <div data-testid="review-page" className="flex flex-col bg-bq-paper">
      {/* Sticky Header — z-40 so it stays below AppLayout's fixed global header (z-50) */}
      <header className="sticky top-0 z-40 bg-bq-white/95 backdrop-blur border-b border-bq-hair -mx-4 md:-mx-8 -mt-6 md:-mt-10 mb-6">
          <div className="flex items-center justify-between px-6 h-16 md:h-20">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-bq-inset transition-colors">
                <span className="material-symbols-outlined text-bq-ink">arrow_back</span>
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-bold font-display tracking-tight text-bq-ink">{t('review.title')}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  <span data-testid="review-total-correct" className="text-xs font-bold text-bq-amberd uppercase tracking-wider">{totalCorrect}/{totalQuestions} {t('review.correctLabel')} ({accuracy}%)</span>
                  <span className="text-[10px] text-bq-ink3">•</span>
                  <span className="text-xs text-bq-ink2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {totalMin}m {totalSec.toString().padStart(2, '0')}s
                  </span>
                </div>
              </div>
            </div>
            {wrongCount > 0 && (
              <button data-testid="review-retry-btn" onClick={handleRetry} disabled={retrying}
                className="bg-bq-action px-4 py-2 md:px-6 rounded-xl text-bq-ink font-bold text-sm flex items-center gap-2 shadow-bq-action active:scale-95 transition-transform disabled:opacity-50">
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span className="hidden sm:inline">{t('review.retryWrong')}</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-6 flex gap-8 border-t border-bq-hair">
            {([
              ['all', t('review.all', { count: totalQuestions })] as [FilterType, string],
              ['wrong', t('review.wrong', { count: wrongCount })] as [FilterType, string],
              ['correct', t('review.correct', { count: correctCount })] as [FilterType, string],
            ]).map(([key, label]) => (
              <button key={key} data-testid={`review-filter-${key}`} data-active={filter === key ? 'true' : 'false'} onClick={() => setFilter(key)}
                className={`py-4 text-sm font-bold transition-colors ${filter === key ? 'text-bq-ink border-b-2 border-bq-amberd' : 'text-bq-ink3 hover:text-bq-ink'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Question Cards */}
        <div data-testid="review-question-list" className="p-6 space-y-6 max-w-4xl mx-auto w-full pb-32">
          {filtered.map((q: any) => {
            const correctIdx = q.correctAnswer?.[0]
            return (
              <article data-testid="review-question-item" key={q.id} className="bg-bq-white rounded-2xl overflow-hidden border border-bq-hair shadow-bq-soft">
                <div className="p-5 md:p-7 space-y-6">
                  {/* Question header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-bq-ink3">{t('review.questionNumber', { number: String(q.index + 1).padStart(2, '0') })}</span>
                      {diffBadge(q.difficulty)}
                      <span className="text-xs font-medium text-bq-amberd bg-bq-amber/10 px-2 py-0.5 rounded-lg">
                        {q.book} {q.chapter ? `${t('review.chapter', { chapter: q.chapter })}` : ''}
                      </span>
                    </div>
                    <button onClick={() => toggleBookmark(q.id)} className={`transition-colors ${bookmarks.has(q.id) ? 'text-bq-amberd' : 'text-bq-ink3 hover:text-bq-amberd'}`}>
                      <span className="material-symbols-outlined" style={bookmarks.has(q.id) ? FILL_1 : undefined}>star</span>
                    </button>
                  </div>

                  {/* Question text */}
                  <h3 className="text-lg md:text-xl font-medium leading-relaxed text-bq-ink">{q.content}</h3>

                  {/* Answer options */}
                  <div className="space-y-3">
                    {q.options?.map((opt: string, i: number) => {
                      const isUserAnswer = i === q.userAnswer
                      const isCorrectAnswer = i === correctIdx
                      let borderClass = 'bg-bq-inset text-bq-ink2'
                      let icon = 'radio_button_unchecked'
                      let iconColor = 'text-bq-ink3'
                      let badge = null

                      if (isCorrectAnswer && isUserAnswer) {
                        borderClass = 'bg-bq-emerald/10 border-l-4 border-bq-emerald'
                        icon = 'check_circle'
                        iconColor = 'text-bq-emerald'
                        badge = <span className="text-[10px] font-bold text-bq-emerald uppercase tracking-widest px-2 py-1 bg-bq-emerald/10 rounded">{t('review.yourAnswer')}</span>
                      } else if (isUserAnswer && !q.isCorrect) {
                        borderClass = 'bg-bq-ruby/10 border-l-4 border-bq-ruby'
                        icon = 'cancel'
                        iconColor = 'text-bq-ruby'
                        badge = <span className="text-[10px] font-bold text-bq-ruby uppercase tracking-widest px-2 py-1 bg-bq-ruby/10 rounded">{t('review.yourAnswer')}</span>
                      } else if (isCorrectAnswer) {
                        borderClass = 'bg-bq-emerald/10 border-l-4 border-bq-emerald'
                        icon = 'check_circle'
                        iconColor = 'text-bq-emerald'
                        badge = <span className="text-[10px] font-bold text-bq-emerald uppercase tracking-widest px-2 py-1 bg-bq-emerald/10 rounded">{t('review.correctAnswer')}</span>
                      }

                      return (
                        <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${borderClass}`}>
                          <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined text-sm ${iconColor}`}>{icon}</span>
                            <span className={isCorrectAnswer || isUserAnswer ? 'text-bq-ink font-medium' : ''}>{opt}</span>
                          </div>
                          {badge}
                        </div>
                      )
                    })}
                  </div>

                  {/* Explanation + Scripture Reference */}
                  {(q.explanation || q.verseStart) && (
                    <div className="mt-4 p-5 bg-bq-inset rounded-xl border border-bq-hair space-y-3">
                      {/* Scripture reference */}
                      {q.verseStart && (
                        <div className="flex items-center gap-2 text-bq-amberd font-medium text-sm">
                          <span className="material-symbols-outlined text-base">menu_book</span>
                          <span>
                            {q.book} {q.chapter}:{q.verseStart}
                            {q.verseEnd && q.verseEnd !== q.verseStart ? `–${q.verseEnd}` : ''}
                          </span>
                        </div>
                      )}

                      {/* Explanation text */}
                      {q.explanation && (
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-bq-amberd/70 text-base mt-0.5">lightbulb</span>
                          <p className="text-bq-ink2 leading-relaxed text-sm">{q.explanation}</p>
                        </div>
                      )}

                      {q.contextNote && (
                        <div className="flex items-center gap-2 pt-1 text-xs text-bq-ink3 italic">
                          <span className="material-symbols-outlined text-sm">map</span>
                          {q.contextNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )
          })}

          {filtered.length === 0 && (
            <p className="text-center text-bq-ink2 py-16">{t('review.noQuestionsInFilter')}</p>
          )}
      </div>
    </div>
  )
}
