import React, { useState } from 'react'
import { PlaceBackdrop } from '../components/lk/Place'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import {
  useGroupJourney,
  useCreateJourney,
  useAddJourneyWeek,
  useRemoveJourneyWeek,
  useStartJourney,
} from '../hooks/useGroupJourney'

interface QuizSetItem {
  id: string
  name: string
  questionCount: number
}

/** Group quiz sets via TanStack Query (no useEffect+fetch). */
function useGroupQuizSets(groupId: string) {
  return useQuery<QuizSetItem[]>({
    queryKey: ['groups', groupId, 'quiz-sets'],
    queryFn: async () => {
      const res = await api.get(`/api/groups/${groupId}/quiz-sets`)
      return (res.data.quizSets || []).map((qs: any) => ({
        id: qs.id,
        name: qs.name,
        questionCount: Array.isArray(qs.questionIds) ? qs.questionIds.length : 0,
      }))
    },
    enabled: !!groupId,
    staleTime: 30_000,
  })
}

/**
 * BL-25 GJ-5 — Leader builder. Two modes:
 *  - /journey/new        → create a DRAFT journey (title + description)
 *  - /journey/:id/edit   → add/remove weeks (chặng) on a DRAFT journey, then
 *                          "Bắt đầu hành trình" (start). Opening each week
 *                          happens later in the active JourneyView (D1).
 */
const JourneyBuilder: React.FC = () => {
  const { t } = useTranslation()
  const { id: groupId, journeyId } = useParams()
  const navigate = useNavigate()

  if (!groupId) return null
  return journeyId
    ? <BuildWeeks groupId={groupId} journeyId={journeyId} navigate={navigate} t={t} />
    : <CreateJourney groupId={groupId} navigate={navigate} t={t} />
}

// ── create-journey step ──────────────────────────────────────────────────────

