import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import MobileBottomTabs from '../layouts/components/MobileBottomTabs'
import WeekCompleteModal from '../components/ranked/WeekCompleteModal'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }
const LETTERS = ['A', 'B', 'C', 'D']

interface Question {
  id: string
  book: string
  chapter: number
  verseStart?: number
  verseEnd?: number
  difficulty: 'easy' | 'medium' | 'hard'
  type: string
  content: string
  options: string[]
  correctAnswer: number[]
  explanation: string
}

interface RankedStats {
  totalScore: number
  correctAnswers: number
  totalQuestions: number
  accuracy: number
  averageTime: number
  totalTime: number
  questions: Question[]
  userAnswers: (number | null)[]
}

interface PreviousTier {
  level: number
  name: string
  totalPoints: number
  nextTierPoints: number
}

interface TierProgressData {
  tierLevel: number
  tierName: string
  totalPoints: number
  nextTierPoints: number
  tierProgressPercent: number
}

interface ActiveSeasonResponse { active: boolean; id?: string; name?: string }
interface MyRankResponse { rank?: number; points?: number }

interface Props {
  stats: RankedStats
  /** Tier snapshot at quiz start — passed via navigate state from Ranked.tsx. */
  previousTier: PreviousTier | null
  /** Energy remaining after the quiz (from the last submitRankedAnswer response). */
  livesRemaining: number
  /** "HH:MM:SS" countdown until next reset. */
  resetTimeLeft: string
  /** sessionId — used as a stable key for share / re-fetch (not currently consumed). */
  sessionId?: string
  /** §7.1.5 — set when this session's final answer completed a Liturgical week. */
  weekCompletion?: { completedWeek: number; nextWeekBooks: string[] } | null
  /** BL-26 B — end-of-match accuracy bonus (null until /match-complete resolves). */
  matchBonus?: { bonusPoints: number; bonusPercent: number; accuracy: number } | null
  onPlayAgain: () => void
  onBackToHome: () => void
}

/**
 * Ranked-only result screen per `docs/mockups/mockup_ranked_result.html`
 * (2026-05-20). Three states surfaced via header + CTA chrome — body
 * (XP hero / tier progress / 3-stat grid / season rank / review wrong)
 * stays consistent so users always see the same scoring breakdown.
 *
 *   A · Normal      — default outcome
 *   B · Promo       — newTier.level > previousTier.level
 *   C · OOE         — livesRemaining <= 0 (energy depleted)
 *
 * Priority: B beats C (tier-up is the rarer + more celebratory event).
 *
 * Non-ranked modes keep using the original `QuizResults.tsx` so
 * Practice / Mystery / Speed pages don't lose their difficulty
 * breakdown affordance.
 */
