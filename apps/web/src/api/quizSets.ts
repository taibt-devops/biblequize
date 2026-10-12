import { api } from './client'

export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SOFT_DELETED'
export type QuizSetDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED'
export type RoomMode =
  | 'SPEED_RACE' | 'BATTLE_ROYALE' | 'TEAM_VS_TEAM'
  | 'SUDDEN_DEATH' | 'GROUP_LIVE_SEQUENTIAL'

export interface QuizSet {
  id: string
  groupId: string
  name: string
  questionIds: string[]
  totalQuestions: number
  createdBy: string
  createdAt: string
  updatedAt?: string
  language: string
  description?: string | null
  coverImageUrl?: string | null
  tags?: string[] | null
  coverScripture?: string | null
  authorNote?: string | null
  difficulty?: QuizSetDifficulty | null
  estimatedDurationMin?: number | null
  suggestedMode?: RoomMode | null
  playCount: number
  averageRating?: number | null
  totalRatings: number
  lastPlayedAt?: string | null
  publishStatus: PublishStatus
  publishedAt?: string | null
  archivedAt?: string | null
  folderId?: string | null
}

export interface QuizSetMastery {
  id: string | null
  quizSetId: string
  userId: string
  questionsLearned: number
  totalAttempts: number
  bestScore: number
  bestAccuracy?: number | null
  lastPracticedAt?: string | null
  completedMastery: boolean
  completedMasteryAt?: string | null
}

export interface ListQuizSetsParams {
  status?: PublishStatus
  folder?: string | null
  search?: string
  sort?: 'popular' | 'recent' | 'name' | 'rating'
  page?: number
  size?: number
}

export interface ListQuizSetsResponse {
  quizSets: QuizSet[]
  page: number
  totalElements: number
  totalPages: number
}

export async function listQuizSets(groupId: string, params?: ListQuizSetsParams): Promise<ListQuizSetsResponse> {
  const res = await api.get(`/api/groups/${groupId}/quiz-sets`, { params })
  return res.data
}

export async function getQuizSet(groupId: string, setId: string): Promise<QuizSet> {
  // BE không có endpoint by-id riêng cho metadata; /full trả về metadata + questions
  // trong một round-trip. Detail page chỉ dùng metadata; extra `questions` field harmless.
  const res = await api.get(`/api/groups/${groupId}/quiz-sets/${setId}/full`)
  return res.data.quizSet
}

export interface CreateQuizSetBody {
  name: string
  questionIds?: string[]
  description?: string
  coverImageUrl?: string
  tags?: string[]
  coverScripture?: string
  authorNote?: string
  suggestedMode?: RoomMode
  folderId?: string | null
  language?: 'VI' | 'EN'
}

export async function createQuizSet(groupId: string, body: CreateQuizSetBody): Promise<QuizSet> {
  const res = await api.post(`/api/groups/${groupId}/quiz-sets`, body)
  return res.data.quizSet
}

export async function updateQuizSet(groupId: string, setId: string, body: Partial<CreateQuizSetBody>): Promise<QuizSet> {
  const res = await api.patch(`/api/groups/${groupId}/quiz-sets/${setId}`, body)
  return res.data.quizSet
}

export async function publishQuizSet(groupId: string, setId: string): Promise<QuizSet> {
  const res = await api.patch(`/api/groups/${groupId}/quiz-sets/${setId}/publish`)
  return res.data.quizSet
}

export async function archiveQuizSet(groupId: string, setId: string): Promise<QuizSet> {
  const res = await api.patch(`/api/groups/${groupId}/quiz-sets/${setId}/archive`)
  return res.data.quizSet
}

export async function unarchiveQuizSet(groupId: string, setId: string): Promise<QuizSet> {
  const res = await api.patch(`/api/groups/${groupId}/quiz-sets/${setId}/unarchive`)
  return res.data.quizSet
}

