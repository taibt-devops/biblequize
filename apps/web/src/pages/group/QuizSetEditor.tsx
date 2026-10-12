// BL-AD-8 — Shared Quiz Set Editor (group + personal owner scopes).
// PQS-5: refactored to receive an injectable API adapter + routing prop so
// the same editor renders for /groups/:id/quiz-sets/:setId/edit (group) and
// /my-sets/:setId/edit (personal). Group route mounts via GroupQuizSetEditor
// wrapper; personal route mounts via PersonalQuizSetEditor (PQS-6).
// AIR-2/3 (13/10/2026): không còn AI tạo nháp / AI viết lại — chỉ soạn tay.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type {
  AddQuestionBody, CreateQuizSetBody, EditorQuestion, QuizSet, QuizSetFull,
} from '../../api/quizSets'
import { BIBLE_BOOKS_VI, normalizeBibleBookVi } from '../../data/bibleData'
import EditorTopBar from './quizset-editor/EditorTopBar'
import MetadataAccordion from './quizset-editor/MetadataAccordion'
import QuestionSidebar from './quizset-editor/QuestionSidebar'
import QuestionEditor from './quizset-editor/QuestionEditor'
import PublishConfirmModal from './quizset-editor/PublishConfirmModal'
import { COLOR } from './quizset-editor/styles'
import { useAutoSave } from './quizset-editor/useAutoSave'
import { MIN_QUESTIONS_TO_PUBLISH } from './quizset-editor/validation'

type Mode = 'create' | 'edit'

export interface QuizSetEditorApi {
  createQuizSet: (body: CreateQuizSetBody) => Promise<QuizSet>
  updateQuizSet: (setId: string, body: Partial<CreateQuizSetBody>) => Promise<QuizSet>
  publishQuizSet: (setId: string) => Promise<QuizSet>
  getQuizSetFull: (setId: string) => Promise<QuizSetFull>
  addQuestion: (setId: string, body: AddQuestionBody) => Promise<{ question: EditorQuestion; totalQuestions: number }>
  updateQuestion: (setId: string, qid: string, body: Partial<AddQuestionBody>) => Promise<EditorQuestion>
  deleteQuestion: (setId: string, qid: string) => Promise<number>
}

interface Props {
  mode?: Mode
  setIdFromRoute?: string
  ownership: 'group' | 'personal'
  ownerName?: string
  backHref: string
  /** Where to navigate after a successful create (will append `${newId}/edit`). Trailing slash required. */
  editPathBase: string
  /** Where to navigate after publish (will append `${setId}`). Trailing slash required. */
  detailPathBase: string
  api: QuizSetEditorApi
}

