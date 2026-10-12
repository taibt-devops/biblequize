// CRR-1 — Mode metadata for the redesigned Create Room page.
// Mirrors the colour palette from docs/MULTIPLAYER/create_room_redesign.html
// (slightly lighter than the legacy CreateRoom palette so the preview badges
// + mode-card tints read clearly against the dark surface).

/** The 4 user-selectable modes (Create Room / Quick Match pickers). */
export type RoomModeId = 'SPEED_RACE' | 'BATTLE_ROYALE' | 'TEAM_VS_TEAM' | 'SUDDEN_DEATH'

/** Every room mode incl. backend-spawned ones (FMR-6 / F-web-5):
 *  GROUP_LIVE_SEQUENTIAL rooms are only created via the group co-play API,
 *  never from the Create Room form. */
export type AnyRoomModeId = RoomModeId | 'GROUP_LIVE_SEQUENTIAL'

/** Defaults to the user-selectable ids so MODE_LIST consumers keep seeing
 *  `id: RoomModeId`; the backend-spawned entry narrows Id itself. */
export interface ModeMeta<Id extends AnyRoomModeId = RoomModeId> {
  id: Id
  /** Material Symbols icon name. */
  icon: string
  /** PCV-9 — emoji cùng nghĩa với icon, cho chỗ không dùng font icon (đếm ngược, banner nhóm). */
  emoji: string
  /** i18n key for the mode display label (e.g. "Đua tốc độ"). */
  labelKey: string
  /** i18n key for the per-mode description shown under the mode grid. */
  descKey: string
  /** Hex accent used for mode-card border + active glow + description left-bar. */
  color: string
  /** Preview-badge palette (matches `.badge-*` rules in the mockup). */
  badge: { bg: string; fg: string; border: string }
  /** True = rooms of this mode are only spawned via backend API (group
   *  co-play); the mode is metadata-only here and excluded from MODE_LIST. */
  createdViaApi?: boolean
}

// Palette canonical per PROMPT_MULTIPLAYER_LOBBY_REDESIGN.md §0.1 — hardcoded
// hex values (NEVER CSS variables, mockup rendering bug). Sudden Death =
// amber #fbbf24, NOT streak orange #fb923c.
export const MODE_META: { [K in AnyRoomModeId]: ModeMeta<K> } = {
  SPEED_RACE: {
    id: 'SPEED_RACE',
    icon: 'bolt',
    emoji: '⚡',
    labelKey: 'room.modes.speed_race',
    descKey: 'createRoom.modeDesc.speed_race',
    color: '#38bdf8',
    badge: { bg: 'rgba(56,189,248,0.15)',  fg: '#7dd3fc', border: 'rgba(56,189,248,0.35)' },
  },
  BATTLE_ROYALE: {
    id: 'BATTLE_ROYALE',
    // PCV-9: Sinh tồn = giữ mạng sống → trái tim (đợt 2 hiển thị mạng bằng tim).
    icon: 'favorite',
    emoji: '❤️',
    labelKey: 'room.modes.battle_royale',
    descKey: 'createRoom.modeDesc.battle_royale',
    color: '#ef4444',
    badge: { bg: 'rgba(239,68,68,0.15)',   fg: '#fca5a5', border: 'rgba(239,68,68,0.35)' },
  },
  TEAM_VS_TEAM: {
    id: 'TEAM_VS_TEAM',
    icon: 'groups',
    emoji: '👥',
    labelKey: 'room.modes.team_vs_team',
    descKey: 'createRoom.modeDesc.team_vs_team',
    color: '#a855f7',
    badge: { bg: 'rgba(168,85,247,0.15)',  fg: '#d8b4fe', border: 'rgba(168,85,247,0.35)' },
  },
  SUDDEN_DEATH: {
    id: 'SUDDEN_DEATH',
    // PCV-9: Đấu vương = đấu tay đôi → hai thanh kiếm.
    icon: 'swords',
    emoji: '⚔️',
    labelKey: 'room.modes.sudden_death',
    descKey: 'createRoom.modeDesc.sudden_death',
    color: '#fbbf24',
    badge: { bg: 'rgba(251,191,36,0.15)',  fg: '#fcd34d', border: 'rgba(251,191,36,0.35)' },
  },
  // FMR-6 (F-web-5): backend-spawned group co-play mode. Metadata only —
  // createdViaApi keeps it out of MODE_LIST so the Create Room / Quick Match
  // pickers stay at 4 user-selectable modes. Palette matches the lobby's
  // MODE_INFO entry (violet #a78bfa).
  GROUP_LIVE_SEQUENTIAL: {
    id: 'GROUP_LIVE_SEQUENTIAL',
    icon: 'group',
    emoji: '📚',
    labelKey: 'room.modes.group_live_sequential',
    descKey: 'createRoom.modeDesc.group_live_sequential',
    color: '#a78bfa',
    badge: { bg: 'rgba(167,139,250,0.15)', fg: '#c4b5fd', border: 'rgba(167,139,250,0.35)' },
    createdViaApi: true,
  },
}

