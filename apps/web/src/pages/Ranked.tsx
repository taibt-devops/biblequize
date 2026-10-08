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
import { Medal, PlaceBackdrop, TrackBar } from '../components/lk/Place'

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
        // No book: the server draws from the whole Bible by tier (2026-10-08).
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
      <div className="relative flex items-center justify-center py-24 px-4">
        <PlaceBackdrop place="arena" veil="strong" />
        <div className="max-w-md w-full p-8 text-center bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
          <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="mx-auto h-32 mb-3" />
          <p className="m-0 mb-2 font-display text-[22px] font-extrabold">{t('ranked.loadError')}</p>
          <p className="m-0 mb-6 font-read text-[15px] text-bq-ink2">{t('ranked.tryAgainLater')}</p>
          <button onClick={refetch} className="lk-btn text-bq-ink text-[16px]">
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
    <main data-testid="ranked-page" className="relative max-w-5xl mx-auto pb-[150px] md:pb-10 text-bq-ink">
      <PlaceBackdrop place="arena" veil="mid" />
      <RankedHeader />

      <div className="space-y-5">
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

        {/* today: energy + three medals | the gate into a match (md+) */}
        <div className="grid grid-cols-1 md:grid-cols-[1.55fr_1fr] gap-5">

          <section
            data-testid="ranked-stats-card"
            className="rounded-bq border-[3px] border-bq-ink bg-bq-white shadow-bq-card overflow-hidden"
          >
            {/* energy */}
            <div className="px-5 md:px-7 pt-5 pb-5 border-b-2 border-dashed border-bq-hair">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <img src="/images/lk/heart.webp" alt="" aria-hidden className="h-7" />
                  <span className="font-display text-[19px] font-extrabold">{t('ranked.energy')}</span>
                </div>
                <div
                  data-testid="ranked-reset-timer"
                  className="px-2.5 py-0.5 bg-bq-cream border-2 border-bq-ink rounded-full text-[12.5px] font-bold tabular-nums"
                >
                  {t('ranked.energyRecoverIn', { time: resetTimeLeft })}
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                <span
                  data-testid="ranked-energy-display"
                  className="font-display text-[44px] md:text-[50px] font-extrabold leading-none tabular-nums [text-shadow:0_.06em_0_#FFC93C]"
                >
                  {energy}
                </span>
                <span className="text-bq-ink3 text-[16px] font-extrabold">/ {energyMax}</span>
                {!isOutOfEnergy && (
                  <span
                    data-testid="ranked-energy-status"
                    className="ml-auto px-3 py-1 bg-bq-leaf border-2 border-bq-ink rounded-full text-[13px] font-extrabold"
                  >
                    ✓ {t('ranked.energyEnoughForNQuestions', { count: questionsLeftFromEnergy })}
                  </span>
                )}
                {isOutOfEnergy && (
                  <span className="ml-auto px-3 py-1 bg-bq-inset border-2 border-bq-ink/40 rounded-full text-[13px] font-extrabold text-bq-ink2">
                    {t('ranked.outOfEnergy')}
                  </span>
                )}
              </div>

              <TrackBar pct={energyPct} fill="bg-bq-ruby" className="h-4" />
            </div>

            {/* streak, questions today, points today */}
            <div className="grid grid-cols-3 px-2 py-5" data-testid="ranked-today-progress">
              <div data-testid="ranked-streak-card" className="flex flex-col items-center text-center px-1">
                <Medal size={58}><img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-9" /></Medal>
                <div className="mt-3 font-display text-[24px] font-extrabold leading-none">
                  <span data-testid="ranked-streak-count">{streak}</span>
                  <span className="text-bq-ink3 text-[13px] font-extrabold ml-1">{t('ranked.streakDaysShort', 'ngày')}</span>
                </div>
                <div className="mt-2 text-[13px] font-extrabold text-bq-ink2 leading-tight">{t('ranked.streakHeader')}</div>
                <div className="hidden md:block mt-1 font-read text-[12.5px] text-bq-ink3">
                  {streak > 0 ? t('ranked.streakKeepGoing') : t('ranked.streakBadgeHint')}
                </div>
              </div>

              <div data-testid="ranked-questions-card" className="flex flex-col items-center text-center px-1">
                <Medal size={58}><img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-9" /></Medal>
                <div className="mt-3 font-display text-[24px] font-extrabold leading-none">
                  <span data-testid="ranked-questions-counted">{questionsAnswered}</span>
                  <span className="text-bq-ink3 text-[13px] font-extrabold ml-1">/ {questionsCap}</span>
                </div>
                <div className="mt-2 text-[13px] font-extrabold text-bq-ink2 leading-tight">{t('ranked.questionsTodayShort')}</div>
                <div className="hidden md:block mt-1 font-read text-[12.5px] text-bq-ink3">
                  {t('ranked.capPerDay', { count: questionsCap })}
                </div>
              </div>

              <div data-testid="ranked-points-card" className="flex flex-col items-center text-center px-1">
                <Medal size={58}><img src="/images/lk/icon-trophy.webp" alt="" aria-hidden className="h-9" /></Medal>
                <div data-testid="ranked-points-today" className="mt-3 font-display text-[24px] font-extrabold leading-none">
                  {pointsToday}
                </div>
                <div className="mt-2 text-[13px] font-extrabold text-bq-ink2 leading-tight">{t('ranked.pointsTodayShort')}</div>
                <div className="hidden md:block mt-1 font-read text-[12.5px] text-bq-ink3">
                  {t('ranked.pointsCountsToSeason', 'Cộng vào điểm mùa')}
                </div>
              </div>
            </div>
          </section>

          {/* the gate into a match (md+); phones use the sticky footer */}
          <section
            data-testid="ranked-action-card"
            className="hidden md:flex flex-col items-center text-center rounded-bq border-[3px] border-bq-ink bg-bq-cream shadow-bq-card p-6"
          >
            <img src={canPlay ? '/images/lk/hero.webp' : '/images/lk/hero-rest.webp'} alt="" aria-hidden className="h-[110px]" />
            <h2 className="m-0 mt-2 font-display text-[24px] font-extrabold leading-snug">
              {t('ranked.actionTitleLeading', 'Sẵn sàng')} {t('ranked.actionTitleAccent', 'leo hạng')}?
            </h2>
            <p className="m-0 mt-1.5 font-read text-[14px] text-bq-ink2 leading-relaxed">
              {t('ranked.energyExplainer')}
            </p>
            <div className="mt-auto pt-5 w-full">
              <button
                data-testid="ranked-start-btn-desktop"
                onClick={canPlay ? startRankedQuiz : undefined}
                disabled={!canPlay}
                className={`lk-btn w-full text-[17px] ${canPlay ? 'text-bq-ink' : '!bg-bq-inset text-bq-ink2'}`}
              >
                {canPlay && <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-6" />}
                {canPlay
                  ? t('ranked.ctaPlayMain')
                  : capReached
                    ? t('ranked.ctaCapMain')
                    : t('ranked.ctaNoEnergyMain')}
              </button>
              <p className="m-0 mt-2.5 text-[13px] font-bold text-bq-ink2">
                {canPlay
                  ? t('ranked.ctaPlaySub', { count: questionsLeftFromEnergy })
                  : capReached
                    ? t('ranked.ctaCapSub', { time: resetTimeLeft })
                    : t('ranked.ctaNoEnergySub', { time: resetTimeLeft })}
              </p>
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
