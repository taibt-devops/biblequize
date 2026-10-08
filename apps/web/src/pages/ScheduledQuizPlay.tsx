import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlaceBackdrop } from '../components/lk/Place'
import {
  startScheduledQuizAttempt, submitScheduledQuizAttempt,
  AttemptQuestion,
} from '../api/scheduledQuiz'

const ANSWER_LETTERS = ['A', 'B', 'C', 'D']

const ScheduledQuizPlay: React.FC = () => {
  const { t } = useTranslation()
  const { id: groupId, quizId } = useParams()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState<AttemptQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; correctCount: number; totalQuestions: number } | null>(null)
  const startedAt = useRef<number>(Date.now())

  useEffect(() => {
    if (!groupId || !quizId) return
    startScheduledQuizAttempt(groupId, quizId)
      .then(r => { setQuestions(r.questions); startedAt.current = Date.now() })
      .catch(err => setError(err?.response?.data?.message ?? 'Không thể bắt đầu'))
  }, [groupId, quizId])

  const submitAll = async () => {
    if (!groupId || !quizId) return
    setSubmitting(true)
    const timeSeconds = Math.floor((Date.now() - startedAt.current) / 1000)
    try {
      const r = await submitScheduledQuizAttempt(groupId, quizId, {
        answers: questions.map(q => ({ questionId: q.id, answerIndex: answers[q.id] ?? -1 })),
        timeSeconds,
      })
      setResult({ score: r.score, correctCount: r.correctCount, totalQuestions: r.totalQuestions })
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không gửi được kết quả')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return (
    <div className="p-6 max-w-md mx-auto">
      <div className="text-error mb-3">{error}</div>
      <button onClick={() => navigate(`/groups/${groupId}/scheduled-quizzes/${quizId}`)}
        className="px-4 py-2 bg-bq-amber/15 border border-bq-amber/30 text-bq-amberd rounded-lg text-sm">
        Quay lại
      </button>
    </div>
  )

  if (result) return (
    <div className="min-h-screen bg-bq-paper text-bq-ink p-6 max-w-md mx-auto" data-testid="play-result">
      <div className="rounded-2xl p-6 text-center bg-bq-white border border-bq-amber/30 shadow-bq-soft">
        <div className="text-5xl mb-3">🎯</div>
        <h3 className="text-xl font-bold font-display mb-2">{t('scheduledQuiz.attemptDone')}</h3>
        <div className="text-3xl font-bold text-bq-amberd tabular-nums my-3">{result.score}</div>
        <p className="text-bq-ink2 text-sm mb-5">{result.correctCount}/{result.totalQuestions} {t('scheduledQuiz.correct')}</p>
        <button onClick={() => navigate(`/groups/${groupId}/scheduled-quizzes/${quizId}`, { replace: true })}
          className="w-full py-3 rounded-xl font-bold text-sm bg-bq-action text-bq-ink shadow-bq-action">
          {t('scheduledQuiz.backToDetail')}
        </button>
      </div>
    </div>
  )

  if (questions.length === 0) return <div className="p-6 text-bq-ink2">Đang tải câu hỏi...</div>

  const q = questions[idx]
  const selected = answers[q.id]
  const isLast = idx === questions.length - 1
  const allAnswered = questions.every(qq => answers[qq.id] !== undefined)

  return (
    <div className="relative min-h-screen text-bq-ink p-4 max-w-2xl mx-auto" data-testid="scheduled-quiz-play">
      <PlaceBackdrop place="chapel" veil="strong" />
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { if (confirm('Thoát? Tiến độ sẽ mất.')) navigate(`/groups/${groupId}/scheduled-quizzes/${quizId}`) }}
          className="text-bq-ink2" aria-label="Close">
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="text-[12.5px] font-bold text-bq-amberd">CÂU {idx + 1} / {questions.length}</div>
        <div className="w-6" />
      </div>

      <div className="h-1 bg-bq-inset rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-bq-amber transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
      </div>

      <div className="rounded-xl bg-bq-white border border-bq-hair shadow-bq-soft p-5 mb-5 text-center">
        <div className="text-base font-medium leading-relaxed">{q.content}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {q.options.map((opt, i) => {
          const isSel = selected === i
          return (
            <button key={i} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
              className={`text-left rounded-xl p-3.5 flex items-center gap-3 border-[1.5px] min-h-[60px] transition ${
                isSel ? 'bg-bq-amber/15 border-bq-amber shadow-[0_0_0_2px_rgba(245,158,11,0.3)]' : 'bg-bq-white border-bq-hair hover:border-bq-ink3'
              }`}>
              <div className={`w-8 h-8 rounded-md grid place-items-center text-sm font-bold flex-shrink-0 border ${
                isSel ? 'bg-bq-amber/30 text-bq-amberd border-bq-amber/50' : 'bg-bq-inset text-bq-ink2 border-bq-hair'
              }`}>
                {ANSWER_LETTERS[i]}
              </div>
              <span className="text-sm leading-snug">{opt}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2.5">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          className="flex-1 py-3 rounded-xl bg-bq-inset border border-bq-hair text-bq-ink2 text-sm font-bold disabled:opacity-40">
          {t('scheduledQuiz.prev')}
        </button>
        {!isLast ? (
          <button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-bq-action text-bq-ink shadow-bq-action">
            {t('scheduledQuiz.next')}
          </button>
        ) : (
          <button onClick={submitAll} disabled={submitting || !allAnswered}
            data-testid="submit-attempt"
            className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50 bg-bq-emerald text-white shadow-bq-eme">
            {submitting ? '...' : t('scheduledQuiz.submitAttempt')}
          </button>
        )}
      </div>
    </div>
  )
}

export default ScheduledQuizPlay
