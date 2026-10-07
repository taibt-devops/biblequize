import { useTranslation } from 'react-i18next'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

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

export function HeroCard(props: HeroCardProps) {
  const { t } = useTranslation()

  return (
    <div className="relative bg-bq-white border border-bq-hair shadow-bq-amb rounded-[20px] overflow-hidden mb-7">
      <div className="absolute inset-y-0 right-0 w-[400px] bg-[radial-gradient(circle_at_right,rgba(245,158,11,0.10)_0%,transparent_60%)] pointer-events-none" />
      <div className={`relative z-[1] grid grid-cols-1 ${props.state === 'done' ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
        {/* LEFT (or full-width on ready state) */}
        <div className={`p-8 ${props.state === 'done' ? 'lg:border-r border-bq-hair' : ''}`}>
          {props.state === 'ready' ? <ReadyLeft {...props} /> : <DoneLeft {...props} />}
        </div>
        {/* RIGHT — only Done state. Ready hero is single-column post-DC-1/DC-2
            (verse moved to Home banner, big-flame streak block now lives
            exclusively in the standalone StreakCard). */}
        {props.state === 'done' && (
          <div className="p-8 bg-bq-inset">
            <DoneRight {...props} />
          </div>
        )}
      </div>
    </div>
  )

  function ReadyLeft({ questionCount, timeLimit, yesterday, onStart }: HeroCardProps) {
    return (
      <>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[20px] mb-3 bg-bq-amber/10 border border-bq-amber/30 text-bq-amberd text-xs font-bold uppercase tracking-[0.5px]">
          <span className="w-2 h-2 rounded-full bg-bq-ember animate-pulse-ring" />
          {t('daily.ready.statusBadge')}
        </div>
        <div className="text-[11px] text-bq-ink3 font-semibold uppercase tracking-[0.18em] mb-1.5">
          {t('daily.ready.eyebrow')}
        </div>
        <h3 className="font-display text-[28px] font-extrabold mb-2.5 tracking-tight">
          <span className="text-bq-ink">{t('daily.ready.titleLead', { count: questionCount })}</span>
          {' '}
          <span className="text-bq-amberd">{t('daily.ready.titleAccent')}</span>
        </h3>
        <p className="font-literata text-bq-ink2 text-sm italic leading-relaxed mb-6">
          &ldquo;{t('daily.ready.desc')}&rdquo;
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-[22px]">
          <MetaItem icon="quiz" text={t('daily.ready.metaQuestions', { count: questionCount })} />
          <MetaItem icon="timer" text={t('daily.ready.metaTime', { minutes: timeLimit })} />
          <MetaItem icon="public" text={t('daily.ready.metaGlobal')} />
          <MetaItem icon="shield" text={t('daily.ready.metaNoEnergy')} />
        </div>
        <div className="bg-bq-inset border border-bq-amber/12 rounded-xl px-4 py-3.5 mb-[22px] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[10px] bg-bq-amber/15 border border-bq-amber/30 grid place-items-center text-bq-amberd text-[22px] flex-shrink-0">
            <span className="material-symbols-outlined">workspace_premium</span>
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-bq-ink2 font-semibold uppercase tracking-[0.5px]">
              {t('daily.ready.rewardLabel')}
            </div>
            <div className="text-sm text-bq-ink font-bold mt-0.5">
              <strong className="text-bq-amberd">+20 XP</strong> {t('daily.ready.rewardBase')} ·{' '}
              <strong className="text-bq-amberd">+150 XP</strong> {t('daily.ready.rewardPerfect')}
            </div>
          </div>
        </div>
        <button
          data-testid="daily-start-btn"
          onClick={onStart}
          className="w-full bg-bq-action text-bq-ink border-none px-7 py-4 rounded-2xl text-base font-extrabold cursor-pointer transition-all flex items-center justify-center gap-2.5 shadow-bq-action hover:-translate-y-px"
        >
          <span className="material-symbols-outlined">play_arrow</span>
          {t('daily.ready.cta')}
        </button>
        {yesterday?.completed && (
          <div className="mt-4 px-3.5 py-3 bg-bq-inset border-l-[3px] border-bq-sapphire/50 rounded-lg text-xs text-bq-ink2 leading-relaxed">
            📊 <strong className="text-bq-sapphire">{t('daily.ready.yesterdayPrefix')}</strong>{' '}
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
          </div>
        )}
      </>
    )
  }

  function DoneLeft({ done, onReview }: HeroCardProps) {
    if (!done) return null
    const completedTimeLabel = done.completedAt
      ? new Date(done.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : '—'
    return (
      <>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[20px] mb-[18px] bg-bq-emerald/10 border border-bq-emerald/30 text-bq-emerald text-xs font-bold uppercase tracking-[0.5px]">
          <span className="w-2 h-2 rounded-full bg-bq-emerald animate-pulse-ring-green" />
          {t('daily.done.statusBadge', { time: completedTimeLabel })}
        </div>
        <h3 data-testid="daily-completed-badge" className="font-display text-[28px] font-extrabold mb-2.5 tracking-tight text-bq-ink">
          {t('daily.done.title')}
        </h3>
        <p className="text-bq-ink2 text-sm leading-relaxed mb-6">
          {done.betterThanPercent != null
            ? <>{t('daily.done.descPrefix')} <strong className="text-bq-emerald">{done.betterThanPercent}%</strong> {t('daily.done.descPlayers')}</>
            : t('daily.done.descNoData')}
        </p>
        <div className="bg-bq-inset border border-bq-emerald/15 rounded-xl p-4 mb-[22px]">
          <SummaryRow icon="check_circle" label={t('daily.done.rowCorrect')} value={`${done.correctCount} / ${done.totalQuestions}`} valueClass="text-bq-emerald" />
          {done.timeSeconds != null && (
            <SummaryRow icon="timer" label={t('daily.done.rowTime')} value={formatTime(done.timeSeconds)} />
          )}
          {done.betterThanPercent != null && (
            <SummaryRow icon="trending_up" label={t('daily.done.rowBetterThan')} value={t('daily.done.betterThanValue', { percent: done.betterThanPercent })} valueClass="text-bq-emerald" />
          )}
          <SummaryRow
            icon="workspace_premium"
            label={t('daily.done.rowXP')}
            value={`+${done.xpEarned} XP`}
            valueClass={done.xpEarned > 0 ? 'text-bq-amberd' : 'text-bq-ink3'}
            lastRow
          />
          {done.resultsBreakdown && done.resultsBreakdown.length > 0 && (
            <div className="flex gap-1 mt-3.5">
              {done.resultsBreakdown.map((correct, i) => (
                <div
                  key={i}
                  title={t('daily.done.qDotTitle', { num: i + 1, status: correct ? t('daily.done.qDotCorrect') : t('daily.done.qDotWrong') })}
                  className={`flex-1 h-2 rounded ${correct
                    ? 'bg-bq-emerald'
                    : 'bg-bq-ruby'
                    }`}
                />
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onReview}
          className="w-full bg-bq-action text-bq-ink border-none px-7 py-4 rounded-2xl text-base font-extrabold cursor-pointer transition-all flex items-center justify-center gap-2.5 shadow-bq-action hover:-translate-y-px"
        >
          <span className="material-symbols-outlined">visibility</span>
          {t('daily.done.cta')}
        </button>
      </>
    )
  }

  function DoneRight({ done, onShare, onDownload }: HeroCardProps) {
    if (!done) return null
    const percent = done.totalQuestions > 0
      ? Math.round((done.correctCount / done.totalQuestions) * 100)
      : 0
    const ringRadius = 70
    const ringCircumference = 2 * Math.PI * ringRadius
    const ringOffset = ringCircumference - (percent / 100) * ringCircumference

    return (
      <>
        <div className="text-center mb-[18px]">
          <div className="relative w-40 h-40 mx-auto mb-3">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <defs>
                <linearGradient id="dailyHeroScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97F06" />
                </linearGradient>
              </defs>
              <circle cx="80" cy="80" r={ringRadius} fill="none" stroke="rgba(22,21,27,0.08)" strokeWidth="12" />
              <circle
                cx="80"
                cy="80"
                r={ringRadius}
                fill="none"
                stroke="url(#dailyHeroScoreGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.45))', transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div
                  data-testid="daily-score-display"
                  className="text-[42px] font-extrabold leading-none"
                  style={{
                    background: 'linear-gradient(135deg, #D97F06 0%, #F59E0B 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {done.correctCount}
                </div>
                <div className="text-sm text-bq-ink2 mt-1">
                  {t('daily.done.scoreOf', { total: done.totalQuestions })}
                </div>
                <div className="text-[11px] text-bq-emerald font-bold mt-0.5">
                  {t('daily.done.scorePercent', { percent })}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Single-col: chỉ "Hạng toàn cầu". Ô "Trong nhóm" đã bỏ — Daily
            Challenge là hoạt động solo, group leaderboard locked group-play-only
            (SPEC_GROUP Q-A) + §10 đang deprecated. */}
        <div className="grid grid-cols-1 gap-2 mb-3.5">
          <StatMini value={done.rankGlobal != null ? `#${done.rankGlobal}` : '—'} label={t('daily.done.rankGlobal')} highlight />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ShareBtn icon="share" label={t('daily.done.share')} onClick={onShare} />
          <ShareBtn icon="photo_camera" label={t('daily.done.downloadImage')} onClick={onDownload} />
        </div>
      </>
    )
  }
}