export async function cloneQuizSet(groupId: string, setId: string): Promise<QuizSet> {
  const res = await api.post(`/api/groups/${groupId}/quiz-sets/${setId}/clone`)
  return res.data.quizSet
}

export async function deleteQuizSet(groupId: string, setId: string): Promise<QuizSet> {
  const res = await api.delete(`/api/groups/${groupId}/quiz-sets/${setId}`)
  return res.data.quizSet
}

export async function getMyMastery(groupId: string, setId: string): Promise<QuizSetMastery> {
  const res = await api.get(`/api/groups/${groupId}/quiz-sets/${setId}/my-mastery`)
  return res.data.mastery
}

export async function getMyMasteries(groupId: string): Promise<QuizSetMastery[]> {
  const res = await api.get(`/api/groups/${groupId}/my-masteries`)
  return res.data.masteries
}

export interface QuizSetFolder {
  id: string
  groupId: string
  name: string
  color?: string | null
  displayOrder: number
  createdBy: string
  createdAt: string
}

export async function listFolders(groupId: string): Promise<QuizSetFolder[]> {
  const res = await api.get(`/api/groups/${groupId}/quiz-set-folders`)
  return res.data.folders
}

export async function createFolder(groupId: string, name: string, color?: string): Promise<QuizSetFolder> {
  const res = await api.post(`/api/groups/${groupId}/quiz-set-folders`, { name, color })
  return res.data.folder
}

export async function deleteFolder(groupId: string, folderId: string): Promise<void> {
  await api.delete(`/api/groups/${groupId}/quiz-set-folders/${folderId}`)
}


export interface QuizSetAttempt {
  sessionId: string
  score: number
  correctAnswers: number
  totalQuestions: number
  accuracy: number
  completedAt: string
}

export interface QuizSetMasterySummary {
  totalAttempts: number
  bestScore: number
  bestAccuracy: number | null
  learnedQuestionsCount: number
}

export async function getMyAttempts(groupId: string, setId: string): Promise<{
  attempts: QuizSetAttempt[]
  masterySummary: QuizSetMasterySummary
}> {
  const res = await api.get(`/api/groups/${groupId}/quiz-sets/${setId}/my-attempts`)
  return { attempts: res.data.attempts, masterySummary: res.data.masterySummary }
}

export interface QuizSetLeaderboardEntry {
  rank: number
  userId: string
  displayName: string | null
  avatarUrl: string | null
  bestScore: number
  bestAccuracy: number | null
  totalAttempts: number
  lastPlayedAt: string | null
}

export async function getQuizSetLeaderboard(groupId: string, setId: string, limit = 20): Promise<{
  entries: QuizSetLeaderboardEntry[]
  myRank: number | null
  totalParticipants: number
}> {
  const res = await api.get(`/api/groups/${groupId}/quiz-sets/${setId}/leaderboard`, { params: { limit } })
  return {
    entries: res.data.entries,
    myRank: res.data.myRank ?? null,
    totalParticipants: res.data.totalParticipants,
  }
}

/**
 * Co-play "Chơi cùng nhau" — Speed Race mode only (locked decision).
 * Calls existing /play endpoint that creates a Room with customQuestionIds
 * pre-loaded from the quiz set + groupQuizSetId set.
 * Member-only (BE enforces); returns room id + roomCode for FE to navigate.
 */
export async function playQuizSetCoPlay(groupId: string, setId: string): Promise<{
  id: string
  roomCode: string
  roomName: string
}> {
  const res = await api.post(`/api/groups/${groupId}/quiz-sets/${setId}/play`)
  return res.data.room
}

export async function createLiveRoomFromQuizSet(
  groupId: string,
  body: { quizSetId: string; mode?: RoomMode; timePerQuestion?: number }
) {
  const res = await api.post(`/api/groups/${groupId}/live-rooms`, body)
  return res.data.room
}

