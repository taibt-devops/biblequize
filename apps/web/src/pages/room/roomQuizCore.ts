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
      };
    }
    case 'ROUND_END':
      return { ...state, correctIndex: action.correctIndex, scores: action.scores, reveal: action.reveal ?? null };
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
