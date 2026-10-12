import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { challengeApi, challengeErrorMessage, formatCountdown, type PendingChallenge } from '../../api/challenges'

const POLL_MS = 20_000

/** Màn đang chơi dở: không che câu hỏi — lời mời vẫn chờ (5 phút), hiện lại khi rời màn. */
const PLAYING = /^\/(speed-round|mystery-mode|weekly-quiz|basic-quiz)(\/|$)|\/(play|session|match)(\/|$)/

/**
 * PCV-23 — lời mời thách đấu toàn app (người đã đăng nhập): hỏi máy chủ mỗi 20 giây; có lời thách
 * thì hiện thẻ "X thách bạn đấu 10 câu" [Nhận] [Để sau]. Nhận ⇒ vào sảnh phòng thách đấu; Để sau ⇒ từ chối.
 */
export default function ChallengeInviteWatcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [invite, setInvite] = useState<PendingChallenge | null>(null)
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handled = useRef<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const list = await challengeApi.pending()
        if (!alive) return
        const next = (Array.isArray(list) ? list : []).find(c => !handled.current.has(c.challengeId)) ?? null
        setInvite(prev => (prev && next && prev.challengeId === next.challengeId ? prev : next))
        // Mỗi lần hỏi lấy lại số giây còn lại theo đồng hồ máy chủ.
        if (next) setDeadline(Date.now() + (next.secondsLeft ?? 300) * 1000)
      } catch { /* lần sau hỏi lại */ }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  useEffect(() => {
    if (!invite) return
    setError(null)
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [invite])

  if (!invite || PLAYING.test(pathname)) return null
  const left = Math.max(0, Math.ceil((deadline - now) / 1000))
  if (deadline > 0 && left === 0) return null

  const accept = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await challengeApi.accept(invite.challengeId)
      handled.current.add(invite.challengeId)
      setInvite(null)
      navigate(`/room/${r.roomId}/lobby`)
    } catch (e) {
      setError(challengeErrorMessage(e, t('challenge.acceptFailed')))
    } finally {
      setBusy(false)
    }
  }

  const later = () => {
    handled.current.add(invite.challengeId)
    setInvite(null)
    challengeApi.decline(invite.challengeId).catch(() => { /* hết hạn thì thôi */ })
  }

  return (
    <div role="dialog" aria-label={t('challenge.inviteTitle', { name: invite.challengerName })} data-testid="challenge-invite"
         className="fixed z-40 left-3 right-3 bottom-[calc(var(--mobile-nav-h,0px)+12px)] md:left-auto md:right-6 md:bottom-6 md:w-[360px] rounded-2xl border-[3px] border-bq-ink bg-bq-white p-4 shadow-[0_6px_0_#1D2B22]">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[30px] text-bq-ink shrink-0" aria-hidden>swords</span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-display text-[17px] font-extrabold text-bq-ink leading-snug">
            {t('challenge.inviteTitle', { name: invite.challengerName })}
          </p>
          <p className="m-0 mt-1 text-[13.5px] text-bq-ink2">{t('challenge.inviteBody', { time: formatCountdown(left) })}</p>
          {error && <p data-testid="challenge-invite-error" role="alert" className="m-0 mt-1.5 text-[13px] font-bold text-[#B33A3A]">{error}</p>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-testid="challenge-later" onClick={later}
                className="py-2 rounded-bq-btn border-[3px] border-bq-ink bg-bq-white text-[15px] font-extrabold text-bq-ink">
          {t('challenge.later')}
        </button>
        <button type="button" data-testid="challenge-accept" onClick={accept} disabled={busy}
                className="py-2 rounded-bq-btn border-[3px] border-bq-ink bg-bq-amber text-[15px] font-extrabold text-bq-ink disabled:opacity-60">
          {t('challenge.accept')}
        </button>
      </div>
    </div>
  )
}
