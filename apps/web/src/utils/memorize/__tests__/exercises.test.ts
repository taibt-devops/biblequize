import { describe, it, expect } from 'vitest'
import {
  chunkPhrases, clozeDistractors, clozePassed, exerciseForLevel, normalizeWord, orderPassed,
  pickClozeIndices, seedFor, shuffleSeeded, tokenize, wordsMatch,
} from '../exercises'

// Chuỗi giả — không phải câu Kinh Thánh.
const TEXT = 'Người gieo giống, đi ra đồng; hạt rơi bên đường.'

describe('exerciseForLevel', () => {
  it('maps levels 0–5 to the spec table', () => {
    expect(exerciseForLevel(0)).toEqual({ type: 'order', chunkSize: 3 })
    expect(exerciseForLevel(1)).toEqual({ type: 'order', chunkSize: 2 })
    expect([2, 3, 4, 5].map(l => exerciseForLevel(l))).toEqual([
      { type: 'cloze', ratio: 0.25 }, { type: 'cloze', ratio: 0.5 },
      { type: 'cloze', ratio: 0.75 }, { type: 'cloze', ratio: 1 },
    ])
  })

  it('clamps out-of-range levels', () => {
    expect(exerciseForLevel(-2).type).toBe('order')
    expect(exerciseForLevel(9)).toEqual({ type: 'cloze', ratio: 1 })
  })
})

describe('tokenize / normalize', () => {
  it('splits on whitespace keeping punctuation attached', () => {
    expect(tokenize('  a,  b;\n c. ')).toEqual(['a,', 'b;', 'c.'])
  })

  it('normalizes punctuation and case but keeps Vietnamese diacritics', () => {
    expect(normalizeWord('“Đường.”')).toBe('đường')
    expect(wordsMatch('Đồng;', 'đồng')).toBe(true)
    expect(wordsMatch('đường', 'duong')).toBe(false)
    expect(normalizeWord('—')).toBe('')
  })

  it('treats NFD and NFC input as the same word', () => {
    expect(wordsMatch('đường'.normalize('NFD'), 'đường')).toBe(true)
  })
})

describe('chunkPhrases', () => {
  it('groups tokens by size with a shorter tail', () => {
    expect(chunkPhrases(['a', 'b', 'c', 'd', 'e'], 2)).toEqual(['a b', 'c d', 'e'])
  })
})

describe('shuffleSeeded', () => {
  it('is deterministic and never returns the original order for distinct items', () => {
    const items = ['a', 'b', 'c', 'd']
    for (let seed = 0; seed < 50; seed++) {
      const out = shuffleSeeded(items, seed)
      expect(out).toEqual(shuffleSeeded(items, seed))
      expect([...out].sort()).toEqual(items)
      expect(out).not.toEqual(items)
    }
    expect(shuffleSeeded(['x'], 1)).toEqual(['x'])
  })
})

describe('pickClozeIndices', () => {
  const tokens = tokenize(TEXT)

  it('hides round(ratio × words), at least one, sorted', () => {
    const idx = pickClozeIndices(tokens, 0.25, 7)
    expect(idx).toHaveLength(Math.round(tokens.length * 0.25))
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(pickClozeIndices(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 0.01, 1)).toHaveLength(1)
  })

  it('ratio 1 hides every word and skips punctuation-only tokens', () => {
    expect(pickClozeIndices(['a', '—', 'b'], 1, 3)).toEqual([0, 2])
  })

  it('prefers longer words', () => {
    const idx = pickClozeIndices(['a', 'bb', 'ccccc', 'd'], 0.25, 9)
    expect(idx).toEqual([2])
  })

  it('is deterministic per seed', () => {
    expect(pickClozeIndices(tokens, 0.5, 42)).toEqual(pickClozeIndices(tokens, 0.5, 42))
  })

  it('handles empty input', () => {
    expect(pickClozeIndices([], 0.5, 1)).toEqual([])
  })
})

describe('clozeDistractors', () => {
  it('draws unique context words that are not hidden answers', () => {
    const out = clozeDistractors(['Đồng;'], tokenize('đồng ruộng ruộng xa, xa gần'), 2, 5)
    expect(out).toHaveLength(2)
    expect(new Set(out).size).toBe(2)
    expect(out).not.toContain('đồng')
    out.forEach(w => expect(['ruộng', 'xa', 'gần']).toContain(w))
  })

  it('returns fewer when context is too small', () => {
    expect(clozeDistractors(['a'], ['a'], 2, 1)).toEqual([])
  })
})

describe('grading', () => {
  it('order passes with at most one mistake', () => {
    expect(orderPassed(0)).toBe(true)
    expect(orderPassed(1)).toBe(true)
    expect(orderPassed(2)).toBe(false)
  })

  it('cloze allows max(1, 10% of blanks) mistakes', () => {
    expect(clozePassed(1, 3)).toBe(true)
    expect(clozePassed(2, 3)).toBe(false)
    expect(clozePassed(2, 25)).toBe(true)
    expect(clozePassed(3, 25)).toBe(false)
  })
})

describe('seedFor', () => {
  it('is stable per id and changes with salt', () => {
    expect(seedFor('v-1')).toBe(seedFor('v-1'))
    expect(seedFor('v-1', 1)).not.toBe(seedFor('v-1', 2))
  })
})
