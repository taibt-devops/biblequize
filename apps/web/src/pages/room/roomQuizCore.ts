import type { PlayerScore, QuestionStartData, RoomQuestion, RoundPlayerResult, RoundReference, ScoreUpdateData } from '../../types/room';

// Shared render constants for the quiz shell + mode views.
export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];
export const FILL_STYLE = { fontVariationSettings: "'FILL' 1" } as const;

/**
 * FMR-4 — core (mode-agnostic) game state for the multiplayer quiz page.
 *
 * Pure reducer: STOMP side effects (sounds, haptics, feed, reveal-stats refs,
 * navigation) stay in the page-level dispatcher; per-mode state lives in the
 * FMR-3 hooks. Invariants preserved:
 *   - anti-spoiler: `correctIndex` only set by ROUND_END / QUESTION_REVEALED;
 *   - score is server-authoritative: `scores` only ever mirrors payloads.
 */
/** PCV-3: phần công bố sau mỗi câu (ROUND_END). */
export interface RoundRevealData {
  explanation?: string | null;
  reference?: RoundReference | null;
  answerCounts?: number[];
  results?: RoundPlayerResult[];
}

/** Câu vừa phát mà mốc máy chủ lệch giờ máy quá ngưỡng này ⇒ coi như đồng hồ máy lệch. */
const LIVE_SKEW_MS = 2_000;

/**
 * PCV-3 — mốc tính giờ cho câu hỏi. Dùng `startedAtMs` của máy chủ khi hợp lý; nếu đồng hồ
 * của máy người chơi lệch (mốc ở tương lai, hoặc cũ quá mức có thể) thì dùng giờ máy, để
 * bộ đếm không về 0 ngay hay vượt quá thời gian câu.
 *  - `live` = vừa nhận QUESTION_START: mốc phải cách giờ máy ≤ 2 s.
 *  - vào lại giữa câu: mốc không ở tương lai > 2 s và không cũ hơn thời gian câu + 5 s.
 */
export function anchorQuestionStart(data: QuestionStartData, nowMs: number, live: boolean): number {
  const started = data.startedAtMs;
  if (!started) return nowMs;
  const elapsed = nowMs - started;
  if (live) return Math.abs(elapsed) <= LIVE_SKEW_MS ? started : nowMs;
  if (elapsed < -LIVE_SKEW_MS || elapsed > data.timeLimit * 1000 + 5_000) return nowMs;
  return started;
}

export interface CoreGameState {
  questionIndex: number;
  totalQuestions: number;
  timeLimit: number;
  question: RoomQuestion | null;
  scores: PlayerScore[];
  selected: number | null;
  correctIndex: number | null;
  submitting: boolean;
  showPodium: boolean;
  finalResults: PlayerScore[];
  /** PCV-3: giải thích / câu gốc / số người chọn / kết quả — có sau ROUND_END. */
  reveal: RoundRevealData | null;
  /** PCV-11: hệ số điểm của câu đang chạy (câu chốt = 2). */
  multiplier: number;
  /** PCV-12: Sinh tồn — câu ở vùng nguy hiểm / câu quyết định. */
  dangerZone: boolean;
  showdown: boolean;
  /** PCV-11: bảng điểm trước ROUND_END gần nhất — để tính lên/xuống hạng. */
  previousScores: PlayerScore[];
}

/**
 * PCV-19 — QUIZ_END có nhiều dạng: máy chủ luôn gửi {@code { roomId, timestamp, finalResults }}, trong đó
 * Đội đấu đội đặt cả kết quả đội vào finalResults ({@code { teamWinner, scoreA, scoreB, leaderboard }});
 * bản cũ gửi thẳng danh sách. Trước đây trang đọc teamWinner ở ngoài cùng nên màn đội thắng không hiện.
 */
export function normalizeQuizEnd(data: unknown): {
  results: PlayerScore[]; teamWinner: string | null; scoreA: number; scoreB: number
} {
  const empty = { results: [] as PlayerScore[], teamWinner: null, scoreA: 0, scoreB: 0 }
  if (Array.isArray(data)) return { ...empty, results: data as PlayerScore[] }
  if (!data || typeof data !== 'object') return empty
  const outer = data as Record<string, unknown>
  const inner = outer.finalResults && typeof outer.finalResults === 'object' && !Array.isArray(outer.finalResults)
    ? outer.finalResults as Record<string, unknown>
    : outer
  const list = Array.isArray(inner.leaderboard) ? inner.leaderboard
    : Array.isArray(inner.finalResults) ? inner.finalResults
    : Array.isArray(outer.finalResults) ? outer.finalResults
    : []
  return {
    results: list as PlayerScore[],
    teamWinner: typeof inner.teamWinner === 'string' ? inner.teamWinner : null,
    scoreA: typeof inner.scoreA === 'number' ? inner.scoreA : 0,
    scoreB: typeof inner.scoreB === 'number' ? inner.scoreB : 0,
  }
}

