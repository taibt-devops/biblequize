import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGroupJourneys, useGroupJourney } from '../../hooks/useGroupJourney'
import type { GroupJourneySummary } from '../../api/groupJourney'

/**
 * BL-25 GJ-7 — Group Journey hero. The group's lead affordance (D3: journey is
 * the protagonist). Surfaces the active journey's overall progress, or a "create"
 * CTA for leaders when none exists. Members see nothing until a journey is
 * ACTIVE (DRAFT journeys are leader-only).
 */
export default function JourneyHeroCard({ groupId, isLeaderOrMod }: { groupId: string; isLeaderOrMod: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: list, isLoading } = useGroupJourneys(groupId)

  const primary = pickPrimary(list, isLeaderOrMod)
  // Pull live progress for the primary journey (enabled only when one exists).
  const { data: detail } = useGroupJourney(groupId, primary?.id || '')

  if (isLoading) {
    return <div data-testid="journey-hero-loading" className="bg-bq-white border border-bq-hair rounded-2xl p-5 animate-pulse h-24" />
  }

  // No journey yet → leader sees a create CTA; members see nothing.
  if (!primary) {
    if (!isLeaderOrMod) return null
    return (
      <button
        type="button" data-testid="journey-hero-create"
        onClick={() => navigate(`/groups/${groupId}/journey/new`)}
        className="w-full text-left rounded-2xl p-5 border border-dashed border-bq-sapphire/40 bg-bq-sapphire/[0.04] hover:bg-bq-sapphire/[0.08] transition flex items-center gap-4"
      >
        <div className="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 bg-bq-sapphire/10 border border-bq-sapphire/25">
          <span className="material-symbols-outlined text-bq-sapphire">hiking</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-bq-ink">{t('groupJourney.heroCreateTitle')}</div>
          <div className="text-xs text-bq-ink2 mt-0.5">{t('groupJourney.heroCreateSub')}</div>
        </div>
        <span className="material-symbols-outlined text-bq-sapphire ml-auto">arrow_forward</span>
      </button>
    )
  }

  const isDraft = primary.status === 'DRAFT'
  const weeksOpened = detail?.weeksOpened ?? 0
  const weeksTotal = detail?.weeksTotal ?? primary.weekCount ?? 0
  const pct = weeksTotal > 0 ? Math.round((weeksOpened / weeksTotal) * 100) : 0
  const target = isDraft ? `/groups/${groupId}/journey/${primary.id}/edit` : `/groups/${groupId}/journey/${primary.id}`

  return (
    <button
      type="button" data-testid="journey-hero"
      onClick={() => navigate(target)}
      className="w-full text-left rounded-2xl p-5 border border-bq-sapphire/25 bg-bq-white shadow-bq-soft hover:border-bq-sapphire/45 hover:-translate-y-0.5 transition"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 bg-bq-sapphire/10 border border-bq-sapphire/25">
          <span className="material-symbols-outlined text-bq-sapphire">hiking</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-bq-sapphire">{t('groupJourney.heroEyebrow')}</div>
          <div className="text-sm font-bold text-bq-ink truncate">{primary.title}</div>
        </div>
        {isDraft ? (
          <span data-testid="journey-hero-draft-chip" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bq-amber/15 text-bq-amberd border border-bq-amber/30">
            {t('groupJourney.heroDraftChip')}
          </span>
        ) : (
          <span className="text-xs font-extrabold tabular-nums text-bq-sapphire" data-testid="journey-hero-stage">
            {weeksOpened}<span className="text-bq-ink3">/{weeksTotal}</span>
          </span>
        )}
      </div>
      {isDraft ? (
        <div className="text-xs text-bq-ink2">{t('groupJourney.heroDraftHint')}</div>
      ) : (
        <div className="h-2 bg-bq-inset rounded-full overflow-hidden">
          <div className="h-full bg-bq-amber transition-all" style={{ width: `${pct}%` }} data-testid="journey-hero-bar" />
        </div>
      )}
    </button>
  )
}

/**
 * Prefer the most recent ACTIVE journey; fall back to a DRAFT one for leaders
 * (so they can finish building it). Members never see DRAFT journeys.
 */
function pickPrimary(list: GroupJourneySummary[] | undefined, isLeaderOrMod: boolean): GroupJourneySummary | undefined {
  if (!list || list.length === 0) return undefined
  const active = list.find(j => j.status === 'ACTIVE')
  if (active) return active
  if (isLeaderOrMod) return list.find(j => j.status === 'DRAFT')
  return undefined
}
