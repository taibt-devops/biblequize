// QP-11 — Frontend helpers for the Đấu Nhanh (Quick Match) flow.
// Wraps POST /api/rooms/quick-match with typed config + canonical error
// codes from QP-2. Error toaster expects a `(msg: string, severity?:
// 'info'|'warning'|'error') => void` callback so the caller can use any
// notification system (toast lib, ErrorContext, alert, etc.).

import { api } from './client'

export type QuickMatchMode = 'SPEED_RACE' | 'BATTLE_ROYALE' | 'TEAM_VS_TEAM' | 'SUDDEN_DEATH'
/** AIR-1 (13/10/2026): chỉ còn kho câu đã biên tập — không còn câu do AI sinh. */
export type QuickMatchSource = 'DATABASE'

export interface QuickMatchConfig {
  mode: QuickMatchMode
  bookScope: string         // 'ALL' | 'OLD_TESTAMENT' | 'NEW_TESTAMENT' | 'GOSPELS' | book name
  questionCount: number     // 5–20
  timePerQuestion: number   // 10–60
  maxPlayers?: number       // 2–100 (default 10); host cap for the lobby
  source: QuickMatchSource
  language?: 'vi' | 'en'
}

export interface QuickMatchResponse {
  success: true
  room: { id: string; roomCode: string; mode: string; quickMatch: boolean; [k: string]: unknown }
  viewerUserId: string
  quickMatch: true
  remainingToday: number
}

export interface QuickMatchError {
  success: false
  error: 'ALREADY_IN_ANOTHER_ROOM' | string
  message: string
  remaining?: number
  currentTier?: number
}

export async function triggerQuickMatch(config: QuickMatchConfig): Promise<QuickMatchResponse> {
  const res = await api.post('/api/rooms/quick-match', config)
  return res.data as QuickMatchResponse
}

/** Maps known quick-match error codes to friendly Vietnamese messages.
 *  Returns the message string; caller surfaces via toast / inline error. */
export function describeQuickMatchError(error: unknown): { code: string; message: string } {
  const data = (error as { response?: { data?: QuickMatchError } })?.response?.data
  const code = data?.error ?? 'UNKNOWN'
  switch (code) {
    case 'ALREADY_IN_ANOTHER_ROOM':
      return { code, message: 'Bạn đang trong phòng khác. Hãy rời phòng cũ trước.' }
    default:
      return { code, message: data?.message ?? 'Không thể vào trận. Vui lòng thử lại.' }
  }
}
