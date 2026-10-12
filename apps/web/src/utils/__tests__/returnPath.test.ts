import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isSafeReturnPath, rememberReturnPath, takeReturnPath } from '../returnPath'

/** PCV-24 — đăng nhập xong quay về đúng trang (vd. /room/create?passage=… mở từ app Đọc hằng ngày). */
describe('returnPath', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('nhớ đường dẫn trong app rồi trả đúng một lần', () => {
    rememberReturnPath('/room/create?passage=Genesis:27-28')
    expect(takeReturnPath()).toBe('/room/create?passage=Genesis:27-28')
    expect(takeReturnPath()).toBeNull()
  })

  it('không nhận đường dẫn ra ngoài app, trang đăng nhập hay callback', () => {
    for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil.example', 'room/create', '/login', '/login?x=1', '/auth/callback?code=1', '']) {
      expect(isSafeReturnPath(bad)).toBe(false)
      rememberReturnPath(bad)
      expect(takeReturnPath()).toBeNull()
    }
    expect(isSafeReturnPath('/room/create?passage=1%20Samuel:3-4')).toBe(true)
  })

  it('để quá 30 phút thì bỏ (đăng nhập lần khác không bị kéo về trang cũ)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T10:00:00Z'))
    rememberReturnPath('/rooms')
    vi.setSystemTime(new Date('2026-10-13T10:31:00Z'))
    expect(takeReturnPath()).toBeNull()
  })
})