export default function QuizSetEditor({
  mode: forcedMode, setIdFromRoute, ownership, ownerName, backHref,
  editPathBase, detailPathBase, api,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mode: Mode = forcedMode ?? (setIdFromRoute ? 'edit' : 'create')

  const [quizSet, setQuizSet] = useState<QuizSetFull | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [, forceTick] = useState(0)

  const [publishOpen, setPublishOpen] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)

  /** Brief saved toast — fires on every manual save click so the user
   *  gets feedback even when there are no pending changes to flush. */
  const [saveFlash, setSaveFlash] = useState(false)
  const flashSaved = useCallback(() => {
    setLastSavedAt(Date.now())
    setSaveFlash(true)
    const t = setTimeout(() => setSaveFlash(false), 1500)
    return () => clearTimeout(t)
  }, [])

  const [scope, setScope] = useState({ book: BIBLE_BOOKS_VI[0], chapterFrom: 1, chapterTo: 1 })
  const dirtyMetaRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Initial load: create flow auto-creates a DRAFT, then navigates to edit page.
  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(null)
    ;(async () => {
      try {
        if (mode === 'create' && !setIdFromRoute) {
          const created = await api.createQuizSet({ name: t('quizSet.editor.parent.defaultSetName') })
          if (cancelled) return
          navigate(`${editPathBase}${created.id}/edit`, { replace: true })
          return
        }
        if (!setIdFromRoute) return
        const full = await api.getQuizSetFull(setIdFromRoute)
        if (cancelled) return
        setQuizSet(full)
        setActiveId(full.questions?.[0]?.id ?? null)
        const first = full.questions?.[0]
        if (first?.book) {
          setScope({ book: normalizeBibleBookVi(first.book), chapterFrom: first.chapter ?? 1, chapterTo: first.chapter ?? 1 })
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.response?.data?.message || e?.message || t('quizSet.editor.parent.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, setIdFromRoute])

  const activeQuestion = useMemo(
    () => quizSet?.questions.find(q => q.id === activeId) ?? null,
    [quizSet, activeId],
  )

  const persistQuestion = useCallback(async (payload: { qid: string; patch: Partial<EditorQuestion> }) => {
    if (!quizSet) return
    setSaving(true)
    try {
      await api.updateQuestion(quizSet.id, payload.qid, payload.patch as Partial<AddQuestionBody>)
      setLastSavedAt(Date.now())
    } finally { setSaving(false) }
  }, [api, quizSet])

  const { schedule: scheduleQuestionSave, flush: flushQuestionSave } = useAutoSave(persistQuestion)

  const persistMetadata = useCallback(async (patch: Partial<QuizSetFull>) => {
    if (!quizSet) return
    setSaving(true)
    try {
      await api.updateQuizSet(quizSet.id, patch as Partial<CreateQuizSetBody>)
      setLastSavedAt(Date.now())
      dirtyMetaRef.current = false
    } finally { setSaving(false) }
  }, [api, quizSet])

  const { schedule: scheduleMetaSave, flush: flushMetaSave } = useAutoSave(persistMetadata)

  const handleQuestionChange = (qid: string, patch: Partial<EditorQuestion>) => {
    setQuizSet(prev => {
      if (!prev) return prev
      const idx = prev.questions.findIndex(q => q.id === qid)
      if (idx < 0) return prev
      const next = [...prev.questions]
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, questions: next }
    })
    scheduleQuestionSave({ qid, patch })
  }

  const handleMetaChange = (patch: Partial<QuizSetFull>) => {
    setQuizSet(prev => prev ? { ...prev, ...patch } : prev)
    dirtyMetaRef.current = true
    scheduleMetaSave(patch)
  }

  const handleAddManual = async () => {
    if (!quizSet) return
    try {
      await flushQuestionSave()
      const { question, totalQuestions } = await api.addQuestion(quizSet.id, {
        content: '', book: scope.book, chapter: scope.chapterFrom,
        difficulty: 'medium', options: ['', '', '', ''], correctAnswer: [0],
        explanation: '', language: (quizSet.language || 'vi').toLowerCase(),
      })
      setQuizSet(prev => prev ? {
        ...prev,
        questions: [...prev.questions, question],
        questionIds: [...prev.questionIds, question.id],
        totalQuestions,
      } : prev)
      setActiveId(question.id)
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (qid: string) => {
    if (!quizSet) return
    if (!window.confirm(t('quizSet.editor.parent.deletePrompt'))) return
    try {
      const total = await api.deleteQuestion(quizSet.id, qid)
      setQuizSet(prev => prev ? {
        ...prev,
        questions: prev.questions.filter(q => q.id !== qid),
        questionIds: prev.questionIds.filter(id => id !== qid),
        totalQuestions: total,
      } : prev)
      if (activeId === qid) {
        const remaining = quizSet.questions.filter(q => q.id !== qid)
        setActiveId(remaining[0]?.id ?? null)
      }
    } catch (e) { console.error(e) }
  }

  const handlePublishClick = async () => {
    await flushQuestionSave()
    await flushMetaSave()
    // PUBLISHED → button label is "Save changes": the two flushes above are
    // the save; opening the publish modal would just confuse + fail BE check.
    if (quizSet?.publishStatus === 'DRAFT') {
      setPublishOpen(true)
    } else {
      flashSaved()
    }
  }

  const handleConfirmPublish = async () => {
    if (!quizSet) return
    setPublishBusy(true)
    try {
      const updated = await api.publishQuizSet(quizSet.id)
      setQuizSet(prev => prev ? { ...prev, ...updated } : prev)
      setPublishOpen(false)
      navigate(`${detailPathBase}${quizSet.id}`)
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || t('quizSet.editor.parent.publishError'))
    } finally { setPublishBusy(false) }
  }

  const handleSaveDraftClick = async () => {
    await flushQuestionSave()
    await flushMetaSave()
    flashSaved()
  }

  const handleActivate = async (id: string) => {
    if (id === activeId) return
    await flushQuestionSave()
    setActiveId(id)
  }

  if (loading) return <PageShell><div style={spinnerStyle()}>{t('quizSet.editor.parent.loading')}</div></PageShell>
  if (loadError) return <PageShell><div style={errorStyle()}>{loadError}</div></PageShell>
  if (!quizSet) return <PageShell><div style={errorStyle()}>{t('quizSet.editor.parent.notFoundSet')}</div></PageShell>

  const lastSavedAgoSec = lastSavedAt ? Math.floor((Date.now() - lastSavedAt) / 1000) : null
  const questions = quizSet.questions ?? []
  const activeIdx = activeQuestion ? questions.findIndex(q => q.id === activeQuestion.id) : -1
  const canPublish = quizSet.publishStatus === 'DRAFT'
    && questions.length >= MIN_QUESTIONS_TO_PUBLISH
    && (quizSet.name || '').trim().length >= 3

  return (
    <div style={{ background: COLOR.bgDeep, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <EditorTopBar
        backHref={backHref}
        ownerName={ownerName}
        quizSetName={quizSet.name}
        status={quizSet.publishStatus}
        lastSavedAgoSec={lastSavedAgoSec}
        saving={saving}
        questionCount={questions.length}
        onPublish={handlePublishClick}
        onSaveDraft={handleSaveDraftClick}
        canPublish={canPublish}
      />

      <MetadataAccordion
        quizSet={quizSet}
        onChange={handleMetaChange}
        defaultBook={scope.book}
        defaultChapterFrom={scope.chapterFrom}
        defaultChapterTo={scope.chapterTo}
        onScopeChange={setScope}
      />

      <div className="qse-body" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        <QuestionSidebar
          questions={questions}
          activeId={activeId}
          onActivate={handleActivate}
          onAddManual={handleAddManual}
        />

        {activeQuestion ? (
          <QuestionEditor
            index={activeIdx}
            question={activeQuestion}
            onChange={patch => handleQuestionChange(activeQuestion.id, patch)}
            onDelete={() => handleDelete(activeQuestion.id)}
          />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: COLOR.bgSection, color: COLOR.textMuted, fontSize: 14, padding: 32, textAlign: 'center',
          }}>
            {t('quizSet.editor.parent.emptyPanelManual')}
          </div>
        )}
      </div>

      <PublishConfirmModal
        open={publishOpen}
        questions={questions}
        nameValid={(quizSet.name || '').trim().length >= 3}
        onClose={() => setPublishOpen(false)}
        onConfirm={handleConfirmPublish}
        onGotoQuestion={id => setActiveId(id)}
        busy={publishBusy}
      />

      {/* Save toast — confirms manual save click landed even when nothing
          was actually pending (auto-save had already flushed). */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed', top: 80, right: 24, zIndex: 100,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: '#2E7D4F', color: '#FFFFFF',
          boxShadow: '0 18px 40px -24px rgba(20,20,30,0.28)',
          display: 'flex', alignItems: 'center', gap: 6,
          pointerEvents: 'none',
          opacity: saveFlash ? 1 : 0,
          transform: saveFlash ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 200ms ease, transform 200ms ease',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden>check_circle</span>
        {t('quizSet.editor.parent.savedToast')}
      </div>

      <style>{`
        @media (max-width: 767px) {
          .qse-body {
            grid-template-columns: minmax(0, 1fr) !important;
            grid-template-rows: auto 1fr !important;
          }
        }
        /* Prevent iOS Safari auto-zoom on focus (phone + tablet touch): fields
           need >=16px font. Layout collapse is 767px so iPad portrait (768)
           keeps the desktop two-pane editor. */
        @media (max-width: 1024px) {
          .qse-body input, .qse-body textarea, .qse-body select {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: COLOR.bgDeep, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>{children}</div>
  )
}

function spinnerStyle(): React.CSSProperties {
  return { color: COLOR.textMuted, fontSize: 14 }
}
function errorStyle(): React.CSSProperties {
  return { color: COLOR.danger, fontSize: 14, textAlign: 'center', maxWidth: 480 }
}
