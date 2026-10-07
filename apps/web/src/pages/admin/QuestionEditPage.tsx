import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, aiApi } from '../../api/client'
import QuestionFields from './QuestionFields'
import {
  Question, QuestionType, Difficulty, DuplicateWarning,
  EMPTY_QUESTION, optionDefaults, evaluateQuestionQuality,
} from './questionTypes'

interface AiSuggestion {
  options?: string[]
  correctAnswer?: number
  explanation?: string
  rationale?: string
  weakDistractors?: string[]
}

export default function QuestionEditPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const backTo = params.get('from') === 'review' ? '/admin/review-queue' : '/admin/questions'

  const [draft, setDraft] = useState<Partial<Question> | null>(
    isNew ? { ...EMPTY_QUESTION } : ((location.state as any)?.question ?? null)
  )
  const [loading, setLoading] = useState(!isNew && !draft)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dup, setDup] = useState<DuplicateWarning | null>(null)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)

  useEffect(() => {
    if (isNew || draft) return
    setLoading(true)
    api.get<Question>(`/api/admin/questions/${id}`)
      .then(res => setDraft(res.data))
      .catch(() => setLoadError(t('admin.questions.error.loading')))
      .finally(() => setLoading(false))
  }, [id, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

  const setField = <K extends keyof Question>(key: K, val: Question[K]) =>
    setDraft(prev => prev ? { ...prev, [key]: val } : prev)
  const setOption = (i: number, val: string) =>
    setDraft(prev => {
      if (!prev) return prev
      const opts = [...(prev.options ?? [])]; opts[i] = val
      return { ...prev, options: opts }
    })
  const toggleCorrect = (i: number) =>
    setDraft(prev => {
      if (!prev) return prev
      if (prev.type === 'multiple_choice_multi') {
        const cur = prev.correctAnswer ?? []
        return { ...prev, correctAnswer: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i].sort() }
      }
      return { ...prev, correctAnswer: [i] }
    })
  const handleTypeChange = (newType: QuestionType) =>
    setDraft(prev => prev ? {
      ...prev, type: newType,
      options: optionDefaults(newType, prev.language ?? 'vi'),
      correctAnswer: [0], correctAnswerText: '',
    } : prev)

  const save = async (forceCreate = false) => {
    if (!draft) return
    // Only send fields the Question entity accepts — a draft coming from the
    // Review Queue carries extras (approvalsRequired, reviews) the strict BE
    // deserializer rejects ("Field X is not allowed").
    const payload: Partial<Question> = {
      book: draft.book, chapter: draft.chapter, verseStart: draft.verseStart, verseEnd: draft.verseEnd,
      difficulty: draft.difficulty, type: draft.type, content: draft.content,
      options: draft.options, correctAnswer: draft.correctAnswer, correctAnswerText: draft.correctAnswerText,
      explanation: draft.explanation, language: draft.language, reviewStatus: draft.reviewStatus,
      category: draft.category,
    }
    setSaving(true); setSaveError(null); setDup(null)
    try {
      if (draft.id) await api.put(`/api/admin/questions/${draft.id}`, payload)
      else await api.post(forceCreate ? '/api/admin/questions?forceCreate=true' : '/api/admin/questions', payload)
      navigate(backTo)
    } catch (e: any) {
      const d = e?.response?.data
      if (e?.response?.status === 409 && d?.error === 'POSSIBLE_DUPLICATE') setDup(d)
      else if (e?.response?.status === 409 && d?.error === 'DUPLICATE') setSaveError(t('admin.questions.error.exactDuplicate', { message: d.message }))
      else setSaveError(d?.message ?? d?.error ?? t('admin.questions.error.saveFailed'))
    } finally { setSaving(false) }
  }

  const requestAiSuggestion = async () => {
    if (!draft) return
    setAiLoading(true); setAiMsg(null); setAiSuggestion(null)
    try {
      const res = await aiApi.post('/api/admin/ai/improve-question', {
        content: draft.content, options: draft.options, correctAnswer: draft.correctAnswer,
        explanation: draft.explanation, type: draft.type, language: draft.language, difficulty: draft.difficulty,
        book: draft.book, chapter: draft.chapter, verseStart: draft.verseStart, verseEnd: draft.verseEnd,
      })
      if (res.data?.aiAvailable && res.data.suggestion) setAiSuggestion(res.data.suggestion)
      else setAiMsg(res.data?.message ?? t('admin.questions.editor.aiUnavailable'))
    } catch (e: any) {
      setAiMsg(e?.response?.data?.message ?? t('admin.questions.editor.aiFailed'))
    } finally { setAiLoading(false) }
  }

  const applySuggestion = (s: AiSuggestion) =>
    setDraft(prev => prev ? {
      ...prev,
      options: Array.isArray(s.options) && s.options.length ? s.options : prev.options,
      correctAnswer: typeof s.correctAnswer === 'number' ? [s.correctAnswer] : prev.correctAnswer,
      explanation: typeof s.explanation === 'string' && s.explanation ? s.explanation : prev.explanation,
    } : prev)

  if (loading) return <div className="p-8 text-[#6B5530]">{t('admin.questions.modal.saving')}…</div>
  if (loadError || !draft) return (
    <div className="p-8">
      <p className="text-[#B3452F] mb-3">{loadError ?? t('admin.questions.error.loading')}</p>
      <Link to={backTo} className="text-[#8A5A12] text-sm">← {t('admin.backToApp')}</Link>
    </div>
  )

  const isMc = draft.type === 'multiple_choice_single' || draft.type === 'multiple_choice_multi'
  const checks = evaluateQuestionQuality(draft, t)

  return (
    <div data-testid="question-edit-page" className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={backTo} className="w-9 h-9 rounded-lg bg-[#1D2B22]/[0.04] hover:bg-[#1D2B22]/[0.06] flex items-center justify-center text-[#4D3A1F]">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h2 className="text-xl font-bold text-[#1D2B22]">{isNew ? t('admin.questions.modal.createTitle') : t('admin.questions.modal.editTitle')}</h2>
        </div>
        <div className="flex gap-2">
          <Link to={backTo} className="px-4 py-2 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 text-sm">{t('admin.questions.modal.cancelButton')}</Link>
          <button data-testid="admin-question-save-btn" disabled={saving} onClick={() => save()}
            className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium">
            {saving ? t('admin.questions.modal.saving') : (draft.id ? t('admin.questions.modal.updateButton') : t('admin.questions.modal.createSubmit'))}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <div className="lg:col-span-7 bg-[#FFF8E7] rounded-xl border border-[#1D2B22]/15 p-5">
          <QuestionFields draft={draft} setField={setField} setOption={setOption} toggleCorrect={toggleCorrect} handleTypeChange={handleTypeChange} />
          {saveError && <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[#B3452F] text-sm">{saveError}</div>}
          {dup && (
            <div data-testid="duplicate-warning" className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <h4 className="text-[#8A5A12] font-semibold text-sm mb-2">⚠️ {dup.message}</h4>
              <div className="flex gap-2">
                <button onClick={() => setDup(null)} className="px-3 py-1.5 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 text-xs">{t('admin.questions.modal.duplicateCancel')}</button>
                <button onClick={() => save(true)} className="px-3 py-1.5 rounded bg-yellow-600 hover:bg-yellow-500 text-xs font-medium">{t('admin.questions.modal.duplicateProceed')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Evaluate + AI suggest */}
        {isMc && (
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 self-start">
            {/* Heuristic checklist (live) */}
            <div data-testid="quality-eval-result" className="bg-[#FFF8E7] rounded-xl border border-[#1D2B22]/15 p-4 space-y-1.5">
              <span className="text-xs font-semibold text-[#4D3A1F] uppercase tracking-wider">{t('admin.questions.editor.evalTitle')}</span>
              {checks.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs pt-1">
                  <span className={c.status === 'pass' ? 'text-[#2E7D4F]' : c.status === 'warn' ? 'text-[#8A5A12]' : 'text-[#2F6FB0]'}>
                    {c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : 'ℹ'}
                  </span>
                  <span className="text-[#4D3A1F] leading-snug">{c.label}</span>
                </div>
              ))}
            </div>

            {/* AI suggestion */}
            <div className="bg-[#FFF8E7] rounded-xl border border-[#1D2B22]/15 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#4D3A1F] uppercase tracking-wider">{t('admin.questions.editor.aiTitle')}</span>
                <button data-testid="ai-suggest-btn" onClick={requestAiSuggestion} disabled={aiLoading}
                  className="text-xs px-3 py-1.5 rounded bg-[#FFC93C]/15 border border-[#8A5A12]/30 text-[#8A5A12] hover:bg-[#FFC93C]/25 disabled:opacity-50 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  {aiLoading ? t('admin.questions.editor.aiAnalyzing') : t('admin.questions.editor.aiSuggestBtn')}
                </button>
              </div>
              {aiMsg && <p className="text-xs text-[#6B5530]">{aiMsg}</p>}
              {aiSuggestion && (
                <div className="space-y-2">
                  {aiSuggestion.rationale && <p className="text-xs text-[#2F6FB0]/80 italic">{aiSuggestion.rationale}</p>}
                  <div className="space-y-1">
                    {(aiSuggestion.options ?? []).map((o, i) => (
                      <div key={i} className={`text-xs px-2 py-1.5 rounded ${i === aiSuggestion.correctAnswer ? 'bg-emerald-500/10 text-[#2E7D4F] border border-emerald-500/20' : 'bg-[#1D2B22]/[0.04] text-[#4D3A1F]'}`}>
                        <span className="font-bold mr-1">{String.fromCharCode(65 + i)}.</span>{o}
                      </div>
                    ))}
                  </div>
                  {aiSuggestion.explanation && <p className="text-[11px] text-[#6B5530] italic">{aiSuggestion.explanation}</p>}
                  <button data-testid="ai-apply-btn" onClick={() => applySuggestion(aiSuggestion)}
                    className="w-full mt-1 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                    {t('admin.questions.editor.applyBtn')}
                  </button>
                  <p className="text-[10px] text-[#6B5530]">{t('admin.questions.editor.applyHint')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
