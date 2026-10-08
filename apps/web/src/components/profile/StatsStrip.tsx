import { useTranslation } from 'react-i18next'
import { Medal } from '../lk/Place'

/** Four camp medals (LKF-12): points, streak, sessions, accuracy. */
export function StatsStrip({ points, currentStreak, longestStreak, totalSessions, totalQuestions, totalCorrect, correctRate }: {
  points: number
  currentStreak: number
  longestStreak: number
  totalSessions: number
  totalQuestions: number
  totalCorrect: number
  correctRate: number
}) {
  const { t } = useTranslation()
  const dayWord = t('common.days')

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        testId="profile-stats-points"
        icon={<img src="/images/lk/icon-trophy.webp" alt="" aria-hidden className="h-8" />}
        label={t('profile.totalPoints')}
        value={points.toLocaleString()}
        sub={t('profile.statRankUnranked')}
      />
      <StatCard
        testId="profile-stats-streak"
        icon={<img src={currentStreak > 0 ? '/images/lk/lantern-on.webp' : '/images/lk/lantern-off.webp'} alt="" aria-hidden className="h-8" />}
        label={t('profile.currentStreak')}
        value={`${currentStreak} ${dayWord}`}
        sub={t('profile.statLongestSub', { n: longestStreak })}
        extra={<span className="sr-only">{longestStreak} {dayWord}</span>}
      />
      <StatCard
        testId="profile-total-sessions"
        icon={<img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-8" />}
        label={t('profile.totalSessions')}
        value={`${totalSessions}`}
        sub={t('profile.statQuestionsAnswered', { n: totalQuestions })}
      />
      <StatCard
        testId="profile-correct-rate"
        icon={<span aria-hidden className="text-[24px] font-extrabold text-bq-emerald leading-none">✓</span>}
        label={t('profile.correctRate')}
        value={`${correctRate}%`}
        sub={t('profile.statCorrectFraction', { correct: totalCorrect, total: totalQuestions })}
      />
    </section>
  )
}

function StatCard({ testId, icon, label, value, sub, extra }: {
  testId?: string
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  extra?: React.ReactNode
}) {
  return (
    <div data-testid={testId} className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-2xl p-3.5 md:p-4 flex items-center gap-3">
      <Medal size={50}>{icon}</Medal>
      <div className="flex-1 min-w-0 pl-1">
        <p className="m-0 text-[12.5px] font-bold text-bq-ink2 truncate">{label}</p>
        <p className="m-0 font-display text-[22px] md:text-[24px] font-extrabold text-bq-ink leading-tight truncate">{value}</p>
        {sub && <p className="m-0 text-[12px] font-bold text-bq-ink3 truncate">{sub}</p>}
        {extra}
      </div>
    </div>
  )
}
