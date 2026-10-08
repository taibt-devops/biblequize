import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { PlaceBackdrop, Plaque } from '../components/lk/Place'

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
      <div className="relative flex items-center justify-center py-16 px-4" data-testid="review-empty-state">
        <PlaceBackdrop place="study" veil="strong" focus="30% 40%" />
        <div className="max-w-md w-full p-7 text-center bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
          <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-36 mb-3" />
          <h2 className="m-0 mb-2 font-display text-[24px] font-extrabold text-bq-ink">{t('review.noData')}</h2>
          <p className="m-0 mb-6 font-read text-[15px] text-bq-ink2">{t('review.completeFirst')}</p>
          <button onClick={() => navigate('/practice')} className="lk-btn text-bq-ink text-[17px]">
            {t('review.backToPractice')}
          </button>
        </div>
      </div>
    )
  }

  const diffKey: Record<string, string> = { easy: 'practice.easy', medium: 'practice.medium', hard: 'practice.hard' }
  const diffTone: Record<string, string> = { easy: 'bg-bq-leaf', medium: 'bg-bq-amber', hard: 'bg-bq-ruby text-bq-white' }
  const diffBadge = (d: string) => (
    <span className={`px-2.5 py-0.5 rounded-full border-2 border-bq-ink text-[13px] font-extrabold ${diffTone[d] ?? 'bg-bq-paper'}`}>
      {diffKey[d] ? t(diffKey[d]) : d}
    </span>
  )

  return (
    <div data-testid="review-page" className="relative max-w-4xl mx-auto w-full pb-24">
      <PlaceBackdrop place="study" veil="strong" focus="30% 40%" />

      {/* title, score, retry */}
      <header className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="space-y-3">
          <button onClick={() => navigate(-1)} className="block px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-full text-[14px] font-bold hover:bg-bq-cream">
            ← {t('common.back')}
          </button>
          <Plaque className="text-[26px] md:text-[32px]">{t('review.title')}</Plaque>
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-extrabold">
            <span data-testid="review-total-correct" className="px-3 py-1 bg-bq-cream border-2 border-bq-ink rounded-full">
              {totalCorrect}/{totalQuestions} {t('review.correctLabel')} ({accuracy}%)
            </span>
            <span className="px-3 py-1 bg-bq-white border-2 border-bq-ink rounded-full tabular-nums">
              ⏱ {totalMin}m {totalSec.toString().padStart(2, '0')}s
            </span>
          </div>
        </div>
        {wrongCount > 0 && (
          <button data-testid="review-retry-btn" onClick={handleRetry} disabled={retrying}
            className="lk-btn text-bq-ink text-[16px] disabled:opacity-60">
            ↻ {t('review.retryWrong')}
          </button>
        )}
      </header>

      {/* filter tabs: stay under the app bar while scrolling */}
      <div role="tablist" className="sticky top-[61px] md:top-[69px] z-20 flex gap-1.5 md:gap-2 p-1.5 md:p-2 mb-6 bg-bq-paper/95 backdrop-blur border-[3px] border-bq-ink rounded-full shadow-[0_4px_0_#1D2B22]">
        {([
          ['all', t('review.all', { count: totalQuestions })] as [FilterType, string],
          ['wrong', t('review.wrong', { count: wrongCount })] as [FilterType, string],
          ['correct', t('review.correct', { count: correctCount })] as [FilterType, string],
        ]).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={filter === key} data-testid={`review-filter-${key}`} data-active={filter === key ? 'true' : 'false'} onClick={() => setFilter(key)}
            className={`flex-1 min-w-0 whitespace-nowrap px-2 md:px-3 py-1.5 rounded-full border-2 text-[13.5px] md:text-[15px] font-extrabold transition-colors ${filter === key ? 'bg-bq-amber border-bq-ink text-bq-ink' : 'border-transparent text-bq-ink2 hover:bg-bq-cream'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* question sheets */}
      <div data-testid="review-question-list" className="space-y-6">
        {filtered.map((q: any) => {
          const correctIdx = q.correctAnswer?.[0]
          const marked = bookmarks.has(q.id)
          return (
            <article data-testid="review-question-item" key={q.id} className="relative bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card overflow-hidden">
              <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-2.5 border-r-[3px] border-bq-ink ${q.isCorrect ? 'bg-bq-leaf' : 'bg-bq-ruby'}`} />
              <div className="pl-7 pr-5 py-5 md:pl-9 md:pr-7 md:py-6 space-y-5">
                {/* number, difficulty, reference, bookmark */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg border-2 border-bq-ink bg-[#c68a4e] text-[#3a230e] text-[14px] font-extrabold">
                      {t('review.questionNumber', { number: String(q.index + 1).padStart(2, '0') })}
                    </span>
                    {diffBadge(q.difficulty)}
                    <span className="px-2.5 py-0.5 rounded-full border-2 border-bq-ink/30 bg-bq-paper text-[13px] font-bold text-bq-ink2">
                      {q.book} {q.chapter ? `${t('review.chapter', { chapter: q.chapter })}` : ''}
                    </span>
                  </div>
                  <button type="button" onClick={() => toggleBookmark(q.id)} aria-pressed={marked} aria-label={t('review.bookmark')} title={t('review.bookmark')}
                    className={`shrink-0 w-10 h-10 grid place-items-center rounded-full border-2 text-[22px] leading-none transition-colors ${marked ? 'bg-bq-amber border-bq-ink text-bq-ink' : 'border-bq-ink/30 text-bq-ink3 hover:border-bq-ink hover:text-bq-amberd'}`}>
                    {marked ? '★' : '☆'}
                  </button>
                </div>

                <h3 className="m-0 font-read text-[18px] md:text-[20px] leading-relaxed text-bq-ink">{q.content}</h3>

                {/* answers: leaf = the right one, ruby = the traveller's wrong pick */}
                <div className="space-y-2.5">
                  {q.options?.map((opt: string, i: number) => {
                    const isUserAnswer = i === q.userAnswer
                    const isCorrectAnswer = i === correctIdx
                    let row = 'border-bq-ink/20 bg-bq-paper text-bq-ink2'
                    let mark = 'bg-bq-white border-bq-ink/40 text-bq-ink2'
                    let glyph: string = String.fromCharCode(65 + i)
                    let badge = null

                    if (isCorrectAnswer) {
                      row = 'border-bq-ink bg-bq-leaf/60 text-bq-ink'
                      mark = 'bg-bq-leaf border-bq-ink text-bq-ink'
                      glyph = '✓'
                      badge = <span className="shrink-0 ml-11 sm:ml-0 px-2.5 py-0.5 rounded-full border-2 border-bq-ink bg-bq-white text-[12.5px] font-extrabold">{isUserAnswer ? t('review.yourAnswer') : t('review.correctAnswer')}</span>
                    } else if (isUserAnswer && !q.isCorrect) {
                      row = 'border-bq-ruby bg-bq-ruby/10 text-bq-ink'
                      mark = 'bg-bq-ruby border-bq-ink text-bq-white'
                      glyph = '✗'
                      badge = <span className="shrink-0 ml-11 sm:ml-0 px-2.5 py-0.5 rounded-full border-2 border-bq-ruby bg-bq-white text-bq-ruby text-[12.5px] font-extrabold">{t('review.yourAnswer')}</span>
                    }

                    return (
                      <div key={i} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5 rounded-2xl border-[3px] ${row}`}>
                        <div className="flex flex-1 min-w-[12rem] items-center gap-3">
                          <span aria-hidden className={`shrink-0 w-8 h-8 grid place-items-center rounded-full border-2 text-[14px] font-extrabold ${mark}`}>{glyph}</span>
                          <span className={`text-[16px] ${isCorrectAnswer || isUserAnswer ? 'font-bold' : ''}`}>{opt}</span>
                        </div>
                        {badge}
                      </div>
                    )
                  })}
                </div>

                {/* explanation note pinned under the sheet */}
                {(q.explanation || q.verseStart) && (
                  <div className="p-4 md:p-5 bg-bq-cream border-2 border-dashed border-bq-ink/40 rounded-2xl space-y-2.5">
                    {q.verseStart && (
                      <div className="flex items-center gap-2 font-extrabold text-[15px] text-bq-amberd">
                        <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-6" />
                        <span>
                          {q.book} {q.chapter}:{q.verseStart}
                          {q.verseEnd && q.verseEnd !== q.verseStart ? `–${q.verseEnd}` : ''}
                        </span>
                      </div>
                    )}
                    {q.explanation && (
                      <p className="m-0 font-read text-[15px] leading-relaxed text-bq-ink2">{q.explanation}</p>
                    )}
                    {q.contextNote && (
                      <div className="pt-1 font-read text-[13.5px] italic text-bq-ink3">
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
          <div className="py-12 text-center">
            <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-28 mb-2 opacity-90" />
            <p className="m-0 font-read text-[16px] text-bq-ink2">{t('review.noQuestionsInFilter')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
