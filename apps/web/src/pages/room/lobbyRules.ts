import { playerLimits } from '../create-room/modeMeta'

export interface LobbyPlayer {
  userId: string
  isReady: boolean
  team?: string
  /** PCV-20: người máy (luôn sẵn sàng). */
  isBot?: boolean
}

export interface LobbyCheckInput {
  mode: string
  /** RoomPlayer của phòng — Quản trò không nằm trong đây. */
  players: LobbyPlayer[]
  hostId: string
  hostPlaysGame: boolean
  quickMatch: boolean
  /** Đấu nhanh: người đang xem (người sẽ bấm bắt đầu) được coi là sẵn sàng. */
  viewerUserId?: string | null
}

export interface LobbyCheck {
  canStart: boolean
  /** Khóa i18n mô tả lý do chưa bắt đầu được (null khi đủ điều kiện). */
  reason: string | null
  params?: Record<string, string | number>
}

/**
 * PCV-5 — sảnh chờ có bắt đầu được chưa. Cùng luật với `RoomModeRules.startError` +
 * kiểm sẵn sàng của `RoomService.startRoom` phía máy chủ, để nút "Bắt đầu" không sáng
 * khi máy chủ sẽ từ chối.
 */
export function lobbyStartCheck(input: LobbyCheckInput): LobbyCheck {
  const { mode, players, hostId, quickMatch, viewerUserId } = input
  const { min } = playerLimits(mode)
  const count = players.length
  // PCV-20: người máy không tự chơi với nhau — cần ít nhất một người thật (giống RoomModeRules).
  if (count > 0 && players.every(p => p.isBot)) {
    return { canStart: false, reason: 'room.lobbyRules.needHuman' }
  }
  if (count < min) {
    return { canStart: false, reason: 'room.lobbyRules.needPlayers', params: { need: min - count, min } }
  }
  if (mode === 'TEAM_VS_TEAM') {
    const a = players.filter(p => p.team === 'A').length
    const b = players.filter(p => p.team === 'B').length
    if (a < 2 || b < 2) return { canStart: false, reason: 'room.lobbyRules.teamTooSmall' }
    const diff = Math.abs(a - b)
    if (diff > 1) return { canStart: false, reason: 'room.lobbyRules.teamsUnbalanced', params: { diff } }
  }
  if (mode !== 'GROUP_LIVE_SEQUENTIAL') {
    // Người bấm bắt đầu được coi là sẵn sàng: chủ phòng (phòng thường) hoặc chính mình (Đấu nhanh).
    const starter = quickMatch ? (viewerUserId ?? hostId) : hostId
    const others = players.filter(p => p.userId !== starter)
    const ready = others.filter(p => p.isReady).length
    if (ready < others.length) {
      return { canStart: false, reason: 'room.lobbyRules.waitingReady', params: { ready, total: others.length } }
    }
  }
  return { canStart: true, reason: null }
}