export const MODE_LABELS: Record<RoomMode, {
  vi: string; emoji: string; min: number; even?: boolean;
  cssClass: string; tagline: string;
}> = {
  // PCV-9: cùng tên + emoji với modeMeta (sảnh chờ, danh sách phòng).
  SPEED_RACE:           { vi: 'Đua tốc độ',     emoji: '⚡',  min: 1,  cssClass: 'qs-mode-speed', tagline: 'Vui nhộn · Thi tốc độ trả lời đúng' },
  GROUP_LIVE_SEQUENTIAL:{ vi: 'Chơi cùng nhau', emoji: '📚',  min: 1,  cssClass: 'qs-mode-seq',   tagline: 'Lớp học · Cả nhóm xem đáp án cùng lúc' },
  TEAM_VS_TEAM:         { vi: 'Đội đấu đội',    emoji: '👥', min: 6, even: true, cssClass: 'qs-mode-team', tagline: 'Đối kháng · 2 đội thi với nhau' },
  BATTLE_ROYALE:        { vi: 'Sinh tồn',       emoji: '❤️',  min: 4,  cssClass: 'qs-mode-br',    tagline: 'Kịch tính · Sai là loại' },
  SUDDEN_DEATH:         { vi: 'Đấu vương',      emoji: '⚔️',  min: 10, cssClass: 'qs-mode-sd',    tagline: 'Tay đôi · Thắng thì giữ ngai' },
}

export function getModeAvailability(mode: RoomMode, total: number): { available: boolean; reason?: string } {
  const cfg = MODE_LABELS[mode]
  if (total < cfg.min) return { available: false, reason: `Cần ≥${cfg.min} câu hỏi` }
  if (cfg.even && total % 2 !== 0) return { available: false, reason: `Cần số câu chẵn` }
  return { available: true }
}

// ──────────────────────────────────────────────────────────────
// BL-AD-8 — Quiz Set Editor (Phase B/C)
// ──────────────────────────────────────────────────────────────

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'
export type QuestionSource = 'admin' | 'ai-generated' | 'ai-group' | 'group-custom' | string

export interface EditorQuestion {
  id: string
  book: string
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
  difficulty: QuestionDifficulty
  type: string
  content: string
  options: string[]
  correctAnswer: number[]
  explanation: string | null
  source: QuestionSource
  language: string
}

export interface QuizSetFull extends QuizSet {
  questions: EditorQuestion[]
}

export async function getQuizSetFull(groupId: string, setId: string): Promise<QuizSetFull> {
  const res = await api.get(`/api/groups/${groupId}/quiz-sets/${setId}/full`)
  return res.data.quizSet
}

export interface AddQuestionBody {
  content?: string
  book?: string
  chapter?: number | null
  verseStart?: number | null
  verseEnd?: number | null
  difficulty?: QuestionDifficulty
  options?: string[]
  correctAnswer?: number[] | number
  explanation?: string | null
  language?: string
}

export async function addQuestion(groupId: string, setId: string, body: AddQuestionBody = {}): Promise<{
  question: EditorQuestion
  totalQuestions: number
}> {
  const res = await api.post(`/api/groups/${groupId}/quiz-sets/${setId}/questions`, body)
  return { question: res.data.question, totalQuestions: res.data.totalQuestions }
}

export async function updateQuestion(groupId: string, setId: string, qid: string, body: Partial<AddQuestionBody>): Promise<EditorQuestion> {
  const res = await api.patch(`/api/groups/${groupId}/quiz-sets/${setId}/questions/${qid}`, body)
  return res.data.question
}

export async function deleteQuestion(groupId: string, setId: string, qid: string): Promise<number> {
  const res = await api.delete(`/api/groups/${groupId}/quiz-sets/${setId}/questions/${qid}`)
  return res.data.totalQuestions
}

export async function reorderQuestions(groupId: string, setId: string, questionIds: string[]): Promise<string[]> {
  const res = await api.post(`/api/groups/${groupId}/quiz-sets/${setId}/questions/reorder`, { questionIds })
  return res.data.questionIds
}
