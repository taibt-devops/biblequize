export type RoomMode =
  | 'SPEED_RACE'
  | 'BATTLE_ROYALE'
  | 'TEAM_VS_TEAM'
  | 'SUDDEN_DEATH'
  | 'GROUP_LIVE_SEQUENTIAL'

export const isSequentialMode = (mode?: string | null): boolean =>
  mode === 'GROUP_LIVE_SEQUENTIAL'

// ─────────────────────────────────────────────────────────────────────────────
// Shared domain shapes
// ─────────────────────────────────────────────────────────────────────────────

/** Question payload as broadcast to players. Anti-spoiler: the correct answer
 *  is NEVER part of this shape — it only arrives via ROUND_END /
 *  QUESTION_REVEALED (`correctIndex`). */
export type RoomQuestion = {
  id: string
  content: string
  options: string[]
  explanation?: string
  /** DTAG-1: per-question difficulty (easy/medium/hard) from QUESTION_START.
   *  Optional — AI/custom questions may omit it. */
  difficulty?: string
}

/** One scoreboard row. `playerId` == server-side User.id (identity fix
 *  d504299b — never match players by username). */
export type PlayerScore = {
  playerId: string
  username: string
  score: number
  correctAnswers: number
  totalAnswered: number
  accuracy: number
  finalRank?: number
  playerStatus?: string
  /** Phòng chơi v2: trạng thái theo mode (Sinh tồn: mạng; Đua tốc độ: chuỗi; Đấu vương: thống kê). */
  lives?: number
  answerStreak?: number
  revived?: boolean
  matchesWon?: number
  bestStreak?: number
  matchesPlayed?: number
  predictionPoints?: number
}

export interface PerPlayerAnswer {
  userId: string
  username: string
  answerIndex: number | null
  isCorrect: boolean
}

/** Lobby player snapshot (ROOM_STATE / REST GET /api/rooms/{id}). */
export type RoomPlayer = {
  id: string
  userId: string
  username: string
  avatarUrl?: string
  isReady: boolean
  score: number
  team?: string
  playerStatus?: string
  tier?: string
}

/** Room snapshot — REST GET /api/rooms/{id} (`.room`) and ROOM_STATE events. */
export type RoomDetails = {
  id: string
  roomCode: string
  roomName: string
  status: 'LOBBY' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED'
  mode: string
  isPublic: boolean
  maxPlayers: number
  currentPlayers: number
  questionCount: number
  timePerQuestion: number
  hostId: string
  hostName: string
  players: RoomPlayer[]
  questionSource?: 'DATABASE' | 'CUSTOM'
  questionSetId?: string | null
  bookScope?: string
  difficulty?: string
  createdAt?: string
  /** Owning group when room was spawned from a group quiz set; null otherwise.
   *  Server-side fallback so "back to group" works for users who joined via
   *  room code (no fromGroupId in nav state) or after a page refresh. */
  groupId?: string | null
  /** Group quiz set context — populated when room.groupQuizSetId is set.
   *  Lobby + quiz screens render "📚 Đang chơi: {name}" pill. */
  groupQuizSetId?: string | null
  groupQuizSetName?: string | null
  quizSetTotalQuestions?: number | null
  /** Sprint 4: false = Quản trò mode (host orchestrates only). Defaults
   *  true on the FE for legacy rooms whose payload omits the field. */
  hostPlaysGame?: boolean
  /** QP-10 (Đấu Nhanh): true = soft-host quick match room. No Quản trò,
   *  any player can hit Start once ≥2 players are ready. */
  quickMatch?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// STOMP event payloads (FMR-1)
// Shapes mirror what the FE actually reads from /topic/room/{id} today —
// do NOT "fix" them here without a matching backend change.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionStartData {
  questionIndex: number
  totalQuestions: number
  question: RoomQuestion
  timeLimit: number
  /** Server broadcast timestamp (Sprint 2 S2-5 timer anchor). Optional for
   *  older servers / dev fixtures — FE falls back to local clock. */
  startedAtMs?: number
  /** PCV-11: hệ số điểm của câu (câu chốt Đua tốc độ = 2). */
  multiplier?: number
  /** PCV-12: Sinh tồn — vùng nguy hiểm (thời gian rút ngắn). */
  dangerZone?: boolean
  /** PCV-12: Sinh tồn — câu quyết định. */
  showdown?: boolean
}

