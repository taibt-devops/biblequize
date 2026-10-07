import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getQuizLanguage } from '../utils/quizLanguage'
import { useAuth } from '../store/authStore'
import { getTierInfo } from '../data/tiers'
import { useRankedPage } from '../hooks/useRankedPage'
import { useCoverageStatus, type UnshownBadge } from '../hooks/useCoverageStatus'
import { useMarkBadgeShown } from '../hooks/useMarkBadgeShown'
import { useToast } from '../hooks/useToast'
import RankedSkeleton from '../components/ranked/RankedSkeleton'
import RankedHeader from '../components/ranked/RankedHeader'
import TierProgressCard from '../components/ranked/TierProgressCard'
import CoverageCard from '../components/ranked/CoverageCard'
import PoolExhaustedModal from '../components/ranked/PoolExhaustedModal'
import BadgeAwardModal from '../components/ranked/BadgeAwardModal'
import RankedActionFooter from '../components/ranked/RankedActionFooter'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

export default function Ranked() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    rankedStatus,
    userRank,
    tierData,
    timeLeft,
    isLoading,
    isInitialized,
    refetch,
  } = useRankedPage()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { data: coverage } = useCoverageStatus()
  const [poolExhaustedOpen, setPoolExhaustedOpen] = useState(false)

  // §7.1.8 — surface an earned-but-unshown season badge once on mount.
  const markBadgeShown = useMarkBadgeShown()
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)
  const [activeBadge, setActiveBadge] = useState<UnshownBadge | null>(null)
  const unshownBadgeId = coverage?.unshownBadge?.id
  useEffect(() => {
    if (coverage?.unshownBadge) {
      setActiveBadge(coverage.unshownBadge)
      setBadgeModalOpen(true)
    }
  }, [unshownBadgeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBadgeClose = async () => {
    if (activeBadge) {
      try {
        await markBadgeShown.mutateAsync(activeBadge.id)
      } catch {
        // Non-blocking — coverage-status will still carry it next session.
      }
    }
    setBadgeModalOpen(false)
    setActiveBadge(null)
  }

  const handleUnlockNextWeek = async () => {
    try {
      await api.post('/api/ranked/coverage/unlock-next-week')
      queryClient.invalidateQueries({ queryKey: ['me-coverage-status'] })
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      const code = e?.response?.data?.error ?? 'UNKNOWN'
      showToast({
        type: 'error',
        message: t(`coverage.unlockError.${code}`, t('coverage.unlockError.UNKNOWN')),
      })
    }
  }

  const startRankedQuiz = async () => {
    if (!rankedStatus) return
    let step = 'init'
    try {
      step = 'POST /api/ranked/sessions'
      const res = await api.post('/api/ranked/sessions', { language: getQuizLanguage() })
      const sessionId = res.data.sessionId
      if (!sessionId) throw new Error('BE returned no sessionId')

      // Tier-aware question pick — BE endpoint runs SmartQuestionSelector
      // server-side so Easy/Medium/Hard% follows SPEC §3.2 tier table (T1
      // 70/25/5 → T6 5/35/60). Replaces the previous FE pattern that
      // issued up to 3 /api/questions queries and never applied tier
      // distribution at all (BL-20, fix 2026-05-20).
      const serverAskedIds: string[] = rankedStatus.askedQuestionIdsToday ?? []
      const localAskedIds: string[] = (() => { try { return JSON.parse(localStorage.getItem('askedQuestionIds') || '[]') } catch { return [] } })()
      const excludeIds = Array.from(new Set<string>([...serverAskedIds, ...localAskedIds]))

      step = 'POST /api/ranked/questions/select'
      const pickRes = await api.post('/api/ranked/questions/select', {
        limit: 10,
        excludeIds,
        // Option C: ~70% from the current journey book, ~30% whole-pool variety.
        book: rankedStatus.currentBook,
        difficulty: rankedStatus.currentDifficulty,
        language: getQuizLanguage(),
      })
      const questions: any[] = pickRes.data?.questions ?? []
      const poolExhausted: boolean = pickRes.data?.poolExhausted === true

      if (poolExhausted) {
        // §7.11.4 Liturgical pool exhaustion — Sacred Modernist modal
        // (canUnlockNext drives the CTA set inside the modal).
        setPoolExhaustedOpen(true)
        return
      }

      if (questions.length === 0) {
        showToast({
          type: 'warning',
          message: t('ranked.noQuestionsLeft', 'Bạn đã trả lời hết câu hỏi có sẵn hôm nay. Quay lại sau khi thêm câu mới.'),
        })
        return
      }

      // previousTier snapshot so RankedQuizResults can detect tier-up
      // by comparing against /api/me/tier-progress after the quiz —
      // BE creates a notification on tier-up but doesn't expose the
      // flag in submitRankedAnswer response, so FE diff is simpler
      // than adding a new BE contract (2026-05-20).
      const previousTier = tierData ? {
        level: tierData.tierLevel,
        name: tierData.tierName,
        totalPoints: tierData.totalPoints,
        nextTierPoints: tierData.nextTierPoints,
      } : null

      navigate('/quiz', { state: { sessionId, mode: 'ranked', questions, showExplanation: false, isRanked: true, timePerQuestion: 90, previousTier } })
    } catch (err) {
      const e = err as { response?: { status?: number; data?: unknown }; message?: string }
      const detail = e?.response?.status
        ? `HTTP ${e.response.status} · ${JSON.stringify(e.response.data ?? {}).slice(0, 200)}`
        : e?.message ?? String(err)
      console.error(`[startRankedQuiz] failed at "${step}": ${detail}`, err)
      showToast({ type: 'error', message: t('ranked.cannotStart') })
    }
  }

  if (isLoading || !isInitialized) return <RankedSkeleton />

  if (!rankedStatus) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="bg-bq-white border border-bq-hair shadow-bq-soft p-10 rounded-2xl text-center max-w-md">
          <span className="material-symbols-outlined text-bq-ruby text-5xl mb-4 block">error</span>
          <p className="text-bq-ink font-bold text-lg mb-2">{t('ranked.loadError')}</p>
          <p className="text-bq-ink2 text-sm mb-6">{t('ranked.tryAgainLater')}</p>
          <button onClick={refetch} className="bg-bq-action text-bq-ink shadow-bq-action font-black px-8 py-3 rounded-xl text-sm uppercase tracking-widest active:scale-95">
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  // Derived values
  const canPlay = rankedStatus.livesRemaining > 0 && rankedStatus.questionsCounted < rankedStatus.cap
  const capReached = rankedStatus.questionsCounted >= rankedStatus.cap
  const energy = rankedStatus.livesRemaining ?? 0
  const energyMax = rankedStatus.dailyLives ?? 100
  const energyPct = energyMax > 0 ? Math.max(0, Math.min(100, (energy / energyMax) * 100)) : 0
  const questionsLeftFromEnergy = Math.floor(energy / 5)
  const isOutOfEnergy = energy <= 0
  const totalPoints = tierData?.totalPoints ?? userRank?.points ?? rankedStatus.pointsToday ?? 0
  const tierInfo = getTierInfo(totalPoints)
  const currentTier = tierInfo.current
  const nextTier = tierInfo.next
  const pointsToNext = tierData
    ? Math.max(0, tierData.nextTierPoints - tierData.totalPoints)
    : tierInfo.pointsToNext
  const tierProgressPct = nextTier
    ? (tierData?.tierProgressPercent ?? tierInfo.progressPct)
    : 100
  const streak = user?.currentStreak ?? 0
  const questionsAnswered = rankedStatus.questionsCounted ?? 0
  const questionsCap = rankedStatus.cap || 100
  const pointsToday = rankedStatus.pointsToday ?? 0
  const resetTimeLeft = timeLeft || '--:--:--'

  return (
    <main data-testid="ranked-page" className="max-w-5xl mx-auto pb-[120px] md:pb-10 text-bq-ink">
      <RankedHeader />

      <div className="space-y-4 md:space-y-[18px]">
        <TierProgressCard
          currentTier={currentTier}
          nextTier={nextTier}
          totalPoints={totalPoints}
          pointsToNext={pointsToNext}
          tierProgressPct={tierProgressPct}
          starIndex={tierData?.starIndex}
        />

        {coverage && (
          <CoverageCard coverage={coverage} onUnlockNext={handleUnlockNextWeek} />
        )}

        {/* Stats + Action — 1-col stack on mobile, 2-col 1.55fr/1fr on md+. */}
        <div className="grid grid-cols-1 md:grid-cols-[1.55fr_1fr] gap-[18px]">

          {/* ─── Stats composite card ──────────────────────────────── */}
          <section
            data-testid="ranked-stats-card"
            className="rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-soft overflow-hidden"
          >
            {/* Energy section */}
            <div className="px-5 md:px-7 pt-5 md:pt-6 pb-5 md:pb-[22px] border-b border-bq-hair">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2 text-bq-ink2">
                  <span className="material-symbols-outlined text-[17px] text-bq-amberd">bolt</span>
                  <span className="text-[11px] font-bold uppercase tracking-[1.3px]">
                    {t('ranked.energy')}
                  </span>
                </div>
                <div
                  data-testid="ranked-reset-timer"
                  className="text-bq-ink3 text-[12px] inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">schedule</span>
                  {t('ranked.energyRecoverIn', { time: resetTimeLeft })}
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                <span
                  data-testid="ranked-energy-display"
                  className="text-bq-amberd text-[36px] md:text-[40px] font-extrabold leading-none tracking-tight"
                >
                  {energy}
                </span>
                <span className="text-bq-ink3 text-[14px] md:text-[15px] font-semibold">
                  / {energyMax}
                </span>
                {!isOutOfEnergy && (
                  <span
                    data-testid="ranked-energy-status"
                    className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1 bg-bq-emerald/10 text-bq-emerald"
                  >
                    <span className="material-symbols-outlined text-[14px]" style={FILL_1}>check_circle</span>
                    {t('ranked.energyEnoughForNQuestions', { count: questionsLeftFromEnergy })}
                  </span>
                )}
                {isOutOfEnergy && (
                  <span className="ml-auto text-[11px] text-bq-ink3 font-semibold">
                    {t('ranked.outOfEnergy')}
                  </span>
                )}
              </div>

              <div className="bg-bq-track border-2 border-bq-ink rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${energyPct}%`,
                    background: '#FFC93C',
                  }}
                />
              </div>
            </div>

            {/* 3-mini stats row — internal grid w/ desktop dividers. */}
            <div className="grid grid-cols-3" data-testid="ranked-today-progress">
              {/* Streak */}
              <div
                data-testid="ranked-streak-card"
                className="px-3 md:px-4 py-4 md:py-[18px] text-center border-r border-bq-hair"
              >
                <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-bq-ink3 mb-2">
                  {t('ranked.streakHeader')}
                </div>
                <div className="mb-1">
                  <span
                    className="material-symbols-outlined text-[17px] text-bq-ember"
                    style={FILL_1}
                  >
                    local_fire_department
                  </span>
                </div>
                <div className="text-[22px] md:text-[24px] font-extrabold leading-none tracking-tight text-bq-ember">
                  <span data-testid="ranked-streak-count">{streak}</span>
                  <span className="text-bq-ink3 text-[13px] font-semibold ml-1">
                    {t('ranked.streakDaysShort', 'ngày')}
                  </span>
                </div>
                <div className="hidden md:block text-[11px] text-bq-ink3 mt-1.5">
                  {streak > 0 ? t('ranked.streakKeepGoing') : t('ranked.streakBadgeHint')}
                </div>
              </div>

              {/* Câu hôm nay */}
              <div
                data-testid="ranked-questions-card"
                className="px-3 md:px-4 py-4 md:py-[18px] text-center border-r border-bq-hair"
              >
                <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-bq-ink3 mb-2">
                  {t('ranked.questionsTodayShort')}
                </div>
                <div className="mb-1">
                  <span className="material-symbols-outlined text-[17px] text-bq-ink2">quiz</span>
                </div>
                <div className="text-[22px] md:text-[24px] font-extrabold leading-none tracking-tight text-bq-ink">
                  <span data-testid="ranked-questions-counted">{questionsAnswered}</span>
                  <span className="text-bq-ink3 text-[13px] font-semibold ml-1">
                    / {questionsCap}
                  </span>
                </div>
                <div className="hidden md:block text-[11px] text-bq-ink3 mt-1.5">
                  {t('ranked.capPerDay', { count: questionsCap })}
                </div>
              </div>

              {/* Điểm hôm nay */}
              <div
                data-testid="ranked-points-card"
                className="px-3 md:px-4 py-4 md:py-[18px] text-center"
              >
                <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-bq-ink3 mb-2">
                  {t('ranked.pointsTodayShort')}
                </div>
                <div className="mb-1">
                  <span className="material-symbols-outlined text-[17px] text-bq-ink2">military_tech</span>
                </div>
                <div
                  data-testid="ranked-points-today"
                  className="text-[22px] md:text-[24px] font-extrabold leading-none tracking-tight text-bq-ink"
                >
                  {pointsToday}
                </div>
                <div className="hidden md:block text-[11px] text-bq-ink3 mt-1.5">
                  {t('ranked.pointsCountsToSeason', 'Cộng vào điểm mùa')}
                </div>
              </div>
            </div>
          </section>

          {/* ─── Action card (md+) ─────────────────────────────────── */}
          <section
            data-testid="ranked-action-card"
            className="hidden md:flex flex-col relative overflow-hidden rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-rub p-6 md:p-7"
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(50% 70% at 80% 10%, rgba(179,69,47,0.12), transparent 60%)',
              }}
            />
            <div className="relative z-10 flex flex-col h-full">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.8px] text-bq-ruby">
                <span className="w-4 h-px bg-bq-ruby" />
                {t('ranked.actionEyebrow', 'Bắt đầu trận đấu')}
              </div>
              <h2 className="font-display text-[20px] font-extrabold mt-2.5 leading-snug tracking-tight text-bq-ink">
                {t('ranked.actionTitleLeading', 'Sẵn sàng')}{' '}
                <span className="font-headline italic font-semibold text-bq-ruby">
                  {t('ranked.actionTitleAccent', 'leo hạng')}
                </span>
                ?
              </h2>
              <p className="text-[12px] text-bq-ink2 mt-2 leading-relaxed">
                {t('ranked.energyExplainer')}
              </p>

              <button
                data-testid="ranked-start-btn-desktop"
                onClick={canPlay ? startRankedQuiz : undefined}
                disabled={!canPlay}
                className="mt-auto pt-4 group"
              >
                <div
                  className={`flex items-center justify-center gap-2 rounded-[13px] py-4 px-6 font-bold text-[15px] transition-transform ${
                    canPlay
                      ? 'bg-bq-action text-bq-ink shadow-bq-action hover:-translate-y-0.5 active:translate-y-0'
                      : 'bg-bq-inset border border-bq-hair text-bq-ink3 cursor-not-allowed opacity-70'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]" style={FILL_1}>play_arrow</span>
                  {canPlay
                    ? t('ranked.ctaPlayMain')
                    : capReached
                      ? t('ranked.ctaCapMain')
                      : t('ranked.ctaNoEnergyMain')}
                </div>
                <div className="text-center text-[11px] text-bq-ink3 mt-2.5">
                  {canPlay
                    ? t('ranked.ctaPlaySub', { count: questionsLeftFromEnergy })
                    : capReached
                      ? t('ranked.ctaCapSub', { time: resetTimeLeft })
                      : t('ranked.ctaNoEnergySub', { time: resetTimeLeft })}
                </div>
              </button>
            </div>
          </section>
        </div>

        {/* LBF-12 (2026-06-18): SeasonCard hidden for early launch — it exposed
            weak season numbers ("Hạng mùa #N / Điểm mùa N / còn X đến 1000đ")
            + advertised a ×1.5 bonus + "Vinh Quang Mùa" badge that are flag-OFF.
            Component kept at components/ranked/SeasonCard.tsx for re-enable. */}
      </div>

      {/* Mobile sticky CTA — hidden on md+ since the Action card above
          already surfaces the primary CTA inline. */}
      <div className="md:hidden">
        <RankedActionFooter
          canPlay={canPlay}
          capReached={capReached}
          energy={energy}
          resetTimeLeft={resetTimeLeft}
          onStart={startRankedQuiz}
        />
      </div>

      <PoolExhaustedModal
        isOpen={poolExhaustedOpen}
        onClose={() => setPoolExhaustedOpen(false)}
        canUnlockNext={coverage?.currentWeek.canUnlockNext ?? false}
        onUnlockNextWeek={handleUnlockNextWeek}
      />

      {activeBadge && (
        <BadgeAwardModal
          isOpen={badgeModalOpen}
          onClose={handleBadgeClose}
          badge={activeBadge}
        />
      )}
    </main>
  )
}
