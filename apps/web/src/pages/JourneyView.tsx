import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGroupJourney, useOpenNextWeek } from '../hooks/useGroupJourney'
import { PlaceBackdrop } from '../components/lk/Place'
import type { JourneyWeek } from '../api/groupJourney'

type DeadlinePreset = '24h' | '7d' | '14d'
const computeDeadline = (preset: DeadlinePreset): string => {
  const hours = preset === '24h' ? 24 : preset === '14d' ? 14 * 24 : 7 * 24
  return new Date(Date.now() + hours * 3600 * 1000).toISOString().slice(0, 19)
}

/**
 * BL-25 GJ-6 — Journey view (hero of the group). Shows overall progress
 * (chặng k/N) + per-week status. Members get "Làm chặng này" → the week's
 * ScheduledQuiz (reuses the whole scheduled-quiz flow). Leader/mod sees per-week
 * X/Y done + "ai chưa làm" and opens the next LOCKED week (D1).
 */
const JourneyView: React.FC = () => {
  const { t } = useTranslation()
  const { id: groupId, journeyId } = useParams()
  const navigate = useNavigate()
  const { data: journey, isLoading, isError } = useGroupJourney(groupId || '', journeyId || '')

  if (!groupId || !journeyId) return null

  return (
    <div className="relative min-h-screen text-bq-ink px-4 py-6 max-w-3xl mx-auto" data-testid="journey-view">
      <PlaceBackdrop place="chapel" veil="strong" />
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(`/groups/${groupId}`)} className="text-bq-ink2 hover:text-bq-ink" aria-label="Back">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold font-display flex items-center gap-2 truncate">
          <span className="material-symbols-outlined text-bq-sapphire">hiking</span>
          {journey?.title || t('groupJourney.viewTitle')}
        </h1>
      </div>

      {isLoading && <div data-testid="journey-view-loading" className="animate-pulse text-bq-ink2 text-sm py-16 text-center">{t('common.loading')}</div>}
      {(isError || (!isLoading && !journey)) && <div data-testid="journey-view-error" className="text-error text-sm py-16 text-center">{t('groupJourney.errorLoad')}</div>}

      {journey && (
        <>
          <ProgressHero journey={journey} t={t} />
          <div className="space-y-2.5" data-testid="journey-week-list">
            {journey.weeks.length === 0 ? (
              <div className="bg-bq-inset border border-bq-hair rounded-2xl p-6 text-center text-bq-ink2 text-sm" data-testid="journey-view-empty">
                {t('groupJourney.weeksEmpty')}
              </div>
            ) : journey.weeks.map((w, idx) => (
              <WeekCard
                key={w.id} week={w} groupId={groupId} journeyId={journeyId}
                isLeader={journey.viewerIsLeader} totalMembers={journey.totalMembers}
                isNextLockable={journey.viewerIsLeader && firstLockedIndex(journey.weeks) === idx}
                navigate={navigate} t={t}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const firstLockedIndex = (weeks: JourneyWeek[]) => weeks.findIndex(w => w.status === 'LOCKED')

// ── progress hero ────────────────────────────────────────────────────────────

const ProgressHero: React.FC<{ journey: any; t: any }> = ({ journey, t }) => {
  const pct = journey.weeksTotal > 0 ? Math.round((journey.weeksOpened / journey.weeksTotal) * 100) : 0
  return (
    <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 mb-4" data-testid="journey-progress-hero">
      <div className="flex items-end justify-between mb-2">
        <div className="text-sm font-bold text-bq-ink2">{t('groupJourney.stageLabel')}</div>
        <div className="text-2xl font-extrabold tabular-nums text-bq-sapphire" data-testid="journey-stage">
          {journey.weeksOpened}<span className="text-bq-ink3 text-base">/{journey.weeksTotal}</span>
        </div>
      </div>
      <div className="h-2 bg-bq-inset rounded-full overflow-hidden">
        <div className="h-full bg-bq-amber transition-all" style={{ width: `${pct}%` }} data-testid="journey-progress-bar" />
      </div>
      {journey.description && <p className="text-bq-ink2 text-xs mt-3 leading-relaxed">{journey.description}</p>}
    </div>
  )
}

// ── per-week card ────────────────────────────────────────────────────────────

interface WeekCardProps {
  week: JourneyWeek
  groupId: string
  journeyId: string
  isLeader: boolean
  totalMembers: number
  isNextLockable: boolean
  navigate: ReturnType<typeof useNavigate>
  t: any
}

const WeekCard: React.FC<WeekCardProps> = ({ week, groupId, journeyId, isLeader, totalMembers, isNextLockable, navigate, t }) => {
  const open = useOpenNextWeek(groupId, journeyId)
  const [preset, setPreset] = useState<DeadlinePreset>('7d')
  const [error, setError] = useState<string | null>(null)
  const [showNotDone, setShowNotDone] = useState(false)

  const isOpen = week.status === 'OPEN' && !!week.scheduledQuizId
  const done = week.doneCount ?? 0

  const onOpen = async () => {
    setError(null)
    try {
      await open.mutateAsync(computeDeadline(preset))
    } catch (err: any) {
      setError(err?.response?.data?.message || t('groupJourney.errorOpen'))
    }
  }

  return (
    <div className={`rounded-xl px-4 py-3 border ${isOpen ? 'bg-bq-white border-bq-hair shadow-bq-soft' : 'bg-bq-inset border-bq-hair'}`} data-testid="journey-week-card">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 font-bold text-sm tabular-nums border ${
          isOpen ? 'bg-bq-sapphire/10 border-bq-sapphire/25 text-bq-sapphire' : 'bg-bq-white border-bq-hair text-bq-ink3'
        }`}>
          {week.weekNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{week.title}</div>
          <div className="text-[11px] text-bq-ink2 mt-0.5 flex items-center gap-1.5">
            {isOpen ? (
              <span data-testid="journey-week-done-count">{t('groupJourney.doneCount', { done, total: totalMembers })}</span>
            ) : (
              <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">lock</span>{t('groupJourney.weekLocked')}</span>
            )}
          </div>
        </div>
        {/* Member/leader action on an open week */}
        {isOpen && (
          week.viewerDone ? (
            <span className="text-bq-emerald text-xs font-bold inline-flex items-center gap-1" data-testid="journey-week-done-badge">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>{t('groupJourney.weekDone')}
            </span>
          ) : (
            <button
              type="button" data-testid="journey-week-play"
              onClick={() => navigate(`/groups/${groupId}/scheduled-quizzes/${week.scheduledQuizId}`)}
              className="px-3.5 py-2 rounded-lg font-bold text-xs bg-bq-action text-bq-ink shadow-bq-action"
            >
              {t('groupJourney.playWeek')}
            </button>
          )
        )}
      </div>

      {/* Leader: open the next locked week */}
      {isNextLockable && (
        <div className="mt-3 pt-3 border-t border-bq-hair" data-testid="journey-open-next">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {(['24h', '7d', '14d'] as DeadlinePreset[]).map(p => (
              <button
                key={p} type="button" onClick={() => setPreset(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                  preset === p ? 'bg-bq-amber/15 text-bq-amberd border border-bq-amber/40' : 'bg-bq-white text-bq-ink2 border border-bq-hair'
                }`}
              >
                {t(`groupJourney.deadline_${p}`)}
              </button>
            ))}
            <button
              type="button" onClick={onOpen} disabled={open.isPending} data-testid="journey-open-next-submit"
              className="ml-auto px-3.5 py-2 rounded-lg font-bold text-xs bg-bq-emerald text-white shadow-bq-eme disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px] align-middle mr-1">lock_open</span>
              {open.isPending ? '...' : t('groupJourney.openWeek')}
            </button>
          </div>
          {error && <div className="text-error text-[11px]" data-testid="journey-open-error">{error}</div>}
        </div>
      )}

      {/* Leader: who hasn't done this open week */}
      {isLeader && isOpen && week.notDone && week.notDone.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-bq-hair" data-testid="journey-not-done">
          <button type="button" onClick={() => setShowNotDone(s => !s)} className="text-[11px] text-bq-amberd font-semibold inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">{showNotDone ? 'expand_less' : 'expand_more'}</span>
            {t('groupJourney.notDoneCount', { count: week.notDone.length })}
          </button>
          {showNotDone && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {week.notDone.map(m => (
                <span key={m.userId} className="px-2 py-0.5 rounded-full text-[11px] bg-bq-inset border border-bq-hair text-bq-ink2">{m.name}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default JourneyView
