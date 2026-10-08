import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import MobileBottomTabs from '../layouts/components/MobileBottomTabs'
import WeekCompleteModal from '../components/ranked/WeekCompleteModal'
import { Medal, PlaceBackdrop, ScrollPanel, TrackBar, lkClass } from '../components/lk/Place'
import { useBookName } from '../hooks/useBookName'

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
  const getBookName = useBookName()
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

  const ref = (q: Question) =>
    `${getBookName(q.book)} ${q.chapter}${q.verseStart ? `:${q.verseStart}${q.verseEnd && q.verseEnd !== q.verseStart ? `–${q.verseEnd}` : ''}` : ''}`
  const tierImg = `/images/lk/tier-${Math.min(6, Math.max(1, newLevel))}.webp`
  const btnGold = 'lk-btn w-full text-bq-ink text-[17px]'
  const btnLeaf = 'lk-btn lk-btn-2 flex-1 text-bq-ink text-[15px]'
  const btnPaper = 'lk-btn flex-1 !bg-bq-white text-bq-ink text-[15px]'
  const medalLabel = 'mt-3 text-[12.5px] md:text-[13px] font-extrabold text-bq-ink2 text-center leading-tight'

  // Ranked result on the tournament field (LKF-5b). A = normal, B = tier up, C = out of energy.
  return (
    <div data-testid="ranked-result-page" className="relative min-h-screen text-bq-ink">
      <PlaceBackdrop place="arena" veil="mid" />
      <div className="relative max-w-[600px] mx-auto px-4 pt-5 pb-[210px]">

        <div className="flex items-center justify-between pb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-full text-[13px] font-extrabold">
            <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-5" />
            {t('ranked.result.topContext', 'Kết quả Đấu Hạng')}
          </span>
          <button
            type="button"
            onClick={onBackToHome}
            aria-label={t('common.close')}
            className="w-11 h-11 grid place-items-center bg-bq-white border-[3px] border-bq-ink rounded-[14px] shadow-[0_4px_0_#1D2B22] active:translate-y-1 active:shadow-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="#1D2B22" strokeWidth="3.2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <ScrollPanel bodyClassName="relative px-5 md:px-8 pt-5 pb-6 text-center">
          {variant === 'A' && (
            <>
              <img src={accuracyPct >= 50 ? '/images/lk/hero-cheer.webp' : '/images/lk/hero.webp'} alt="" aria-hidden className={`h-[96px] mx-auto ${lkClass.bob}`} />
              <h1 className="font-display font-extrabold text-bq-amberd text-[30px] md:text-[36px] leading-tight mt-1">
                {accuracyPct >= 80
                  ? t('ranked.result.titleHigh', 'Vững vàng!')
                  : accuracyPct >= 50
                    ? t('ranked.result.titleMid', 'Đang tiến bộ')
                    : t('ranked.result.titleLow', 'Tiếp tục bền bỉ')}
              </h1>
              <p className="font-read text-[14px] text-bq-ink2 mt-1 leading-relaxed">
                {t('ranked.result.subA', {
                  correct: correctCount,
                  total: totalQ,
                  mm,
                  ss: String(ss).padStart(2, '0'),
                  defaultValue: 'Bạn đúng {{correct}}/{{total}} câu trong {{mm}}\'{{ss}}\'\'. Mỗi lần học là một bước.',
                })}
              </p>
            </>
          )}
          {variant === 'B' && (
            <>
              <span className="block text-[14px] font-extrabold text-bq-amberd">{t('ranked.result.eyebrowTierUp', 'Lên hạng')}</span>
              <div className="relative mx-auto mt-1 w-[120px] h-[120px] grid place-items-center">
                <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,214,90,.9)_0,rgba(255,214,90,0)_70%)] motion-safe:animate-pulse" />
                <img src={tierImg} alt="" aria-hidden className={`relative w-[104px] ${lkClass.star}`} />
              </div>
              <h1 className="font-display font-extrabold text-bq-amberd text-[30px] md:text-[34px] leading-tight">{currentTierName}</h1>
              <p className="font-read text-[14px] text-bq-ink2 mt-1 leading-relaxed">
                {t('ranked.result.subB', { from: previousTier?.name ?? '', defaultValue: 'Bạn vừa lên hạng từ {{from}} — tiếp tục mở khoá đặc quyền mới.' })}
              </p>
            </>
          )}
          {variant === 'C' && (
            <>
              <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="h-[100px] mx-auto" />
              <h1 className="font-display font-extrabold text-[24px] md:text-[28px] leading-tight mt-1">{t('ranked.result.titleOOE', 'Hết năng lượng hôm nay')}</h1>
              <p className="font-read text-[14px] text-bq-ink2 mt-1 leading-relaxed">
                {t('ranked.result.subC', 'Bạn đã dùng hết 100 năng lượng. Quay lại sau khi phục hồi để tiếp tục leo hạng.')}
              </p>
              <span className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-1 rounded-full bg-bq-cream border-2 border-bq-ink text-[14px] font-extrabold tabular-nums">
                <img src="/images/lk/heart.webp" alt="" aria-hidden className="h-5" />
                {t('ranked.energyRecoverIn', { time: resetTimeLeft })}
              </span>
            </>
          )}

          {/* XP earned */}
          <div className="mt-5 pt-4 border-t-2 border-dashed border-bq-hair">
            <span className="block text-[13px] font-bold text-bq-ink3">{t('ranked.result.xpLabel', 'Bạn nhận được')}</span>
            <span className="inline-flex items-baseline gap-1 mt-1">
              <span className="text-bq-amberd text-[30px] font-extrabold leading-none">+</span>
              <span data-testid="ranked-result-xp" className="font-display text-[60px] md:text-[68px] font-extrabold leading-[0.9] tabular-nums text-bq-ink [text-shadow:0_.06em_0_#FFC93C]">
                {earnedXp}
              </span>
              <span className="text-bq-ink3 text-[18px] font-extrabold ml-1">XP</span>
            </span>
            <p className="font-read text-[13px] text-bq-ink2 mt-1.5">
              {variant === 'B'
                ? t('ranked.result.xpDetailTierUp', 'Vượt ngưỡng — chính thức lên hạng!')
                : t('ranked.result.xpDetailDefault', 'Tính theo thời gian & độ khó mỗi câu đúng')}
            </p>
            {matchBonus && matchBonus.bonusPoints > 0 && (
              <span data-testid="ranked-result-accuracy-bonus" className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-bq-amber border-2 border-bq-ink text-[13px] font-extrabold">
                {t('ranked.result.accuracyBonus', {
                  defaultValue: 'Thưởng chính xác {{pct}}%: +{{pts}} XP',
                  pct: matchBonus.bonusPercent,
                  pts: matchBonus.bonusPoints,
                })}
              </span>
            )}
          </div>

          {/* tier progress */}
          <div className="mt-4 flex items-center gap-3 text-left">
            <img src={tierImg} alt="" aria-hidden className="w-12 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className={`text-[15px] font-extrabold truncate ${variant === 'B' ? 'text-bq-amberd' : ''}`}>{currentTierName}</span>
                <span className="text-[12px] font-bold text-bq-ink3 tabular-nums whitespace-nowrap">
                  {currentTotalPoints.toLocaleString('vi-VN')} / {tierTarget.toLocaleString('vi-VN')} XP
                </span>
              </div>
              <TrackBar pct={tierProgressPct} className="h-3.5" />
              <span className="block mt-1 text-[12px] font-bold text-bq-ink2">
                {t('ranked.result.stillNeed', { count: ptsToNext.toLocaleString('vi-VN'), defaultValue: 'còn {{count}}' })}
              </span>
            </div>
          </div>

          {/* three medals */}
          <div className="mt-5 flex justify-center gap-6 md:gap-9">
            <div className="flex flex-col items-center">
              <Medal size={74}>
                <span className="font-display text-[21px] font-extrabold tabular-nums leading-none">
                  {correctCount}<span className="text-bq-ink3 text-[0.68em]">/{totalQ}</span>
                </span>
              </Medal>
              <span className={medalLabel}>
                {t('ranked.result.statCorrect', 'Câu đúng')}<br />
                <span className="font-bold text-bq-ink3">{t('ranked.result.statAccuracy', { percent: accuracyPct, defaultValue: '{{percent}}% chính xác' })}</span>
              </span>
            </div>
            <div className="flex flex-col items-center">
              <Medal size={74} className="!bg-bq-cream">
                <span className="font-display text-[20px] font-extrabold tabular-nums leading-none text-bq-amberd">+{earnedXp}</span>
              </Medal>
              <span className={medalLabel}>
                {t('ranked.result.statSeasonPts', 'Điểm mùa')}<br />
                <span className="font-bold text-bq-emerald">{t('ranked.result.statSeasonTotal', { total: (myRank?.points ?? 0).toLocaleString('vi-VN'), defaultValue: 'Tổng: {{total}}' })}</span>
              </span>
            </div>
            <div className="flex flex-col items-center">
              <Medal size={74}>
                <span className="flex flex-col items-center leading-none">
                  <img src="/images/lk/heart.webp" alt="" aria-hidden className="h-5 mb-0.5" />
                  <span className="font-display text-[18px] font-extrabold tabular-nums">{livesRemaining}</span>
                </span>
              </Medal>
              <span className={medalLabel}>
                {t('ranked.result.statEnergy', 'Năng lượng')}<br />
                <span className="font-bold text-bq-ink3">{t('ranked.result.statEnergyRemain', { count: livesRemaining, defaultValue: 'Còn {{count}}/100' })}</span>
              </span>
            </div>
          </div>

          {variant === 'B' && (
            <p className="mt-5 pt-4 border-t-2 border-dashed border-bq-hair font-read italic text-[15px] leading-relaxed text-bq-amberd">
              "{t('ranked.result.verseQuote', 'Hãy vui mừng trong sự trông cậy, nhịn nhục trong cơn hoạn nạn, bền lòng mà cầu nguyện.')}"
              <span className="block not-italic text-[12px] font-bold text-bq-ink3 mt-1">— {t('ranked.result.verseRef', 'Rô-ma 12:12')}</span>
            </p>
          )}
        </ScrollPanel>

        {/* season rank */}
        {activeSeason?.active && (
          <div className="mt-5 flex items-center justify-between gap-3 bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/images/lk/icon-trophy.webp" alt="" aria-hidden className="h-10 shrink-0" />
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold truncate">{activeSeason.name}</div>
                <div className="text-[12px] font-bold text-bq-ink3">{t('ranked.result.seasonRankUnchanged', 'Hạng mùa không đổi')}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-[24px] font-extrabold leading-none tabular-nums text-bq-amberd">{myRank?.rank != null ? `#${myRank.rank}` : '—'}</div>
              <div className="text-[12px] font-bold text-bq-ink3">{(myRank?.points ?? 0).toLocaleString('vi-VN')} {t('ranked.points')}</div>
            </div>
          </div>
        )}

        {/* wrong answers to review (hidden on tier-up) */}
        {variant !== 'B' && wrongCount > 0 && (
          <div className="mt-4 bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card px-4 py-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-2 text-[16px] font-extrabold">
                <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-6" />
                {variant === 'C' ? t('ranked.result.reviewTitleOOE', 'Trong khi chờ') : t('ranked.result.reviewTitle', 'Câu bạn đã sai')}
              </span>
              <span className="text-[13px] font-bold text-bq-ink3">{t('ranked.result.reviewCount', { count: wrongCount, defaultValue: '{{count}} câu' })}</span>
            </div>
            <ul>
              {wrongList.slice(0, 2).map(({ q, orderNum }) => (
                <li key={q.id} className="flex items-start gap-2.5 py-2.5 border-t-2 border-dashed border-bq-hair first:border-t-0 first:pt-0">
                  <span className="w-7 h-7 rounded-full grid place-items-center text-[13px] font-extrabold shrink-0 bg-bq-cream border-2 border-bq-ink text-bq-ruby">{orderNum}</span>
                  <span className="min-w-0 font-read text-[14px] leading-snug">
                    <span className="line-clamp-2">{q.content}</span>
                    <span className="block text-[12px] font-bold text-bq-ink3 mt-0.5">{ref(q)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="mt-2 w-full lk-btn lk-btn-2 text-bq-ink text-[15px]"
            >
              {variant === 'C'
                ? t('ranked.result.reviewCTALearn', { count: wrongCount, defaultValue: 'Xem chi tiết & học lại {{count}} câu sai' })
                : t('ranked.result.reviewCTA', { count: wrongCount, defaultValue: 'Xem chi tiết {{count}} câu' })}
            </button>
          </div>
        )}
      </div>

      {/* sticky actions over a fade to the field */}
      <div className="fixed left-0 right-0 bottom-0 z-30 px-4 pt-8 pb-[92px] md:pb-6 pointer-events-none bg-[linear-gradient(180deg,rgba(239,227,195,0)_0%,rgba(239,227,195,.92)_38%)]">
        <div className="max-w-[600px] mx-auto pointer-events-auto">
          {variant === 'A' && (
            <>
              <button type="button" data-testid="ranked-result-play-again" onClick={onPlayAgain} className={btnGold}>
                {t('ranked.result.ctaPlayAgain', 'Chơi trận khác')}
              </button>
              <div className="flex gap-3 mt-3">
                <button type="button" onClick={onBackToHome} className={btnPaper}>{t('ranked.result.ctaHome', 'Trang chủ')}</button>
                <Link to="/leaderboard?period=season" className={btnLeaf}>{t('ranked.result.ctaLeaderboard', 'Bảng xếp hạng')}</Link>
              </div>
            </>
          )}
          {variant === 'B' && (
            <>
              <button type="button" onClick={() => navigate('/help#tiers')} className={btnGold}>
                {t('ranked.result.ctaTierPerks', 'Xem đặc quyền hạng mới')}
              </button>
              <div className="flex gap-3 mt-3">
                <button type="button" data-testid="ranked-result-play-again" onClick={onPlayAgain} className={btnLeaf}>{t('ranked.result.ctaPlayMore', 'Chơi tiếp')}</button>
                <button type="button" onClick={onBackToHome} className={btnPaper}>{t('ranked.result.ctaHome', 'Trang chủ')}</button>
              </div>
            </>
          )}
          {variant === 'C' && (
            <>
              <button type="button" disabled aria-disabled className="lk-btn w-full !bg-bq-track text-bq-ink3 text-[16px]">
                {t('ranked.result.ctaOOE', { time: resetTimeLeft, defaultValue: 'Hết năng lượng — chờ {{time}}' })}
              </button>
              <div className="flex gap-3 mt-3">
                <Link to="/practice" className={btnLeaf}>{t('ranked.result.ctaPractice', 'Luyện tập (miễn phí)')}</Link>
                <button type="button" onClick={onBackToHome} className={btnPaper}>{t('ranked.result.ctaHome', 'Trang chủ')}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* /quiz lives outside AppLayout — bring the bottom tabs back on phones after the match. */}
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
          className="fixed inset-0 z-50 bg-bq-ink/45 flex items-center justify-center p-4"
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
            className="max-w-2xl w-full max-h-[calc(100vh-2rem)] bg-bq-white rounded-bq border-[3px] border-bq-ink shadow-bq-card overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b-[3px] border-bq-ink bg-bq-cream">
              <h3 className="text-lg md:text-xl font-extrabold text-bq-ink flex items-center gap-2 min-w-0">
                <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-7 flex-shrink-0" />
                <span className="truncate">
                  {t('ranked.result.reviewModalTitle', { count: wrongList.length, defaultValue: '{{count}} câu bạn đã sai' })}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                aria-label={t('common.close')}
                className="w-10 h-10 rounded-full bg-bq-white border-2 border-bq-ink hover:bg-bq-cream grid place-items-center text-bq-ink flex-shrink-0 ml-3"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {wrongList.map(({ q, picked, orderNum }) => {
                const correctIdx = q.correctAnswer?.[0] ?? -1
                return (
                  <div key={q.id} className="bg-bq-parch border-2 border-bq-ink rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold bg-bq-white border-2 border-bq-ink text-bq-ruby">
                          {orderNum}
                        </span>
                        <span className="text-sm font-bold text-bq-ink leading-relaxed">{q.content}</span>
                      </div>
                      <span className="text-[10px] text-bq-ink2 flex-shrink-0 px-2 py-0.5 rounded bg-bq-white border border-bq-hair whitespace-nowrap">
                        {ref(q)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 mb-3">
                      {q.options.map((opt, i) => {
                        const isCorrect = i === correctIdx
                        const isPicked = picked === i
                        return (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-xl text-[13px] flex items-start gap-2 border-2 ${
                              isCorrect
                                ? 'bg-bq-leaf border-bq-emerald text-bq-ink font-bold'
                                : isPicked
                                  ? 'bg-bq-white border-bq-ruby text-bq-ruby'
                                  : 'bg-bq-white border-bq-hair text-bq-ink2'
                            }`}
                          >
                            <span className="font-bold">{LETTERS[i] ?? String.fromCharCode(65 + i)}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <span aria-hidden className="font-extrabold text-bq-emerald">✓</span>}
                            {!isCorrect && isPicked && <span aria-hidden className="font-extrabold">✗</span>}
                          </div>
                        )
                      })}
                    </div>
                    {q.explanation && (
                      <p className="font-read text-[13px] text-bq-ink2 leading-relaxed bg-bq-white border-2 border-bq-hair px-3 py-2 rounded-xl">
                        {q.explanation}
                      </p>
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