/** PCV-9 — metadata theo mã mode bất kỳ (kể cả mã lạ → undefined). */
export function modeMetaOf(mode: string | null | undefined): ModeMeta<AnyRoomModeId> | undefined {
  return MODE_META[(mode ?? '') as AnyRoomModeId]
}

/** PCV-9 — tên hiển thị duy nhất của một mode ở mọi màn (sảnh, danh sách phòng,
 *  Đấu nhanh, banner nhóm). Mã lạ thì trả lại chính mã để không mất thông tin. */
export function modeDisplayName(t: (key: string) => string, mode: string | null | undefined): string {
  const meta = modeMetaOf(mode)
  return meta ? t(meta.labelKey) : (mode ?? '')
}

/** PCV-9 — khóa i18n luật chơi: room.rules.<slug>.short / .detail. */
export function modeRulesSlug(mode: string | null | undefined): string | null {
  const meta = modeMetaOf(mode)
  return meta ? meta.labelKey.split('.').pop() ?? null : null
}

/** User-selectable modes only — GROUP_LIVE_SEQUENTIAL (createdViaApi) is
 *  intentionally excluded. */
export const MODE_LIST: ModeMeta[] = [
  MODE_META.SPEED_RACE,
  MODE_META.BATTLE_ROYALE,
  MODE_META.TEAM_VS_TEAM,
  MODE_META.SUDDEN_DEATH,
]

/** PCV-5 — số người tối thiểu/tối đa theo mode. Bản sao của RoomModeRules phía máy chủ
 *  (Đấu vương tối đa 12 — DECISIONS 2026-10-12). */
export const MODE_PLAYER_LIMITS: Record<AnyRoomModeId, { min: number; max: number }> = {
  SPEED_RACE:            { min: 2, max: 100 },
  BATTLE_ROYALE:         { min: 3, max: 100 },
  TEAM_VS_TEAM:          { min: 4, max: 100 },
  SUDDEN_DEATH:          { min: 3, max: 12 },
  GROUP_LIVE_SEQUENTIAL: { min: 2, max: 100 },
}

export function playerLimits(mode: string | undefined | null): { min: number; max: number } {
  return MODE_PLAYER_LIMITS[(mode ?? 'SPEED_RACE') as AnyRoomModeId] ?? MODE_PLAYER_LIMITS.SPEED_RACE
}

/** Default per-mode cadence + cap (SPEC §5.4). Kept in-sync with the BE
 *  expectations — values match the old MODE_DEFAULTS in CreateRoom.tsx. */
export const MODE_DEFAULTS: Record<RoomModeId, { questionCount: number; timePerQuestion: number; maxPlayers: number }> = {
  SPEED_RACE:    { questionCount: 15, timePerQuestion: 30, maxPlayers: 4 },
  BATTLE_ROYALE: { questionCount: 20, timePerQuestion: 20, maxPlayers: 8 },
  TEAM_VS_TEAM:  { questionCount: 15, timePerQuestion: 30, maxPlayers: 8 },
  SUDDEN_DEATH:  { questionCount: 20, timePerQuestion: 15, maxPlayers: 8 },
}