const CreateJourney: React.FC<{ groupId: string; navigate: ReturnType<typeof useNavigate>; t: any }> = ({ groupId, navigate, t }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useCreateJourney(groupId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    try {
      const j = await create.mutateAsync({ title: title.trim(), description: description.trim() || undefined })
      navigate(`/groups/${groupId}/journey/${j.id}/edit`, { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.message || t('groupJourney.errorCreate'))
    }
  }

  return (
    <div className="relative min-h-screen text-bq-ink px-4 py-6 max-w-3xl mx-auto" data-testid="journey-builder-create">
      <PlaceBackdrop place="chapel" veil="strong" />
      <Header groupId={groupId} navigate={navigate} title={t('groupJourney.createTitle')} subtitle={t('groupJourney.createSubtitle')} />
      <form onSubmit={submit} className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold mb-1.5">{t('groupJourney.fieldTitle')} <span className="text-error">*</span></label>
          <input
            value={title} onChange={e => setTitle(e.target.value)} required data-testid="journey-title-input"
            className="w-full bg-bq-white border border-bq-hair text-bq-ink placeholder:text-bq-ink3 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-bq-sapphire outline-none"
            placeholder={t('groupJourney.fieldTitlePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5">{t('groupJourney.fieldDescription')}</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full bg-bq-white border border-bq-hair text-bq-ink placeholder:text-bq-ink3 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-bq-sapphire outline-none resize-vertical"
            placeholder={t('groupJourney.fieldDescriptionPlaceholder')}
          />
        </div>
        {error && <div className="text-error text-sm" data-testid="journey-error">{error}</div>}
        <button
          type="submit" disabled={create.isPending || !title.trim()} data-testid="journey-create-submit"
          className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 bg-bq-action text-bq-ink shadow-bq-action"
        >
          <span className="material-symbols-outlined text-base">hiking</span>
          {create.isPending ? '...' : t('groupJourney.createCta')}
        </button>
      </form>
    </div>
  )
}

// ── build-weeks step ─────────────────────────────────────────────────────────

const BuildWeeks: React.FC<{ groupId: string; journeyId: string; navigate: ReturnType<typeof useNavigate>; t: any }> = ({ groupId, journeyId, navigate, t }) => {
  const { data: journey, isLoading, isError } = useGroupJourney(groupId, journeyId)
  const quizSetsQ = useGroupQuizSets(groupId)
  const addWeek = useAddJourneyWeek(groupId, journeyId)
  const removeWeek = useRemoveJourneyWeek(groupId, journeyId)
  const start = useStartJourney(groupId, journeyId)

  const [weekTitle, setWeekTitle] = useState('')
  const [quizSetId, setQuizSetId] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (isLoading) {
    return <CenteredState groupId={groupId} navigate={navigate}><div data-testid="journey-builder-loading" className="animate-pulse text-bq-ink2 text-sm">{t('common.loading')}</div></CenteredState>
  }
  if (isError || !journey) {
    return <CenteredState groupId={groupId} navigate={navigate}><div data-testid="journey-builder-error" className="text-error text-sm">{t('groupJourney.errorLoad')}</div></CenteredState>
  }

  // Already started → managing happens in the view.
  if (journey.status !== 'DRAFT') {
    navigate(`/groups/${groupId}/journey/${journeyId}`, { replace: true })
    return null
  }

  const sets = quizSetsQ.data || []
  const canAdd = !!quizSetId
  const canStart = journey.weeks.length > 0

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdd) return
    setError(null)
    try {
      await addWeek.mutateAsync({ title: weekTitle.trim() || undefined, quizSetId })
      setWeekTitle(''); setQuizSetId('')
    } catch (err: any) {
      setError(err?.response?.data?.message || t('groupJourney.errorAddWeek'))
    }
  }

  const onStart = async () => {
    setError(null)
    try {
      await start.mutateAsync()
      navigate(`/groups/${groupId}/journey/${journeyId}`, { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.message || t('groupJourney.errorStart'))
    }
  }

  return (
    <div className="relative min-h-screen text-bq-ink px-4 py-6 max-w-3xl mx-auto" data-testid="journey-builder-weeks">
      <PlaceBackdrop place="chapel" veil="strong" />
      <Header groupId={groupId} navigate={navigate} title={journey.title} subtitle={t('groupJourney.buildSubtitle')} />

      {/* Weeks list */}
      <div className="space-y-2 mb-4" data-testid="journey-week-list">
        {journey.weeks.length === 0 ? (
          <div className="bg-bq-inset border border-bq-hair rounded-2xl p-6 text-center text-bq-ink2 text-sm" data-testid="journey-weeks-empty">
            {t('groupJourney.weeksEmpty')}
          </div>
        ) : journey.weeks.map(w => (
          <div key={w.id} className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl px-4 py-3 flex items-center gap-3" data-testid="journey-week-row">
            <div className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 bg-bq-sapphire/10 border border-bq-sapphire/25 text-bq-sapphire font-bold text-sm tabular-nums">
              {w.weekNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{w.title}</div>
            </div>
            <button
              type="button" onClick={() => removeWeek.mutate(w.id)} disabled={removeWeek.isPending}
              data-testid="journey-week-remove"
              className="text-bq-ink3 hover:text-error transition disabled:opacity-40" aria-label={t('groupJourney.removeWeek')}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ))}
      </div>

      {/* Add week */}
      <form onSubmit={onAdd} className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-4 space-y-3 mb-4" data-testid="journey-add-week">
        <div className="text-[12.5px] font-bold text-bq-amberd">{t('groupJourney.addWeekTitle')}</div>
        <input
          value={weekTitle} onChange={e => setWeekTitle(e.target.value)} data-testid="journey-week-title-input"
          className="w-full bg-bq-white border border-bq-hair text-bq-ink placeholder:text-bq-ink3 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-bq-sapphire outline-none"
          placeholder={t('groupJourney.weekTitlePlaceholder')}
        />
        <select
          value={quizSetId} onChange={e => setQuizSetId(e.target.value)} data-testid="journey-week-quizset-select"
          className="w-full bg-bq-white border border-bq-hair text-bq-ink rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-bq-sapphire outline-none"
        >
          <option value="">{t('groupJourney.selectQuizSet')}</option>
          {sets.map(qs => (
            <option key={qs.id} value={qs.id}>{qs.name} ({qs.questionCount})</option>
          ))}
        </select>
        {sets.length === 0 && (
          <button type="button" onClick={() => navigate(`/groups/${groupId}?tab=quizsets`)} className="text-bq-amberd hover:underline text-xs">
            {t('groupJourney.createQuizSetLink')} →
          </button>
        )}
        <button
          type="submit" disabled={!canAdd || addWeek.isPending} data-testid="journey-add-week-submit"
          className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 bg-bq-inset text-bq-ink border border-bq-hair hover:brightness-95"
        >
          <span className="material-symbols-outlined text-base">add</span>
          {t('groupJourney.addWeekCta')}
        </button>
      </form>

      {error && <div className="text-error text-sm mb-3" data-testid="journey-error">{error}</div>}

      {/* Start */}
      <button
        type="button" onClick={onStart} disabled={!canStart || start.isPending} data-testid="journey-start-submit"
        className="w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 bg-bq-action text-bq-ink shadow-bq-action"
      >
        <span className="material-symbols-outlined text-base">flag</span>
        {start.isPending ? '...' : t('groupJourney.startCta')}
      </button>
      {!canStart && <p className="text-bq-ink2 text-[11px] text-center mt-1.5">{t('groupJourney.startHint')}</p>}
    </div>
  )
}

// ── shared chrome ────────────────────────────────────────────────────────────

const Header: React.FC<{ groupId: string; navigate: ReturnType<typeof useNavigate>; title: string; subtitle: string }> = ({ groupId, navigate, title, subtitle }) => (
  <div className="mb-5 flex items-center gap-3">
    <button onClick={() => navigate(`/groups/${groupId}`)} className="text-bq-ink2 hover:text-bq-ink" aria-label="Back">
      <span className="material-symbols-outlined">arrow_back</span>
    </button>
    <div className="min-w-0">
      <h1 className="text-xl font-bold font-display flex items-center gap-2 truncate">
        <span className="material-symbols-outlined text-bq-sapphire">hiking</span>
        {title}
      </h1>
      <p className="text-bq-ink2 text-xs">{subtitle}</p>
    </div>
  </div>
)

const CenteredState: React.FC<{ groupId: string; navigate: ReturnType<typeof useNavigate>; children: React.ReactNode }> = ({ groupId, navigate, children }) => (
  <div className="min-h-screen bg-bq-paper text-bq-ink px-4 py-6 max-w-3xl mx-auto">
    <Header groupId={groupId} navigate={navigate} title="" subtitle="" />
    <div className="grid place-items-center py-16">{children}</div>
  </div>
)

export default JourneyBuilder
