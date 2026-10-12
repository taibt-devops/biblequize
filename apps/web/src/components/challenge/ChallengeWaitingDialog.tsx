import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Modal from '../ui/Modal'
import { challengeApi, formatCountdown, type ChallengeStatus } from '../../api/challenges'

interface Props {
  challengeId: string
  /** Tên người được thách. */
  name: string
  /** Số giây còn lại máy chủ báo lúc gửi lời thách. */
  secondsLeft: number
  onClose: () => void
}

const POLL_MS = 3000

/**
 * PCV-23 — người thách chờ người kia nhận lời: hỏi máy chủ mỗi 3 giây; nhận lời ⇒ vào sảnh phòng
 * thách đấu. Đóng hộp khi đang chờ = hủy lời thách (không ai còn theo dõi lời thách đó nữa).
 */
export default function ChallengeWaitingDialog({ challengeId, name, secondsLeft, onClose }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const deadline = useRef(Date.now() + secondsLeft * 1000)
  const [left, setLeft] = useState(secondsLeft)
  const [status, setStatus] = useState<ChallengeStatus>('PENDING')
  const [cancelling, setCancelling] = useState(false)

  const check = useCallback(async () => {
    const view = await challengeApi.get(challengeId)
    if (typeof view.secondsLeft === 'number') deadline.current = Date.now() + view.secondsLeft * 1000
    if (view.status === 'ACCEPTED' && view.roomId) {
      navigate(`/room/${view.roomId}/lobby`)
      return view.status
    }
    if (view.status !== 'PENDING') setStatus(view.status)
    return view.status
  }, [challengeId, navigate])

  useEffect(() => {
    if (status !== 'PENDING') return
    let alive = true
    const poll = () => { if (alive) check().catch(() => { /* mạng chập chờn — lần sau hỏi lại */ }) }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [status, check])

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 1000)
    return () => clearInterval(id)
  }, [])

  const cancel = async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      await challengeApi.cancel(challengeId)
      onClose()
    } catch {
      // Hủy không được: có thể người kia vừa nhận lời — hỏi lại một lần rồi mới đóng.
      const now = await check().catch(() => null)
      if (now !== 'ACCEPTED') onClose()
    }
  }

  const waiting = status === 'PENDING' && left > 0
  const declined = status === 'DECLINED'

  return (
    <Modal isOpen onClose={waiting ? cancel : onClose} size="sm" closeOnBackdropClick={false}
           showCloseButton={false} ariaLabel={t('challenge.waitingTitle', { name })}>
      {waiting ? (
        <div data-testid="challenge-waiting" className="text-center space-y-3">
          <span className="material-symbols-outlined text-[40px] text-bq-ink" aria-hidden>swords</span>
          <h3 className="m-0 font-display text-[21px] font-extrabold text-bq-ink">{t('challenge.waitingTitle', { name })}</h3>
          <p className="m-0 text-[14.5px] text-bq-ink2">{t('challenge.waitingBody')}</p>
          <p className="m-0 font-display text-[30px] font-extrabold text-bq-ink tabular-nums">{formatCountdown(left)}</p>
          <button type="button" data-testid="challenge-cancel" onClick={cancel} disabled={cancelling}
                  className="w-full py-2.5 rounded-bq-btn border-[3px] border-bq-ink bg-bq-white text-[15px] font-extrabold text-bq-ink disabled:opacity-60">
            {t('challenge.cancel')}
          </button>
        </div>
      ) : (
        <div data-testid={declined ? 'challenge-declined' : 'challenge-expired'} className="text-center space-y-3" role="status">
          <span className="material-symbols-outlined text-[40px] text-bq-ink2" aria-hidden>hourglass_bottom</span>
          <p className="m-0 font-display text-[19px] font-extrabold text-bq-ink">
            {declined ? t('challenge.declined', { name }) : t('challenge.expired', { name })}
          </p>
          <button type="button" data-testid="challenge-close" onClick={onClose}
                  className="w-full py-2.5 rounded-bq-btn border-[3px] border-bq-ink bg-bq-amber text-[15px] font-extrabold text-bq-ink">
            {t('challenge.close')}
          </button>
        </div>
      )}
    </Modal>
  )
}
