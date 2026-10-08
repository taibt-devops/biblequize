import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

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
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        {joining ? (
          <>
            <div className="text-[12.5px] text-bq-ink2">
              Đang vào phòng
            </div>
            <div className="text-2xl font-extrabold text-bq-ink">{code}</div>
            <div className="text-sm text-bq-ink2">
              Vui lòng chờ trong giây lát…
            </div>
          </>
        ) : (
          <>
            <div className="text-[12.5px] text-bq-ruby">
              Không vào được phòng
            </div>
            <div className="text-base font-semibold text-bq-ink">{error}</div>
            <button
              type="button"
              onClick={() => navigate('/multiplayer', { replace: true })}
              className="mt-2 inline-flex items-center justify-center h-10 px-5 rounded-lg bg-bq-action text-bq-ink shadow-bq-action text-sm font-bold"
            >
              Về Multiplayer
            </button>
          </>
        )}
      </div>
    </div>
  )
}
