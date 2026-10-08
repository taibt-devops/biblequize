import { useTranslation } from 'react-i18next'
import { Medal, lkClass } from '../../components/lk/Place'

interface YesterdaySummary {
  completed: boolean
  correctCount?: number
  totalQuestions?: number
  timeSeconds?: number
}

interface DoneSummary {
  correctCount: number
  totalQuestions: number
  score: number
  xpEarned: number
  betterThanPercent?: number
  completedAt?: string
  timeSeconds?: number
  rankGlobal?: number
  resultsBreakdown?: boolean[]
}

interface HeroCardProps {
  state: 'ready' | 'done'
  // Ready state inputs
  questionCount: number
  timeLimit: number
  yesterday?: YesterdaySummary
  onStart: () => void
  // Done state inputs
  done?: DoneSummary
  onReview: () => void
  onShare: () => void
  onDownload: () => void
}

function formatTime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Today's challenge as the letter the dove brought (LKF-10). Ready: a sealed letter with a
 * postmark, the dove, what's inside and the reward. Done: the opened letter with the tally on
 * the left and the score medal, rank and share on the right.
 */
export function HeroCard(props: HeroCardProps) {
  const now = new Date()
  const postmark = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <section className="relative mb-7 rounded-bq border-[3px] border-bq-ink bg-[#FFF8E7] shadow-bq-card overflow-hidden">
      {/* airmail edge */}
      <div aria-hidden className="h-2.5 border-b-[3px] border-bq-ink bg-[repeating-linear-gradient(135deg,#B3452F_0_14px,#FFF8E7_14px_24px,#2F6FB0_24px_38px,#FFF8E7_38px_48px)]" />
      {/* postmark (sealed letter only; the opened one shows the score medal there) */}
      {props.state === 'ready' && <div aria-hidden className="absolute right-4 top-6 md:right-7 md:top-7 w-[74px] h-[74px] md:w-[88px] md:h-[88px] rotate-[14deg] rounded-full border-[3px] border-dashed border-bq-ruby/70 text-bq-ruby/80 grid place-items-center text-center leading-tight">
        <span className="text-[11px] md:text-[12px] font-extrabold">
          BibleQuiz<br /><span className="text-[17px] md:text-[20px]">{postmark}</span>
        </span>
      </div>}
      <div className={`relative grid grid-cols-1 ${props.state === 'done' ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
        <div className={`p-6 md:p-8 ${props.state === 'done' ? 'lg:border-r-[3px] lg:border-dashed lg:border-bq-ink/25' : ''}`}>
          {props.state === 'ready' ? <ReadyLeft {...props} /> : <DoneLeft {...props} />}
        </div>
        {props.state === 'done' && (
          <div className="p-6 md:p-8 bg-bq-cream/60 border-t-[3px] border-dashed border-bq-ink/25 lg:border-t-0">
            <DoneRight {...props} />
          </div>
        )}
      </div>
    </section>
  )
}

function ReadyLeft({ questionCount, timeLimit, yesterday, onStart }: HeroCardProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-5 md:gap-8">
      <img src="/images/lk/dove-letter.webp" alt="" aria-hidden className={`w-[120px] md:w-[170px] shrink-0 self-center ${lkClass.bob}`} />
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink text-[13px] font-extrabold mb-3">
          <span className="w-2 h-2 rounded-full bg-bq-emerald animate-pulse-ring-green" />
          {t('daily.ready.statusBadge')}
        </span>
        <h2 className="m-0 mb-2 pr-20 font-display text-[28px] md:text-[34px] font-extrabold leading-tight text-bq-ink">
          {t('daily.ready.titleLead', { count: questionCount })} {t('daily.ready.titleAccent')}
        </h2>
        <p className="m-0 mb-5 font-read italic text-[15px] md:text-[16px] leading-relaxed text-bq-ink2">
          &ldquo;{t('daily.ready.desc')}&rdquo;
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          <MetaItem icon="quiz" text={t('daily.ready.metaQuestions', { count: questionCount })} />
          <MetaItem icon="timer" text={t('daily.ready.metaTime', { minutes: timeLimit })} />
          <MetaItem icon="public" text={t('daily.ready.metaGlobal')} />
          <MetaItem icon="favorite" text={t('daily.ready.metaNoEnergy')} />
        </div>
        <div className="flex items-center gap-3.5 mb-6">
          <Medal size={50}><span className="text-[24px] leading-none" style={{ color: '#FFC93C', WebkitTextStroke: '1.5px #1D2B22' }}>★</span></Medal>
          <div>
            <div className="text-[13px] font-bold text-bq-ink3">{t('daily.ready.rewardLabel')}</div>
            <div className="text-[15px] font-bold text-bq-ink">
              <strong className="font-extrabold">+20 XP</strong> {t('daily.ready.rewardBase')} ·{' '}
              <strong className="font-extrabold">+150 XP</strong> {t('daily.ready.rewardPerfect')}
            </div>
          </div>
        </div>
        <button data-testid="daily-start-btn" onClick={onStart} className="lk-btn w-full md:w-auto text-bq-ink text-[18px]">
          {t('daily.ready.cta')}
        </button>
        {yesterday?.completed && (
          <p className="m-0 mt-4 px-3.5 py-2.5 bg-bq-white border-2 border-dashed border-bq-ink/30 rounded-xl font-read text-[14px] text-bq-ink2 leading-relaxed">
            <strong className="text-bq-ink">{t('daily.ready.yesterdayPrefix')}</strong>{' '}
            {yesterday.timeSeconds && yesterday.timeSeconds > 0
              ? t('daily.ready.yesterdayBody', {
                  correct: yesterday.correctCount ?? 0,
                  total: yesterday.totalQuestions ?? 5,
                  time: formatTime(yesterday.timeSeconds),
                })
              : t('daily.ready.yesterdayBodyNoTime', {
                  correct: yesterday.correctCount ?? 0,
                  total: yesterday.totalQuestions ?? 5,
                })}
          </p>
        )}
      </div>
    </div>
  )
}

function DoneLeft({ done, onReview }: HeroCardProps) {
  const { t } = useTranslation()
  if (!done) return null
  const completedTimeLabel = done.completedAt
    ? new Date(done.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <>
      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink text-[13px] font-extrabold mb-3">
        ✓ {t('daily.done.statusBadge', { time: completedTimeLabel })}
      </span>
      <h2 data-testid="daily-completed-badge" className="m-0 mb-2 font-display text-[28px] md:text-[32px] font-extrabold leading-tight text-bq-ink">
        {t('daily.done.title')}
      </h2>
      <p className="m-0 mb-5 font-read text-[15px] leading-relaxed text-bq-ink2">
        {done.betterThanPercent != null
          ? <>{t('daily.done.descPrefix')} <strong className="text-bq-ink">{done.betterThanPercent}%</strong> {t('daily.done.descPlayers')}</>
          : t('daily.done.descNoData')}
      </p>
      <div className="bg-bq-white border-2 border-bq-ink rounded-2xl px-4 py-1.5 mb-5">
        <SummaryRow label={t('daily.done.rowCorrect')} value={`${done.correctCount} / ${done.totalQuestions}`} />
        {done.timeSeconds != null && (
          <SummaryRow label={t('daily.done.rowTime')} value={formatTime(done.timeSeconds)} />
        )}
        {done.betterThanPercent != null && (
          <SummaryRow label={t('daily.done.rowBetterThan')} value={t('daily.done.betterThanValue', { percent: done.betterThanPercent })} />
        )}
        <SummaryRow
          label={t('daily.done.rowXP')}
          value={`+${done.xpEarned} XP`}
          valueClass={done.xpEarned > 0 ? 'text-bq-ink [text-shadow:0_.08em_0_#FFC93C]' : 'text-bq-ink3'}
          lastRow
        />
        {done.resultsBreakdown && done.resultsBreakdown.length > 0 && (
          <div className="flex gap-1.5 pb-3 pt-1">
            {done.resultsBreakdown.map((correct, i) => (
              <span
                key={i}
                title={t('daily.done.qDotTitle', { num: i + 1, status: correct ? t('daily.done.qDotCorrect') : t('daily.done.qDotWrong') })}
                className={`flex-1 h-3.5 rounded-full border-2 border-bq-ink ${correct ? 'bg-bq-leaf' : 'bg-bq-ruby'}`}
              />
            ))}
          </div>
        )}
      </div>
      <button onClick={onReview} className="lk-btn lk-btn-2 w-full md:w-auto text-bq-ink text-[16px]">
        {t('daily.done.cta')}
      </button>
    </>
  )
}

function DoneRight({ done, onShare, onDownload }: HeroCardProps) {
  const { t } = useTranslation()
  if (!done) return null
  const percent = done.totalQuestions > 0
    ? Math.round((done.correctCount / done.totalQuestions) * 100)
    : 0

  return (
    <div className="flex flex-col items-center text-center">
      <Medal size={148}>
        <span>
          <span
            data-testid="daily-score-display"
            className="block font-display text-[52px] font-extrabold leading-none text-bq-ink [text-shadow:0_.06em_0_#FFC93C]"
          >
            {done.correctCount}
          </span>
          <span className="block text-[13px] font-bold text-bq-ink2 mt-1">
            {t('daily.done.scoreOf', { total: done.totalQuestions })}
          </span>
        </span>
      </Medal>
      <span className="mt-5 px-3 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink text-[13px] font-extrabold">
        {t('daily.done.scorePercent', { percent })}
      </span>
      <div className="mt-4 w-full px-3 py-2.5 bg-bq-white border-2 border-bq-ink rounded-2xl">
        <div className="font-display text-[24px] font-extrabold leading-none">{done.rankGlobal != null ? `#${done.rankGlobal}` : '—'}</div>
        <div className="mt-1 text-[13px] font-bold text-bq-ink2">{t('daily.done.rankGlobal')}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 w-full">
        <button onClick={onShare} className="lk-btn !px-3 !bg-bq-white text-bq-ink text-[14px]">
          <span className="material-symbols-outlined text-[18px]">share</span>
          {t('daily.done.share')}
        </button>
        <button onClick={onDownload} className="lk-btn !px-3 !bg-bq-white text-bq-ink text-[14px]">
          <span className="material-symbols-outlined text-[18px]">photo_camera</span>
          {t('daily.done.downloadImage')}
        </button>
      </div>
    </div>
  )
}

function MetaItem({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-bq-white border-2 border-bq-ink text-[13.5px] font-bold text-bq-ink">
      <span className="material-symbols-outlined text-[17px]">{icon}</span>
      {text}
    </span>
  )
}

function SummaryRow({ label, value, valueClass = 'text-bq-ink', lastRow = false }: { label: string; value: string; valueClass?: string; lastRow?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2.5 ${!lastRow ? 'border-b-2 border-dashed border-bq-hair' : ''}`}>
      <span className="text-[14px] font-bold text-bq-ink2">{label}</span>
      <span className={`text-[16px] font-extrabold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  )
}
