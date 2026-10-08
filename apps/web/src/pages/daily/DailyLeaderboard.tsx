import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface DailyLbEntry {
  rank: number
  name: string
  tier?: string
  score: number
  correctCount?: number
  totalQuestions?: number
  timeLabel?: string
  avatarUrl?: string
  avatarInitial?: string
  avatarHue?: 'gold' | 'silver' | 'bronze' | 'gray'
  isMe?: boolean
}

interface DailyLeaderboardProps {
  entries: DailyLbEntry[]
  myEntry?: DailyLbEntry | null
  myCompleted: boolean
}

export function DailyLeaderboard({ entries, myEntry, myCompleted }: DailyLeaderboardProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'global' | 'group'>('global')

  return (
    <div className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="font-display text-[19px] font-extrabold flex items-center gap-2 text-bq-ink">
          <img src="/images/lk/icon-trophy.webp" alt="" aria-hidden className="h-7" />
          {t('daily.lbToday')}
        </div>
        <div className="flex gap-1 bg-bq-paper border-2 border-bq-ink p-1 rounded-full">
          <button
            onClick={() => setTab('global')}
            className={`px-3 py-1 rounded-full text-[13px] font-extrabold transition-colors cursor-pointer ${
              tab === 'global' ? 'bg-bq-amber text-bq-ink' : 'text-bq-ink2 hover:text-bq-ink'
            }`}
          >
            {t('daily.lbTabGlobal')}
          </button>
          <button
            onClick={() => setTab('group')}
            className={`px-3 py-1 rounded-full text-[13px] font-extrabold transition-colors cursor-pointer ${
              tab === 'group' ? 'bg-bq-amber text-bq-ink' : 'text-bq-ink2 hover:text-bq-ink'
            }`}
          >
            {t('daily.lbTabGroup')}
          </button>
        </div>
      </div>

      <div data-testid="daily-leaderboard">
        {entries.length === 0 ? (
          <div className="p-6 text-center text-bq-ink2">
            <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-20 mb-2" />
            <p className="m-0 font-read text-[15px]">{t('daily.noOneCompleted')}</p>
          </div>
        ) : (
          entries.slice(0, 5).map((e) => <Row key={e.rank} entry={e} />)
        )}
      </div>

      <div aria-hidden className="my-3 border-t-2 border-dashed border-bq-hair" />

      {/* User row */}
      {myEntry ? (
        <Row entry={{ ...myEntry, isMe: true }} />
      ) : (
        <div className="grid grid-cols-[32px_36px_1fr_auto_auto] gap-3 items-center px-3 py-2.5 rounded-2xl bg-bq-cream border-2 border-dashed border-bq-ink/40">
          <div className="text-[13px] font-extrabold text-bq-ink2 text-center">—</div>
          <div className="w-9 h-9 rounded-full grid place-items-center font-extrabold text-[14px] bg-bq-paper border-2 border-bq-ink/40 text-bq-ink2">
            {myEntry === null ? '?' : '...'}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold truncate text-bq-ink">{t('daily.lbYouLine')}</div>
            <div className="text-[12.5px] font-bold text-bq-ink2 mt-0.5">
              {myCompleted ? t('daily.lbLoadingMyRank') : t('daily.lbNotCompleted')}
            </div>
          </div>
          <div>
            <div className="text-[14px] font-extrabold text-bq-ink2 text-right tabular-nums">— đ</div>
          </div>
          <div className="text-[11px] text-bq-ink2 text-right tabular-nums min-w-[50px]">—</div>
        </div>
      )}
    </div>
  )
}

const PODIUM = ['bg-bq-amber', 'bg-bq-silver', 'bg-bq-bronze']

function Row({ entry }: { entry: DailyLbEntry }) {
  const { t } = useTranslation()
  const podium = entry.rank >= 1 && entry.rank <= 3 ? PODIUM[entry.rank - 1] : null

  return (
    <div
      data-testid="daily-leaderboard-row"
      className={`grid grid-cols-[32px_36px_1fr_auto_auto] gap-3 items-center px-3 py-2 rounded-2xl mb-1 ${
        entry.isMe ? 'bg-bq-amber/25 border-2 border-bq-ink' : 'border-2 border-transparent hover:bg-bq-cream'
      }`}
    >
      <div className="grid place-items-center">
        {podium ? (
          <span className={`w-8 h-8 rounded-full border-[3px] border-bq-ink grid place-items-center text-[14px] font-extrabold ${podium}`}>{entry.rank}</span>
        ) : (
          <span className="text-[14px] font-extrabold text-bq-ink2">{entry.rank || '—'}</span>
        )}
      </div>
      <div className={`w-9 h-9 rounded-full grid place-items-center font-extrabold text-[14px] flex-shrink-0 overflow-hidden border-2 border-bq-ink ${entry.isMe ? 'bg-bq-leaf' : 'bg-bq-cream'}`}>
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt={entry.name} className="w-full h-full object-cover" />
        ) : (
          entry.avatarInitial ?? entry.name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-extrabold truncate text-bq-ink">
          {entry.name}{entry.isMe ? ` ${t('daily.lbYouSuffix')}` : ''}
        </div>
        {entry.tier && <div className="text-[12px] font-bold text-bq-ink2 mt-0.5">{entry.tier}</div>}
      </div>
      <div className="text-right">
        <div className="text-[14px] font-extrabold tabular-nums">{entry.score} đ</div>
        {entry.correctCount != null && entry.totalQuestions != null && (
          <div className="text-[12px] text-bq-ink2 font-bold mt-0.5">
            {entry.correctCount}/{entry.totalQuestions}
            {entry.correctCount === entry.totalQuestions ? ' ★' : ''}
          </div>
        )}
      </div>
      <div className="text-[12px] font-bold text-bq-ink2 text-right tabular-nums min-w-[44px]">
        {entry.timeLabel ?? '—'}
      </div>
    </div>
  )
}