/** PCV-11: thưởng chuỗi Đua tốc độ — bản sao của SpeedRaceStrategy.streakBonus phía máy chủ. */
export function speedRaceStreakBonus(streak: number | undefined): number {
  const n = streak ?? 0
  if (n >= 4) return 30
  if (n === 3) return 20
  if (n === 2) return 10
  return 0
}

export const initialCoreGameState: CoreGameState = {
  questionIndex: 0,
  totalQuestions: 0,
  timeLimit: 30,
  question: null,
  scores: [],
  selected: null,
  correctIndex: null,
  submitting: false,
  showPodium: false,
  finalResults: [],
  reveal: null,
  multiplier: 1,
  dangerZone: false,
  showdown: false,
  previousScores: [],
};

export type CoreGameAction =
  /** New round broadcast — replaces the question and clears round-local state. */
  | { type: 'QUESTION_START'; data: QuestionStartData }
  /** Round resolved — reveal + scoreboard (already sorted by the dispatcher). */
  | { type: 'ROUND_END'; correctIndex: number; scores: PlayerScore[]; reveal?: RoundRevealData | null }
  /** Sequential reveal — same correctIndex contract; leaderboard optional. */
  | { type: 'QUESTION_REVEALED'; correctIndex: number; leaderboard?: PlayerScore[] }
  | { type: 'SCORE_UPDATE'; data: ScoreUpdateData }
  | { type: 'LEADERBOARD_UPDATE'; data: PlayerScore[] }
  /** Optimistic local submit (server confirmation arrives via ROUND_END). */
  | { type: 'SELECT_ANSWER'; index: number }
  /** 500ms after a successful send — re-enable interactions guard. */
  | { type: 'SUBMIT_SETTLED' }
  /** WS was down when submitting — revert optimistic state so retry works. */
  | { type: 'REVERT_SUBMIT' }
  | { type: 'SHOW_PODIUM'; results: PlayerScore[] }
  /** TvT end — results without the podium overlay (TeamWinScreen instead). */
  | { type: 'SET_FINAL_RESULTS'; results: PlayerScore[] }
  /** Mount/reconnect rehydrate of an in-flight question — does NOT clear the
   *  player's current selection (same question may still be running). */
  | { type: 'SEED_QUESTION'; data: QuestionStartData }
  /** Mount rehydrate of an already-ENDED room — straight to the podium. */
  | { type: 'SEED_ENDED'; results: PlayerScore[]; totalQuestions?: number };

export function coreGameReducer(state: CoreGameState, action: CoreGameAction): CoreGameState {
  switch (action.type) {
    case 'QUESTION_START': {
      const d = action.data;
      return {
        ...state,
        questionIndex: d.questionIndex,
        totalQuestions: d.totalQuestions,
        question: d.question,
        timeLimit: d.timeLimit,
        selected: null,
        correctIndex: null,
        submitting: false,
        reveal: null,
        multiplier: d.multiplier && d.multiplier > 1 ? d.multiplier : 1,
        dangerZone: d.dangerZone === true,
        showdown: d.showdown === true,
      };
    }
    case 'ROUND_END':
      return {
        ...state,
        correctIndex: action.correctIndex,
        previousScores: state.scores,
        scores: action.scores,
        reveal: action.reveal ?? null,
      };
    case 'QUESTION_REVEALED':
      return {
        ...state,
        correctIndex: action.correctIndex,
        scores: action.leaderboard
          ? action.leaderboard.slice().sort((a, b) => b.score - a.score)
          : state.scores,
      };
    case 'SCORE_UPDATE': {
      const d = action.data;
      const upd = [...state.scores];
      const i = upd.findIndex(x => x.playerId === d.playerId);
      if (i >= 0) upd[i] = { ...upd[i], ...d }; else upd.push(d);
      return { ...state, scores: upd.sort((a, b) => b.score - a.score) };
    }
    case 'LEADERBOARD_UPDATE':
      return { ...state, scores: action.data.slice().sort((a, b) => b.score - a.score) };
    case 'SELECT_ANSWER':
      return { ...state, selected: action.index, submitting: true };
    case 'SUBMIT_SETTLED':
      return { ...state, submitting: false };
    case 'REVERT_SUBMIT':
      return { ...state, selected: null, submitting: false };
    case 'SHOW_PODIUM':
      return { ...state, finalResults: action.results, showPodium: true };
    case 'SET_FINAL_RESULTS':
      return { ...state, finalResults: action.results };
    case 'SEED_QUESTION': {
      const d = action.data;
      return {
        ...state,
        questionIndex: d.questionIndex,
        totalQuestions: d.totalQuestions,
        question: d.question,
        timeLimit: d.timeLimit,
        multiplier: d.multiplier && d.multiplier > 1 ? d.multiplier : 1,
        dangerZone: d.dangerZone === true,
        showdown: d.showdown === true,
      };
    }
    case 'SEED_ENDED':
      return {
        ...state,
        finalResults: action.results,
        scores: action.results,
        totalQuestions: action.totalQuestions ?? state.totalQuestions,
        showPodium: true,
      };
    default:
      return state;
  }
}