function MetaItem({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-bq-inset border border-bq-hair text-xs text-bq-ink font-semibold">
      <span className="material-symbols-outlined text-base text-bq-amberd">{icon}</span>
      {text}
    </span>
  )
}

function SummaryRow({ icon, label, value, valueClass = 'text-bq-ink', lastRow = false }: { icon: string; label: string; value: string; valueClass?: string; lastRow?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2.5 ${!lastRow ? 'border-b border-bq-hair' : ''}`}>
      <div className="text-xs text-bq-ink2 flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-bq-ink2">{icon}</span>
        {label}
      </div>
      <div className={`text-sm font-bold ${valueClass}`}>{value}</div>
    </div>
  )
}

function StatMini({ value, label, highlight = false, success = false }: { value: string; label: string; highlight?: boolean; success?: boolean }) {
  const valueColor = highlight ? 'text-bq-amberd' : success ? 'text-bq-emerald' : 'text-bq-ink'
  return (
    <div className="bg-bq-white border border-bq-hair rounded-[10px] px-3 py-2.5 text-center">
      <div className={`text-lg font-extrabold ${valueColor}`}>{value}</div>
      <div className="text-[10px] text-bq-ink2 uppercase tracking-[0.5px] mt-0.5">{label}</div>
    </div>
  )
}

function ShareBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-bq-amber/10 text-bq-amberd border border-bq-amber/25 hover:bg-bq-amber/20 px-3 py-3 rounded-[10px] text-[13px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  )
}

// Suppress unused-warn for FILL_1 — kept for parity if needed by future state badges.
void FILL_1