export default function RankedQuizResults({
  stats,
  previousTier,
  livesRemaining,
  resetTimeLeft,
  weekCompletion,
  matchBonus,
  onPlayAgain,
  onBackToHome,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showReviewModal, setShowReviewModal] = useState(false)

  // §7.1.5 — surface WeekCompleteModal ~800ms after results mount so the
  // user sees their score first (Option B defer-to-results, Bui 2026-05-21).
  const [weekModalOpen, setWeekModalOpen] = useState(false)
  useEffect(() => {
    if (!weekCompletion) return
    const timer = setTimeout(() => setWeekModalOpen(true), 800)
    return () => clearTimeout(timer)
  }, [weekCompletion])

  const handleStartNextWeek = async () => {
    try {
      await api.post('/api/ranked/coverage/unlock-next-week')
    } catch {
      // Non-blocking — user can unlock from the Ranked page instead.
    }
    setWeekModalOpen(false)
    navigate('/ranked')
  }

  // Fresh tier-progress after the quiz — diff vs previousTier tells
  // us whether the last batch crossed a tier boundary. Cache long
  // enough that re-rendering the result screen doesn't refetch.
  const { data: tierData } = useQuery<TierProgressData>({
    queryKey: ['me-tier-progress'],
    queryFn: () => api.get('/api/me/tier-progress').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: activeSeason } = useQuery<ActiveSeasonResponse>({
    queryKey: ['active-season'],
    queryFn: () => api.get('/api/seasons/active').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const seasonId = activeSeason?.active ? activeSeason.id : null
  const { data: myRank } = useQuery<MyRankResponse | null>({
    queryKey: ['season-my-rank', seasonId],
    queryFn: () => api.get(`/api/seasons/${seasonId}/my-rank`).then(r => r.data),
    enabled: !!seasonId,
    staleTime: 60_000,
  })

  const earnedXp = stats.totalScore
  const correctCount = stats.correctAnswers
  const totalQ = stats.totalQuestions
  const accuracyPct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
  const totalSeconds = Math.floor(stats.totalTime / 1000)
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60

  // State decision
  const newLevel = tierData?.tierLevel ?? previousTier?.level ?? 1
  const oldLevel = previousTier?.level ?? newLevel
  const tieredUp = newLevel > oldLevel
  const outOfEnergy = livesRemaining <= 0
  const variant: 'A' | 'B' | 'C' = tieredUp ? 'B' : outOfEnergy ? 'C' : 'A'

  // Current tier — prefer fresh tierData, fall back to previousTier
  // until the post-quiz invalidation lands.
  const currentTierName = tierData?.tierName ?? previousTier?.name ?? ''
  const currentTotalPoints = tierData?.totalPoints ?? previousTier?.totalPoints ?? 0
  const tierTarget = tierData?.nextTierPoints ?? previousTier?.nextTierPoints ?? 1000
  const tierProgressPct = tierData?.tierProgressPercent ?? (
    previousTier && previousTier.nextTierPoints > 0
      ? Math.min(100, (previousTier.totalPoints / previousTier.nextTierPoints) * 100)
      : 0
  )
  const ptsToNext = Math.max(0, tierTarget - currentTotalPoints)

  // Wrong-question derivation from passed stats — no extra fetch.
  const wrongList = useMemo(() => {
    return stats.questions
      .map((q, idx) => ({ q, picked: stats.userAnswers[idx], orderNum: idx + 1 }))
      .filter(({ q, picked }) => {
        if (picked == null || picked < 0) return true
        return !q.correctAnswer.includes(picked)
      })
  }, [stats.questions, stats.userAnswers])
  const wrongCount = wrongList.length

  return (
    <div data-testid="ranked-result-page" className="relative min-h-screen bg-bq-paper text-bq-ink">
      <div className="max-w-md md:max-w-xl mx-auto px-4 pt-5 pb-[180px]">

        {/* Top context bar */}
        <div className="flex items-center justify-between text-[11px] text-bq-ink3 pb-3.5 px-1">
          <div className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">military_tech</span>
            {t('ranked.result.topContext', 'Kết quả Đấu Hạng')}
          </div>
          <button
            type="button"
            onClick={onBackToHome}
            aria-label={t('common.close')}
            className="w-[30px] h-[30px] rounded-full bg-bq-inset text-bq-ink2 grid place-items-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Header — A / B / C variants */}
        {variant === 'A' && (
          <div className="text-center mb-5 px-3">
            <div className="text-[10px] font-bold tracking-[2px] uppercase text-bq-ink3">
              {t('ranked.result.eyebrowDone', 'Trận đã xong')}
            </div>
            <div className="font-display font-semibold text-bq-amberd text-[28px] md:text-[34px] leading-tight mt-2">
              {accuracyPct >= 80
                ? t('ranked.result.titleHigh', 'Vững vàng!')
                : accuracyPct >= 50
                  ? t('ranked.result.titleMid', 'Đang tiến bộ')
                  : t('ranked.result.titleLow', 'Tiếp tục bền bỉ')}
            </div>
            <p className="text-[13px] text-bq-ink2 mt-2 leading-relaxed">
              {t('ranked.result.subA', {
                correct: correctCount,
                total: totalQ,
                mm,
                ss: String(ss).padStart(2, '0'),
                defaultValue: 'Bạn đúng {{correct}}/{{total}} câu trong {{mm}}\'{{ss}}\'\'. Mỗi lần học là một bước.',
              })}
            </p>
          </div>
        )}

        {variant === 'B' && (
          <div
            className="relative overflow-hidden text-center mb-5 px-4 py-6 rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-amb"
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(50% 70% at 50% 0%, rgba(245,158,11,0.16), transparent 70%)' }}
            />
            <div className="relative z-10">
              <div className="text-[10px] font-extrabold uppercase tracking-[2.5px] text-bq-amberd">
                {t('ranked.result.eyebrowTierUp', 'Lên hạng')}
              </div>
              <div
                className="mx-auto mt-3.5 w-[60px] h-[60px] rounded-full grid place-items-center text-bq-amberd"
                style={{ background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.36)' }}
              >
                <span className="material-symbols-outlined text-[34px]" style={FILL_1}>workspace_premium</span>
              </div>
              <div className="font-display font-bold text-bq-amberd text-[28px] md:text-[30px] leading-tight mt-2.5">
                {currentTierName}
              </div>
              <p className="text-[13px] text-bq-ink2 mt-2 leading-relaxed">
                {t('ranked.result.subB', { from: previousTier?.name ?? '', defaultValue: 'Bạn vừa lên hạng từ {{from}} — tiếp tục mở khoá đặc quyền mới.' })}
              </p>
            </div>
          </div>
        )}

        {variant === 'C' && (
          <div className="text-center mb-5 px-4 py-5 rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-soft">
            <div className="mx-auto mb-3 w-[54px] h-[54px] rounded-full bg-bq-inset border border-bq-hair grid place-items-center text-bq-ink3">
              <span className="material-symbols-outlined text-[30px]">bolt</span>
            </div>
            <div className="text-[18px] md:text-[19px] font-bold tracking-tight text-bq-ink">
              {t('ranked.result.titleOOE', 'Hết năng lượng hôm nay')}
            </div>
            <p className="text-[13px] text-bq-ink2 mt-2 leading-relaxed">
              {t('ranked.result.subC', 'Bạn đã dùng hết 100 năng lượng. Quay lại sau khi phục hồi để tiếp tục leo hạng.')}
            </p>
            <div
              className="inline-flex items-center gap-1.5 mt-3.5 px-3.5 py-2 rounded-full text-[13px] font-bold text-bq-amberd tabular-nums border border-bq-hair bg-bq-inset"
            >
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              {t('ranked.energyRecoverIn', { time: resetTimeLeft })}
            </div>
          </div>
        )}

        {/* Result card */}
        <section
          className="relative rounded-[22px] border border-bq-hair bg-bq-white shadow-bq-rub overflow-hidden mb-3.5"
        >
          {/* Signature spectrum top strip */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-bq-spectrum" />

          {/* XP hero */}
          <div className="relative text-center px-5 pt-5 pb-5 border-b border-bq-hair">
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(80% 100% at 50% 0%, rgba(245,158,11,0.08), transparent 65%)' }}
            />
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-[1.8px] text-bq-ink3">
                {t('ranked.result.xpLabel', 'Bạn nhận được')}
              </div>
              <div className="inline-flex items-baseline gap-1 mt-2.5">
                <span className="text-bq-amberd text-[28px] md:text-[30px] font-bold leading-none">+</span>
                <span
                  data-testid="ranked-result-xp"
                  className="font-display text-bq-ink text-[56px] md:text-[64px] font-extrabold leading-[0.9] tracking-tight tabular-nums"
                >
                  {earnedXp}
                </span>
                <span className="text-bq-ink3 text-[18px] font-semibold ml-1">XP</span>
              </div>
              <p className="text-[12px] text-bq-ink2 mt-2">
                {variant === 'B'
                  ? t('ranked.result.xpDetailTierUp', 'Vượt ngưỡng — chính thức lên hạng!')
                  : t('ranked.result.xpDetailDefault', 'Tính theo thời gian & độ khó mỗi câu đúng')}
              </p>
              {matchBonus && matchBonus.bonusPoints > 0 && (
                <div
                  data-testid="ranked-result-accuracy-bonus"
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-[12px] font-bold text-bq-amberd"
                  style={{ background: 'rgba(245,158,11,0.12)' }}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden>target</span>
                  {t('ranked.result.accuracyBonus', {
                    defaultValue: 'Thưởng chính xác {{pct}}%: +{{pts}} XP',
                    pct: matchBonus.bonusPercent,
                    pts: matchBonus.bonusPoints,
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tier progress row */}
          <div className="flex items-center gap-3.5 px-5 py-4 border-b border-bq-hair">
            <div
              className="w-[38px] h-[38px] rounded-[11px] grid place-items-center text-bq-amberd shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)' }}
            >
              <span className="material-symbols-outlined text-[20px]" style={FILL_1}>workspace_premium</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <div className={`text-[13px] font-bold tracking-tight ${variant === 'B' ? 'text-bq-amberd' : 'text-bq-ink'}`}>
                  {currentTierName}
                </div>
                <div className="text-[11px] text-bq-ink3 tabular-nums">
                  {currentTotalPoints.toLocaleString('vi-VN')} / {tierTarget.toLocaleString('vi-VN')} XP
                  <span className="text-bq-ink font-semibold"> · {t('ranked.result.stillNeed', { count: ptsToNext.toLocaleString('vi-VN'), defaultValue: 'còn {{count}}' })}</span>
                </div>
              </div>
              <div className="h-1.5 bg-bq-inset rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-bq-flame transition-[width] duration-700"
                  style={{ width: `${Math.min(100, tierProgressPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3-stat grid */}
          <div className="grid grid-cols-3">
            <div className="text-center px-2 py-4 border-r border-bq-hair">
              <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-bq-ink3 mb-2">
                {t('ranked.result.statCorrect', 'Câu đúng')}
              </div>
              <div className="text-[20px] font-extrabold leading-none tabular-nums text-bq-ink">
                {correctCount}<span className="text-bq-ink3 text-[13px] font-semibold ml-0.5">/{totalQ}</span>
              </div>
              <div className="text-[10px] text-bq-ink3 mt-1 font-semibold">
                {t('ranked.result.statAccuracy', { percent: accuracyPct, defaultValue: '{{percent}}% chính xác' })}
              </div>
            </div>
            <div className="text-center px-2 py-4 border-r border-bq-hair">
              <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-bq-ink3 mb-2">
                {t('ranked.result.statSeasonPts', 'Điểm mùa')}
              </div>
              <div className="text-[20px] font-extrabold leading-none text-bq-amberd tabular-nums">
                +{earnedXp}
              </div>
              <div className="text-[10px] text-bq-emerald mt-1 font-semibold">
                {t('ranked.result.statSeasonTotal', { total: (myRank?.points ?? 0).toLocaleString('vi-VN'), defaultValue: 'Tổng: {{total}}' })}
              </div>
            </div>
            <div className="text-center px-2 py-4">
              <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-bq-ink3 mb-2">
                {t('ranked.result.statEnergy', 'Năng lượng')}
              </div>
              <div className="text-[20px] font-extrabold leading-none tabular-nums text-bq-ink">
                {livesRemaining}
              </div>
              <div className="text-[10px] text-bq-ink3 mt-1 font-semibold">
                {t('ranked.result.statEnergyRemain', { count: livesRemaining, defaultValue: 'Còn {{count}}/100' })}
              </div>
            </div>
          </div>
        </section>

        {/* Season rank card */}
        {activeSeason?.active && (
          <div
            className="flex items-center justify-between gap-3 rounded-[18px] border border-bq-hair bg-bq-white shadow-bq-soft px-4 py-3.5 mb-3.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-[34px] h-[34px] rounded-[10px] grid place-items-center text-bq-amberd shrink-0"
                style={{ background: 'rgba(245,158,11,0.10)' }}
              >
                <span className="material-symbols-outlined text-[20px]" style={FILL_1}>emoji_events</span>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold truncate text-bq-ink">{activeSeason.name}</div>
                <div className="text-[11px] text-bq-ink3 mt-0.5">
                  {t('ranked.result.seasonRankUnchanged', 'Hạng mùa không đổi')}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-bq-amberd text-[22px] font-extrabold leading-none tabular-nums">
                {myRank?.rank != null ? `#${myRank.rank}` : '—'}
              </div>
              <div className="text-[11px] text-bq-ink3 mt-0.5">
                {(myRank?.points ?? 0).toLocaleString('vi-VN')} {t('ranked.points')}
              </div>
            </div>
          </div>
        )}

        {/* Review wrong list — top 2 + link. Hidden in State B (verse takes its slot). */}
        {variant !== 'B' && wrongCount > 0 && (
          <div
            className="rounded-[18px] border border-bq-hair bg-bq-white shadow-bq-soft px-4 py-4 mb-3.5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-bold inline-flex items-center gap-1.5 text-bq-ink">
                <span className="material-symbols-outlined text-[18px] text-bq-amberd">school</span>
                {variant === 'C'
                  ? t('ranked.result.reviewTitleOOE', 'Trong khi chờ')
                  : t('ranked.result.reviewTitle', 'Câu bạn đã sai')}
              </div>
              <div className="text-[11px] text-bq-ink3">
                {t('ranked.result.reviewCount', { count: wrongCount, defaultValue: '{{count}} câu' })}
              </div>
            </div>
            <ul className="space-y-2.5">
              {wrongList.slice(0, 2).map(({ q, orderNum }) => (
                <li key={q.id} className="flex items-start gap-2.5 pt-2.5 first:pt-0 border-t border-bq-hair first:border-t-0">
                  <span
                    className="w-[22px] h-[22px] rounded-[7px] grid place-items-center text-[11px] font-bold shrink-0 mt-0.5 text-bq-ruby"
                    style={{ background: 'rgba(224,53,75,0.10)' }}
                  >
                    {orderNum}
                  </span>
                  <div className="text-[12px] text-bq-ink leading-snug line-clamp-2 min-w-0">
                    {q.content}
                    <span className="block text-[10px] text-bq-ink3 mt-0.5">
                      {q.book} {q.chapter}{q.verseStart ? `:${q.verseStart}${q.verseEnd && q.verseEnd !== q.verseStart ? `–${q.verseEnd}` : ''}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="mt-3 pt-3 w-full border-t border-bq-hair text-bq-amberd text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
            >
              {variant === 'C'
                ? t('ranked.result.reviewCTALearn', { count: wrongCount, defaultValue: 'Xem chi tiết & học lại {{count}} câu sai' })
                : t('ranked.result.reviewCTA', { count: wrongCount, defaultValue: 'Xem chi tiết {{count}} câu' })}
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        )}

        {/* Inline verse (State B only) */}
        {variant === 'B' && (
          <div className="text-center px-6 py-4 mb-4">
            <p
              className="font-literata italic font-medium text-[15px] leading-relaxed text-bq-amberd"
            >
              "{t('ranked.result.verseQuote', 'Hãy vui mừng trong sự trông cậy, nhịn nhục trong cơn hoạn nạn, bền lòng mà cầu nguyện.')}"
            </p>
            <p className="text-[11px] text-bq-ink3 mt-2">
              — {t('ranked.result.verseRef', 'Rô-ma 12:12')}
            </p>
          </div>
        )}
      </div>

      {/* Sticky CTAs — gradient fade absolute bottom */}
      <div
        className="fixed left-0 right-0 bottom-0 z-30 px-4 pt-6 pb-[88px] md:pb-6 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(251,250,245,0) 0%, var(--bq-paper) 35%)' }}
      >
        <div className="max-w-md md:max-w-xl mx-auto pointer-events-auto">
          {variant === 'A' && (
            <>
              <button
                type="button"
                data-testid="ranked-result-play-again"
                onClick={onPlayAgain}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] py-4 px-4 font-bold text-[15px] text-bq-ink bg-bq-action shadow-bq-action hover:-translate-y-0.5 active:translate-y-0 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]" style={FILL_1}>replay</span>
                {t('ranked.result.ctaPlayAgain', 'Chơi trận khác')}
              </button>
              <div className="flex gap-2.5 mt-2.5">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[13px] py-3.5 px-3 text-[13px] font-semibold border border-bq-hair text-bq-ink bg-bq-white shadow-bq-soft"
                >
                  <span className="material-symbols-outlined text-[17px]">home</span>
                  {t('ranked.result.ctaHome', 'Trang chủ')}
                </button>
                <Link
                  to="/leaderboard?period=season"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[13px] py-3.5 px-3 text-[13px] font-semibold border border-bq-hair text-bq-ink bg-bq-white shadow-bq-soft"
                >
                  <span className="material-symbols-outlined text-[17px]">leaderboard</span>
                  {t('ranked.result.ctaLeaderboard', 'Bảng xếp hạng')}
                </Link>
              </div>
            </>
          )}

          {variant === 'B' && (
            <>
              <button
                type="button"
                onClick={() => navigate('/help#tiers')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] py-4 px-4 font-bold text-[15px] text-bq-ink bg-bq-action shadow-bq-action hover:-translate-y-0.5 active:translate-y-0 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]" style={FILL_1}>military_tech</span>
                {t('ranked.result.ctaTierPerks', 'Xem đặc quyền hạng mới')}
              </button>
              <div className="flex gap-2.5 mt-2.5">
                <button
                  type="button"
                  data-testid="ranked-result-play-again"
                  onClick={onPlayAgain}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[13px] py-3.5 px-3 text-[13px] font-semibold border border-bq-hair text-bq-ink bg-bq-white shadow-bq-soft"
                >
                  <span className="material-symbols-outlined text-[17px]">replay</span>
                  {t('ranked.result.ctaPlayMore', 'Chơi tiếp')}
                </button>
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[13px] py-3.5 px-3 text-[13px] font-semibold border border-bq-hair text-bq-ink bg-bq-white shadow-bq-soft"
                >
                  <span className="material-symbols-outlined text-[17px]">home</span>
                  {t('ranked.result.ctaHome', 'Trang chủ')}
                </button>
              </div>
            </>
          )}

          {variant === 'C' && (
            <>
              <button
                type="button"
                disabled
                aria-disabled
                className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] py-4 px-4 font-bold text-[15px] text-bq-ink3 bg-bq-inset border border-bq-hair cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">bolt</span>
                {t('ranked.result.ctaOOE', { time: resetTimeLeft, defaultValue: 'Hết năng lượng — chờ {{time}}' })}
              </button>
              <div className="flex gap-2.5 mt-2.5">
                <Link
                  to="/practice"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[13px] py-3.5 px-3 text-[13px] font-semibold border border-bq-hair text-bq-ink bg-bq-white shadow-bq-soft"
                >
                  <span className="material-symbols-outlined text-[17px]">school</span>
                  {t('ranked.result.ctaPractice', 'Luyện tập (miễn phí)')}
                </Link>
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[13px] py-3.5 px-3 text-[13px] font-semibold border border-bq-hair text-bq-ink bg-bq-white shadow-bq-soft"
                >
                  <span className="material-symbols-outlined text-[17px]">home</span>
                  {t('ranked.result.ctaHome', 'Trang chủ')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* /quiz route lives outside AppLayout — render MobileBottomTabs
          here so the bottom nav stays available after a quiz ends.
          The sticky CTA wrap above uses `pb-[88px]` on mobile to leave
          room for both the tabs (~56px) and a small gap. */}
      <MobileBottomTabs />

      {/* Review modal — shows wrong questions only with the correct
          answer revealed + explanation. Mirrors the DailyChallenge
          review modal pattern (DailyChallenge.tsx:728+) but scoped to
          the wrong subset since this is "Xem chi tiết N câu sai" intent
          (2026-05-20 user request — was previously wired to onPlayAgain
          by mistake which restarted the quiz). */}
      {showReviewModal && wrongList.length > 0 && (
        <div
          data-testid="ranked-result-review-modal"
          className="fixed inset-0 z-50 bg-bq-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowReviewModal(false)}
        >
          {/* Modal becomes the scroll container itself (flex-col with
              flex-1 body) so the header is a non-scrolling sibling and
              the × stays reachable as the user scrolls the questions.
              Previous attempt used `sticky top-0` but the outer overlay
              was the actual scroll context — sticky was bounded by the
              card's overflow-hidden box, so the header still scrolled
              away with the card (2026-05-20 user report). */}
          <div
            className="max-w-2xl w-full max-h-[calc(100vh-2rem)] bg-bq-white rounded-2xl border border-bq-hair shadow-bq-soft overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-bq-hair">
              <h3 className="text-lg md:text-xl font-extrabold text-bq-ink flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-bq-amberd flex-shrink-0">school</span>
                <span className="truncate">
                  {t('ranked.result.reviewModalTitle', { count: wrongList.length, defaultValue: '{{count}} câu bạn đã sai' })}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                aria-label={t('common.close')}
                className="w-9 h-9 rounded-lg bg-bq-inset hover:bg-bq-hair grid place-items-center text-bq-ink2 flex-shrink-0 ml-3"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {wrongList.map(({ q, picked, orderNum }) => {
                const correctIdx = q.correctAnswer?.[0] ?? -1
                return (
                  <div key={q.id} className="bg-bq-inset border border-bq-hair rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-bold bg-error/20 text-error">
                          {orderNum}
                        </span>
                        <span className="text-sm font-bold text-bq-ink leading-relaxed">{q.content}</span>
                      </div>
                      <span className="text-[10px] text-bq-ink2 flex-shrink-0 px-2 py-0.5 rounded bg-bq-white border border-bq-hair whitespace-nowrap">
                        {q.book} {q.chapter}{q.verseStart ? `:${q.verseStart}${q.verseEnd && q.verseEnd !== q.verseStart ? `–${q.verseEnd}` : ''}` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mb-3">
                      {q.options.map((opt, i) => {
                        const isCorrect = i === correctIdx
                        const isPicked = picked === i
                        return (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-lg text-xs flex items-start gap-2 border ${
                              isCorrect
                                ? 'bg-bq-emerald/10 border-bq-emerald/30 text-bq-emerald'
                                : isPicked
                                  ? 'bg-error/10 border-error/30 text-error'
                                  : 'bg-bq-white border-bq-hair text-bq-ink2'
                            }`}
                          >
                            <span className="font-bold">{LETTERS[i] ?? String.fromCharCode(65 + i)}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <span className="material-symbols-outlined text-sm">check_circle</span>}
                            {!isCorrect && isPicked && <span className="material-symbols-outlined text-sm">cancel</span>}
                          </div>
                        )
                      })}
                    </div>
                    {q.explanation && (
                      <div className="text-xs text-bq-ink2 leading-relaxed bg-bq-amber/5 border-l-2 border-bq-amber/40 px-3 py-2 rounded">
                        <span className="material-symbols-outlined text-sm align-middle mr-1 text-bq-amberd">lightbulb</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {weekCompletion && (
        <WeekCompleteModal
          isOpen={weekModalOpen}
          onClose={() => setWeekModalOpen(false)}
          completedWeek={weekCompletion.completedWeek}
          nextWeekBooks={weekCompletion.nextWeekBooks}
          onStartNextWeek={handleStartNextWeek}
        />
      )}
    </div>
  )
}