export interface SequentialProgressData {
  answered: number
  total: number
}

export interface QuestionRevealedData {
  correctIndex: number
  explanation?: string
  answers: PerPlayerAnswer[]
  leaderboard: PlayerScore[]
}

/** PCV-2: câu gốc của câu hỏi — công bố cùng đáp án. `book` là khoá sách tiếng Anh ("Genesis"). */
export interface RoundReference {
  book: string
  chapter?: number | null
  verseStart?: number | null
  verseEnd?: number | null
}

/** PCV-2: kết quả một người trong vòng — chỉ có sau khi vòng đóng. */
export interface RoundPlayerResult {
  playerId: string
  answered: boolean
  isCorrect: boolean
  pointsEarned: number
  /** Chuỗi đúng liên tiếp sau câu này (Đua tốc độ); 0 nếu mode không dùng. */
  streak: number
}

export interface RoundEndData {
  correctIndex: number
  leaderboard: PlayerScore[]
  explanation?: string | null
  reference?: RoundReference | null
  /** Số người chọn từng phương án (index = phương án). */
  answerCounts?: number[]
  results?: RoundPlayerResult[]
}

/** SCORE_UPDATE carries a full scoreboard row (player view merges it into
 *  `scores`) plus `newScore` (host view reads only that). */
export type ScoreUpdateData = PlayerScore & { newScore: number }

export interface PlayerEliminatedData {
  userId: string
  username: string
  rank: number
  activeRemaining: number
}

export interface BattleRoyaleUpdateData {
  activeCount: number
  totalCount: number
}

export interface TeamAssignmentData {
  players: { userId: string; username: string; team: string }[]
}

export interface TeamScoreUpdateData {
  scoreA: number
  scoreB: number
}

export interface PerfectRoundData {
  teamAPerfect: boolean
  teamBPerfect: boolean
}

export interface MatchStartData {
  championId: string
  championName: string
  championStreak: number
  challengerId: string
  challengerName: string
  queueRemaining: number
}

export interface MatchEndData {
  winnerId: string
  winnerName: string
  winnerNewStreak: number
  loserId: string
  loserName: string
}

export interface ReactionData {
  senderId: string
  senderName: string
  reaction: string
}

/** PCV-2 (chống lộ đáp án): chỉ báo "đã trả lời" — đúng/sai và điểm chỉ có ở ROUND_END. */
export interface AnswerSubmittedData {
  playerId: string
  username: string
  questionIndex?: number
  answered?: boolean
}

/** QUIZ_END payload varies per mode:
 *    Battle Royale  → { finalResults: PlayerScore[] }
 *    Team vs Team   → { leaderboard|finalResults: PlayerScore[]; teamWinner; scoreA; scoreB }
 *    Sudden Death   → PlayerScore[]  OR  { finalResults: PlayerScore[] }
 *    Speed Race     → same shape as Sudden Death */
export interface QuizEndSummary {
  finalResults?: PlayerScore[]
  leaderboard?: PlayerScore[]
  teamWinner?: string | null
  scoreA?: number
  scoreB?: number
}
export type QuizEndData = PlayerScore[] | QuizEndSummary

export interface RoomEndedData {
  reason?: string
}

export interface HostChangedData {
  newHostId?: string
  newHostName?: string
}

export interface HostBroadcastData {
  hostName?: string
  message?: string
}

export interface ChatMessageData {
  sender: string
  text: string
  isSystem?: boolean
}

