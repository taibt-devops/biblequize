import { useTranslation } from 'react-i18next'
import type { PlayerScore } from '../../types/room'

interface Props {
  /** Bảng điểm sau câu vừa công bố (đã xếp giảm dần). */
  scores: PlayerScore[]
  /** Bảng điểm trước câu đó — để biết ai lên, ai xuống hạng. */
  previousScores: PlayerScore[]
  myUserId?: string
}

type Move = 'up' | 'down' | 'same'

const ARROW: Record<Move, { icon: string; cls: string }> = {
  up: { icon: 'arrow_upward', cls: 'text-bq-emerald' },
  down: { icon: 'arrow_downward', cls: 'text-bq-ruby' },
  same: { icon: 'remove', cls: 'text-bq-ink3' },
}

/**
 * PCV-11 — Đua tốc độ (design §2.1): sau câu 3, 6, 9… hiện 5 người dẫn đầu kèm mũi tên lên/xuống
 * hạng so với câu trước, để thấy cuộc đua thay vì chỉ thấy điểm của mình.
 */
export default function StandingsFlash({ scores, previousScores, myUserId }: Props) {
  const { t } = useTranslation()
  const prevRank = new Map(previousScores.map((p, i) => [p.playerId, i + 1]))
  const top = scores.slice(0, 5)

  return (
    <section data-testid="standings-flash" className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-2 text-bq-ink">
        <span className="material-symbols-outlined text-bq-amberd text-[20px]" aria-hidden>leaderboard</span>
        <span className="text-[13px] font-extrabold">{t('room.standings.title')}</span>
      </div>
      <ol className="space-y-1.5">
        {top.map((p, i) => {
          const before = prevRank.get(p.playerId)
          const move: Move = before === undefined || before > i + 1 ? 'up' : before < i + 1 ? 'down' : 'same'
          const mine = p.playerId === myUserId
          return (
            <li key={p.playerId} data-testid={`standings-row-${i}`} data-move={move}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[14px] ${mine ? 'bg-bq-cream font-extrabold' : ''}`}>
              <span className="w-5 text-right font-black text-bq-ink2">{i + 1}</span>
              <span className={`material-symbols-outlined text-[18px] ${ARROW[move].cls}`} aria-hidden>{ARROW[move].icon}</span>
              <span className="flex-1 truncate text-bq-ink">
                {p.username}{mine ? ` ${t('room.standings.you')}` : ''}
              </span>
              <span className="font-bold text-bq-ink">{t('room.standings.points', { score: p.score })}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
