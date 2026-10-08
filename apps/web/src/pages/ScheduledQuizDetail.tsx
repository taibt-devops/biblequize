import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlaceBackdrop } from '../components/lk/Place'
import {
  getScheduledQuizDetail, getScheduledQuizLeaderboard,
  ScheduledQuizDetail as Detail, LeaderboardRow,
} from '../api/scheduledQuiz'

const fmtCountdown = (deadlineIso: string): string => {
  const ms = new Date(deadlineIso).getTime() - Date.now()
  if (ms <= 0) return '0'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days} ngày ${hours % 24}h`
}

const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const fmtAbsDate = (iso: string): string => {
  try {
    const d = new Date(iso)
    const dd = d.getDate().toString().padStart(2, '0')
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const hh = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    return `${hh}:${min} ${dd}/${mm}`
  } catch { return iso }
}

const daysBetween = (from?: string, to?: string): number | null => {
  if (!from || !to) return null
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(1, Math.round(ms / 86400000))
}

const ScheduledQuizDetailPage: React.FC = () => {
  const { t } = useTranslation()
  const { id: groupId, quizId } = useParams()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<Detail | null>(null)
  const [lb, setLb] = useState<LeaderboardRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // re-render countdown each second

  const fetchAll = useCallback(async () => {
    if (!groupId || !quizId) return
    try {
      const [d, l] = await Promise.all([
        getScheduledQuizDetail(groupId, quizId),
        getScheduledQuizLeaderboard(groupId, quizId),
      ])
      setDetail(d)
      setLb(l)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Lỗi tải dữ liệu')
    }
  }, [groupId, quizId])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [])
  // poll leaderboard every 30s
  useEffect(() => {
    const i = setInterval(fetchAll, 30000)
    return () => clearInterval(i)
  }, [fetchAll])

  if (error) return <div className="p-4 text-error">{error}</div>
  if (!detail) return <div className="p-4 text-bq-ink2">Đang tải...</div>

  const isEnded = detail.status === 'ENDED' || detail.status === 'CANCELLED'
  const winner = isEnded ? lb.find(r => r.userId === detail.winnerUserId) ?? lb[0] : null
  const canPlay = detail.status === 'ACTIVE' && detail.myStatus.attemptsRemaining > 0
  void tick

  return (
    <div className="relative min-h-screen text-bq-ink px-4 py-5 max-w-3xl mx-auto" data-testid="scheduled-quiz-detail">
      <PlaceBackdrop place="chapel" veil="strong" />
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(`/groups/${groupId}`)} className="text-bq-ink2 hover:text-bq-ink" aria-label="Back">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="text-xs text-bq-ink2">{t('scheduledQuiz.backToGroup')}</span>
      </div>

      {/* Status banner */}
      {!isEnded ? (
        <div data-testid="active-banner" className="rounded-2xl p-4 mb-4 grid grid-cols-[1fr_auto] gap-3 items-center bg-bq-white border border-bq-sapphire/25 shadow-bq-soft">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bq-emerald/10 border border-bq-emerald/25 text-bq-emerald text-[12px] font-bold mb-1.5">
              <span className="w-1.5 h-1.5 bg-bq-emerald rounded-full animate-pulse" />
              {t('scheduledQuiz.statusActive')}
            </div>
            <div className="text-base font-bold mb-0.5">{detail.name}</div>
            <div className="text-bq-ink2 text-xs">
              {detail.questionCount} câu · {lb.length}/{lb.length || '?'} thành viên đã chơi
              {detail.createdAt ? ` · Mở từ ${fmtAbsDate(detail.createdAt)}` : ''}
            </div>
          </div>
          <div className="text-center bg-bq-inset border border-bq-amber/25 rounded-lg px-3.5 py-2.5">
            <div className="text-[11.5px] text-bq-ink2 font-bold">{t('scheduledQuiz.remaining')}</div>
            <div className="text-base font-bold text-bq-amberd tabular-nums mt-0.5">{fmtCountdown(detail.deadline)}</div>
          </div>
        </div>
      ) : (
        <div data-testid="ended-banner" className="rounded-2xl p-5 mb-4 text-center bg-bq-white border border-bq-amber/30 shadow-bq-soft">
          <div className="text-4xl mb-1">🎊</div>
          <h3 className="text-lg font-bold font-display">{t('scheduledQuiz.endedBanner')}</h3>
          <p className="text-bq-ink2 text-xs mt-1 leading-relaxed">
            "{detail.name}" · {lb.length} thành viên tham gia
            {(() => { const d = daysBetween(detail.createdAt, detail.endedAt); return d ? ` · Kéo dài ${d} ngày` : '' })()}
            <br />
            <strong className="text-bq-amberd">Đã đăng vào group announcement</strong>
          </p>
        </div>
      )}

      {/* Winner card (ended) */}
      {isEnded && winner && (
        <div data-testid="winner-card" className="rounded-2xl p-4 mb-4 grid grid-cols-[auto_1fr_auto] gap-4 items-center bg-bq-white border border-bq-amber/30 shadow-bq-soft">
          <div className="relative w-14 h-14 rounded-full grid place-items-center font-bold text-xl border-[3px] bg-bq-flame text-bq-ink border-bq-amber">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xl">👑</span>
            {winner.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-bq-amberd mb-0.5">🏆 {t('scheduledQuiz.winner')}</div>
            <div className="text-base font-bold truncate">{winner.name}</div>
            <div className="text-bq-ink2 text-[11px]">
              {winner.correctCount}/{winner.totalQuestions} đúng · {fmtTime(winner.timeSeconds)} phút · {winner.attemptsUsed} lần thử
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-bq-amberd">
              {winner.score}
            </div>
            <div className="text-[12px] text-bq-ink2 mt-1">điểm</div>
          </div>
        </div>
      )}

      {/* My status (active) */}
      {!isEnded && (
        <div className="rounded-2xl p-4 mb-4 bg-bq-white border border-bq-hair shadow-bq-soft" data-testid="my-status">
          <div className="text-[12px] text-bq-ink2 font-bold mb-3">{t('scheduledQuiz.myStatus')}</div>
          <div className="flex items-center gap-2.5 mb-3">
            {Array.from({ length: detail.maxAttempts }).map((_, i) => {
              const used = i < detail.myStatus.attemptsUsed
              const next = i === detail.myStatus.attemptsUsed && canPlay
              return (
                <div key={i}
                  className={`w-9 h-9 rounded-lg grid place-items-center font-bold text-sm border-[1.5px] ${
                    used
                      ? 'bg-bq-emerald text-white border-bq-emerald'
                      : next
                        ? 'bg-bq-amber/15 text-bq-amberd border-bq-amber border-dashed'
                        : 'bg-bq-inset text-bq-ink3 border-bq-hair'
                  }`}>
                  {used ? '✓' : i + 1}
                </div>
              )
            })}
            <div className="flex-1 ml-2">
              <div className="text-xs font-bold">{detail.myStatus.attemptsUsed}/{detail.maxAttempts} lần</div>
              <div className="text-bq-ink2 text-[11px]">{t('scheduledQuiz.attemptsHelp')}</div>
            </div>
          </div>
          {detail.myStatus.bestScore !== null && (
            <div className="bg-bq-inset rounded-lg px-3 py-2.5 flex items-center justify-between text-xs mb-3">
              <span className="text-bq-ink2">{t('scheduledQuiz.bestScore')}</span>
              <span className="font-bold text-bq-amberd tabular-nums">
                {detail.myStatus.bestScore} điểm · {detail.myStatus.bestCorrectCount}/{detail.questionCount} · {fmtTime(detail.myStatus.bestTimeSeconds ?? 0)}
              </span>
            </div>
          )}
          <button
            onClick={() => navigate(`/groups/${groupId}/scheduled-quizzes/${quizId}/play`)}
            disabled={!canPlay}
            data-testid="play-btn"
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed bg-bq-action text-bq-ink shadow-bq-action"
          >
            <span className="material-symbols-outlined text-base">play_arrow</span>
            {detail.myStatus.attemptsUsed === 0 ? t('scheduledQuiz.playFirst')
              : detail.myStatus.attemptsRemaining === 1 ? t('scheduledQuiz.playLast')
              : t('scheduledQuiz.playAgain')}
          </button>
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-2xl p-4 bg-bq-white border border-bq-hair shadow-bq-soft" data-testid="leaderboard">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="text-sm font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-bq-emerald">leaderboard</span>
            {isEnded ? t('scheduledQuiz.finalResults') : t('scheduledQuiz.liveLeaderboard')}
          </div>
          <span className="text-bq-ink2 text-[11px]">
            {lb.length} người tham gia · {isEnded
              ? `Đóng băng lúc ${fmtAbsDate(detail.endedAt ?? detail.deadline)}`
              : 'Cập nhật trực tiếp'}
          </span>
        </div>
        {lb.length === 0 ? (
          <p className="text-center text-bq-ink3 py-6 text-xs">{t('scheduledQuiz.noPlayers')}</p>
        ) : (
          <div className="space-y-1">
            {lb.map(row => (
              <div key={row.userId}
                className={`grid grid-cols-[24px_32px_1fr_auto] gap-2.5 items-center px-2 py-1.5 rounded-lg ${
                  row.isMe ? 'bg-bq-amber/10 border border-bq-amber/25' : ''
                }`}>
                <span className={`text-center text-xs font-bold ${row.rank === 1 ? 'text-bq-amberd text-sm' : row.rank === 2 ? 'text-bq-ink2 text-sm' : row.rank === 3 ? 'text-bq-ember text-sm' : 'text-bq-ink3'}`}>
                  {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                </span>
                <div className={`w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold ${
                  row.isMe ? 'bg-bq-amber text-bq-ink'
                    : row.rank === 1 ? 'bg-bq-flame text-bq-ink'
                    : 'bg-bq-inset text-bq-ink2'
                }`}>
                  {row.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate flex items-center gap-1.5">
                    {row.name}
                    {row.isMe && <span className="bg-bq-amber/20 text-bq-amberd text-[8px] px-1 py-0.5 rounded font-bold">BẠN</span>}
                  </div>
                  <div className="text-[10px] text-bq-ink2 mt-0.5">
                    {row.correctCount}/{row.totalQuestions} đúng · {fmtTime(row.timeSeconds)} trung bình · {row.attemptsUsed}/{detail.maxAttempts} lần
                    {row.userId === detail.createdBy ? ' · Trưởng nhóm' : ''}
                  </div>
                </div>
                <div className="text-sm font-bold text-bq-amberd tabular-nums">{row.score}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action row (ended state) */}
      {isEnded && (
        <div className="flex gap-2.5 mt-4">
          <button
            className="rounded-xl px-4 py-3.5 text-sm font-bold flex items-center gap-1.5 bg-bq-inset text-bq-ink2 border border-bq-hair">
            <span className="material-symbols-outlined text-[16px]">share</span>
            Chia sẻ kết quả
          </button>
          <button
            onClick={() => navigate(`/groups/${groupId}/scheduled-quizzes/new?quizSetId=${detail.quizSetId}`)}
            className="flex-1 rounded-xl py-3.5 text-sm font-extrabold flex items-center justify-center gap-2 bg-bq-action text-bq-ink shadow-bq-action">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo quiz tuần mới
          </button>
        </div>
      )}
    </div>
  )
}

export default ScheduledQuizDetailPage
