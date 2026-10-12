import { describe, it, expect } from 'vitest'
import { describeQuickMatchError } from '../quickMatch'

/** AIR-1 (13/10/2026): không còn sinh câu bằng AI — không còn lời báo nào nói về AI. */
describe('describeQuickMatchError', () => {
  it('mã lỗi AI cũ (app cũ) chỉ ra lời báo chung', () => {
    for (const code of ['AI_TIER_LOCKED', 'AI_GENERATION_INSUFFICIENT', 'AI_SOURCE_DISABLED']) {
      expect(describeQuickMatchError({ response: { data: { error: code } } }).message).not.toMatch(/AI/)
    }
  })

  it('đang ở phòng khác vẫn báo rõ', () => {
    expect(describeQuickMatchError({ response: { data: { error: 'ALREADY_IN_ANOTHER_ROOM' } } }).message).toMatch(/phòng khác/)
  })
})
