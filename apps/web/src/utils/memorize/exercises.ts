// Memorize mode — pure exercise logic (SPEC_USER §5.1.1). No React, no I/O.
// Deterministic per `seed` so it is testable and re-renders never reshuffle.

export type ExerciseSpec =
  | { type: 'order'; chunkSize: number }
  | { type: 'cloze'; ratio: number }

const LEVEL_EXERCISES: ExerciseSpec[] = [
  { type: 'order', chunkSize: 3 },
  { type: 'order', chunkSize: 2 },
  { type: 'cloze', ratio: 0.25 },
  { type: 'cloze', ratio: 0.5 },
  { type: 'cloze', ratio: 0.75 },
  { type: 'cloze', ratio: 1 },
]

export function exerciseForLevel(level: number): ExerciseSpec {
  const i = Math.max(0, Math.min(LEVEL_EXERCISES.length - 1, Math.floor(level)))
  return LEVEL_EXERCISES[i]
}

/** Split on whitespace; punctuation stays attached to its word (displayed as-is). */
export function tokenize(text: string): string[] {
  return text.normalize('NFC').split(/\s+/).filter(Boolean)
}

/** Matching key: strip leading/trailing punctuation, case-insensitive (Vietnamese tone marks kept). */
export function normalizeWord(word: string): string {
  return word.normalize('NFC').replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').toLocaleLowerCase('vi')
}

export function wordsMatch(a: string, b: string): boolean {
  return normalizeWord(a) === normalizeWord(b)
}

export function chunkPhrases(tokens: string[], size: number): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i += size) out.push(tokens.slice(i, i + size).join(' '))
  return out
}

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic permutation; for ≥ 2 distinct items never returns the original order. */
export function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const next = rng(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  if (out.length > 1 && out.every((v, i) => v === items[i])) out.push(out.shift() as T)
  return out
}

/**
 * Indices of hidden words. Prefers longer words (more information), skips punctuation-only tokens.
 * Always hides at least one word; ratio 1 hides all. Returned ascending.
 */
export function pickClozeIndices(tokens: string[], ratio: number, seed: number): number[] {
  const candidates = tokens.map((t, i) => i).filter(i => normalizeWord(tokens[i]).length > 0)
  if (candidates.length === 0) return []
  const count = Math.min(candidates.length, Math.max(1, Math.round(candidates.length * ratio)))
  const next = rng(seed)
  const tie = new Map(candidates.map(i => [i, next()]))
  return [...candidates]
    .sort((a, b) => normalizeWord(tokens[b]).length - normalizeWord(tokens[a]).length || tie.get(a)! - tie.get(b)!)
    .slice(0, count)
    .sort((a, b) => a - b)
}

/** Word-bank distractors: unique words from the surrounding passage that are not hidden answers. */
export function clozeDistractors(hidden: string[], contextTokens: string[], count: number, seed: number): string[] {
  const hiddenSet = new Set(hidden.map(normalizeWord))
  const seen = new Set<string>()
  const pool: string[] = []
  for (const t of contextTokens) {
    const n = normalizeWord(t)
    if (!n || hiddenSet.has(n) || seen.has(n)) continue
    seen.add(n)
    pool.push(n)
  }
  return shuffleSeeded(pool, seed).slice(0, count)
}

/** Phrase order: passed with at most one mistake. */
export function orderPassed(mistakes: number): boolean {
  return mistakes <= 1
}

/** Cloze: passed with at most max(1, 10% of blanks) mistakes. */
export function clozePassed(mistakes: number, blanks: number): boolean {
  return mistakes <= Math.max(1, Math.floor(blanks * 0.1))
}

/** Stable seed for one verse in one review (salt with review count so each review differs). */
export function seedFor(id: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}
