import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { PlaceBackdrop, lkClass } from '../components/lk/Place'

/**
 * QR landing page — quét QR mã `/room/join?code=ABC123` → auto-join phòng.
 *
 * Trước 2026-05-23: file này chỉ `<Navigate to="/multiplayer" replace />`
 * → mất luôn `?code=` → user quét QR ra empty Multiplayer page, không vào
 * được phòng (bug user report). Giờ:
 *   1. Đọc `?code=` từ search params.
 *   2. Nếu thiếu code → redirect /multiplayer (giữ behavior cũ cho stale link).
 *   3. Có code → POST /api/rooms/join → navigate /room/{id}/lobby (hoặc /quiz
 *      nếu IN_PROGRESS).
 *   4. Lỗi → hiện message + nút back về /multiplayer.
 *
 * `RequireAuth` đã wrap route ở main.tsx — chưa đăng nhập sẽ bị redirect
 * /login trước khi component này mount, sau đó user quay lại đúng URL có code.
 */
export default function JoinRoom() {
  const [params] = useSearchParams()
  const code = params.get('code')?.trim().toUpperCase() ?? ''
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(true)

  useEffect(() => {
    if (!code) {
      setJoining(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.post('/api/rooms/join', { roomCode: code })
        if (cancelled) return
        const room = res.data.room
        const target = room.status === 'IN_PROGRESS' ? 'quiz' : 'lobby'
        navigate(`/room/${room.id}/${target}`, {
          state: { room, mode: room.mode, viewerUserId: res.data.viewerUserId },
          replace: true,
        })
      } catch (err: unknown) {
        if (cancelled) return
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Không thể vào phòng. Mã không hợp lệ hoặc phòng đã đầy.'
        setError(message)
        setJoining(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, navigate])

  // No code → fall back to old behavior.
  if (!code) return <Navigate to="/multiplayer" replace />

  return (
    <div className="relative min-h-[60vh] flex items-center justify-center px-6">
      <PlaceBackdrop place="square" veil="strong" />
      <div className="max-w-sm w-full text-center space-y-4 p-7 bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
        {joining ? (
          <>
            <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className={`mx-auto h-16 ${lkClass.bob}`} />
            <div className="text-[14px] font-bold text-bq-ink2">
              Đang vào phòng
            </div>
            <div className="flex justify-center gap-1.5" aria-label={code}>
              {code.split('').map((c, i) => (
                <span key={i} aria-hidden className="w-10 h-11 grid place-items-center rounded-xl bg-bq-paper border-[3px] border-bq-ink text-[20px] font-extrabold">{c}</span>
              ))}
            </div>
            <div className="font-read text-[15px] text-bq-ink2">
              Vui lòng chờ trong giây lát…
            </div>
          </>
        ) : (
          <>
            <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="mx-auto h-28" />
            <div className="text-[14px] font-extrabold text-bq-ruby">
              Không vào được phòng
            </div>
            <div className="font-read text-[16px] font-bold text-bq-ink">{error}</div>
            <button
              type="button"
              onClick={() => navigate('/multiplayer', { replace: true })}
              className="lk-btn mt-2 text-bq-ink text-[16px]"
            >
              Về Multiplayer
            </button>
          </>
        )}
      </div>
    </div>
  )
}
