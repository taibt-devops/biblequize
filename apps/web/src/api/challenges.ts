// PCV-23 — Thách đấu bạn bè (design §3.3): thách một người ở Bảng xếp hạng; người kia nhận lời
// ⇒ cả hai vào sảnh một phòng Đua tốc độ 10 câu. expiresAt là giờ máy chủ không kèm múi giờ,
// nên đếm ngược theo secondsLeft (máy chủ tính).
import { api } from './client'

export type ChallengeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED'

export interface ChallengeCreated {
  challengeId: string
  status: ChallengeStatus
  secondsLeft?: number
}

export interface ChallengeView {
  challengeId: string
  status: ChallengeStatus
  roomId?: string | null
  challengerName?: string
  challengedName?: string
  secondsLeft?: number
}

export interface PendingChallenge {
  challengeId: string
  challengerName: string
  challengerId: string
  secondsLeft?: number
}

export const challengeApi = {
  create: (challengedUserId: string) =>
    api.post<ChallengeCreated>('/api/challenges', { challengedUserId }).then(r => r.data),
  get: (id: string) => api.get<ChallengeView>(`/api/challenges/${id}`).then(r => r.data),
  cancel: (id: string) => api.post(`/api/challenges/${id}/cancel`).then(r => r.data),
  pending: () => api.get<PendingChallenge[]>('/api/challenges/pending').then(r => r.data),
  accept: (id: string) =>
    api.post<{ roomId: string; roomCode: string }>(`/api/challenges/${id}/accept`).then(r => r.data),
  decline: (id: string) => api.post(`/api/challenges/${id}/decline`).then(r => r.data),
}

/** Lời thách sống 5 phút: "4:59". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Thông báo lỗi máy chủ trả về ({ error }) — hoặc câu dự phòng. */
export function challengeErrorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof msg === 'string' && msg.trim() ? msg : fallback
}