export interface GameStartingData {
  countdown: number
}

export interface PlayerJoinedData {
  username?: string
}

export interface PlayerLeftData {
  userId?: string
}

export interface PlayerKickedData {
  userId?: string
}

export interface PlayerReadyData {
  username?: string
  isReady?: boolean
}

export interface PlayerUnreadyData {
  username?: string
}

/** Discriminated union over every event the FE parses from /topic/room/{id}.
 *  Events the BE may broadcast but no view consumes yet keep `unknown`
 *  payloads (don't invent shapes the code never reads). */
export type RoomEvent =
  // ── Core gameplay ──
  | { type: 'QUESTION_START'; data: QuestionStartData }
  | { type: 'ROUND_END'; data: RoundEndData }
  | { type: 'QUESTION_REVEALED'; data: QuestionRevealedData }
  | { type: 'ANSWER_SUBMITTED'; data: AnswerSubmittedData }
  | { type: 'SCORE_UPDATE'; data: ScoreUpdateData }
  | { type: 'LEADERBOARD_UPDATE'; data: PlayerScore[] }
  | { type: 'SEQUENTIAL_PROGRESS'; data: SequentialProgressData }
  | { type: 'NEXT_QUESTION'; data?: unknown }
  // ── Per-mode ──
  | { type: 'PLAYER_ELIMINATED'; data: PlayerEliminatedData }
  | { type: 'BATTLE_ROYALE_UPDATE'; data: BattleRoyaleUpdateData }
  | { type: 'TEAM_ASSIGNMENT'; data: TeamAssignmentData }
  | { type: 'TEAM_SCORE_UPDATE'; data: TeamScoreUpdateData }
  | { type: 'PERFECT_ROUND'; data: PerfectRoundData }
  | { type: 'MATCH_START'; data: MatchStartData }
  | { type: 'MATCH_END'; data: MatchEndData }
  | { type: 'SD_QUEUE_UPDATE'; data?: unknown }
  // ── Lifecycle ──
  | { type: 'QUIZ_END'; data?: QuizEndData }
  | { type: 'ROOM_ENDED'; data?: RoomEndedData }
  | { type: 'ROOM_STATE'; data: RoomDetails }
  | { type: 'ROOM_STARTING'; data?: unknown }
  | { type: 'GAME_STARTING'; data: GameStartingData }
  // ── Host control echoes (Sprint 4 S4-9) ──
  | { type: 'GAME_PAUSED'; data?: unknown }
  | { type: 'GAME_RESUMED'; data?: unknown }
  | { type: 'QUESTION_SKIPPED'; data?: unknown }
  | { type: 'HOST_BROADCAST'; data?: HostBroadcastData }
  // ── Social ──
  | { type: 'CHAT_MESSAGE'; data: ChatMessageData }
  | { type: 'REACTION'; data: ReactionData }
  // ── Lobby ──
  | { type: 'PLAYER_JOINED'; data?: PlayerJoinedData }
  | { type: 'PLAYER_LEFT'; data?: PlayerLeftData }
  | { type: 'PLAYER_KICKED'; data?: PlayerKickedData }
  | { type: 'PLAYER_READY'; data?: PlayerReadyData }
  | { type: 'PLAYER_UNREADY'; data?: PlayerUnreadyData }
  | { type: 'HOST_CHANGED'; data?: HostChangedData }
  | { type: 'ERROR'; data?: unknown }

/** All event type strings (handy for guards / exhaustiveness checks). */
export type RoomEventType = RoomEvent['type']

// WS event type strings (mirror backend WebSocketMessage.MessageTypes)
export const WS_SEQUENTIAL_PROGRESS = 'SEQUENTIAL_PROGRESS'
export const WS_QUESTION_REVEALED = 'QUESTION_REVEALED'
export const WS_NEXT_QUESTION = 'NEXT_QUESTION'
