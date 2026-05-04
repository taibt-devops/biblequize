import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import i18n from '../index'

/**
 * Direct-i18n tests for mid-session language switching. The previous
 * version mounted the orphan {@code components/Header.tsx} to assert
 * nav-label text changed reactively; that component was removed in
 * the AppLayout Hướng B refactor (HM-P0-1) and its render-time test
 * coverage is now redundant — every consumer goes through the same
 * {@code i18n.changeLanguage} call this suite still exercises.
 *
 * What we keep is the sharp contract: changing the active locale
 * updates {@code i18n.language} and {@code i18n.t} resolution
 * synchronously, so any component that reads either at render time
 * (NotificationBell, UserDropdown, Home, ...) gets fresh strings on
 * the next render. Component-level tests for those (GreetingCard,
 * AppLayout, GameModeGrid) cover the rendering path independently.
 */
describe('i18n language switch mid-session', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi')
  })

  afterEach(async () => {
    await i18n.changeLanguage('vi')
  })

  it('resolves Vietnamese nav labels when language is vi', () => {
    expect(i18n.t('nav.home')).toBe('Trang chủ')
    expect(i18n.t('nav.leaderboard')).toBe('Xếp hạng')
    expect(i18n.t('nav.profile')).toBe('Cá nhân')
  })

  it('swaps to English nav labels after changeLanguage("en")', async () => {
    expect(i18n.t('nav.home')).toBe('Trang chủ')
    await i18n.changeLanguage('en')
    expect(i18n.t('nav.home')).not.toBe('Trang chủ')
    expect(i18n.t('nav.home').toLowerCase()).toContain('home')
  })

  it('round-trips vi → en → vi and recovers the original labels', async () => {
    const viFirst = i18n.t('nav.home')
    await i18n.changeLanguage('en')
    const enValue = i18n.t('nav.home')
    expect(enValue).not.toBe(viFirst)
    await i18n.changeLanguage('vi')
    expect(i18n.t('nav.home')).toBe(viFirst)
  })

  it('i18n.language reflects the active locale', async () => {
    expect(i18n.language).toBe('vi')
    await i18n.changeLanguage('en')
    expect(i18n.language).toBe('en')
    await i18n.changeLanguage('vi')
    expect(i18n.language).toBe('vi')
  })

  it('time-ago interpolation updates with the active locale', async () => {
    // Used by NotificationBell.timeAgo() — verify the {{count}}
    // placeholder + locale switch survives.
    await i18n.changeLanguage('vi')
    expect(i18n.t('header.time.minutesAgo', { count: 5 })).toBe('5 phút trước')
    await i18n.changeLanguage('en')
    expect(i18n.t('header.time.minutesAgo', { count: 5 })).toBe('5 min ago')
  })
})
