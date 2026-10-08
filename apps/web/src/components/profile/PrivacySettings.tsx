import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { FILL_STYLE } from './types'

/**
 * Privacy section on the Profile page (LBF-5, SPEC_USER §21). Currently a
 * single opt-out: "show me on the leaderboard". Toggling off (PATCH /api/me
 * { leaderboardVisible: false }) removes the user from the public board + rank
 * counting; they keep their own private progress. Optimistic — reverts on
 * failure. `initialVisible` comes from GET /api/me (defaults to true).
 */
export function PrivacySettings({ initialVisible }: { initialVisible: boolean }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(initialVisible)
  const [saving, setSaving] = useState(false)

  const toggle = async (next: boolean) => {
    const prev = visible
    setVisible(next) // optimistic
    setSaving(true)
    try {
      await api.patch('/api/me', { leaderboardVisible: String(next) })
    } catch {
      setVisible(prev) // revert on failure
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-[19px] font-extrabold text-bq-ink inline-flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[18px] text-bq-amberd" style={FILL_STYLE}>shield_person</span>
        {t('profile.privacyTitle')}
      </h2>

      <div className="flex items-center justify-between py-1 gap-4">
        <div className="min-w-0">
          <p className="text-sm text-bq-ink">{t('profile.leaderboardVisibleLabel')}</p>
          <p className="text-xs text-bq-ink2 mt-0.5 leading-relaxed">{t('profile.leaderboardVisibleHint')}</p>
        </div>
        <button
          onClick={() => !saving && toggle(!visible)}
          disabled={saving}
          data-testid="leaderboard-visible-toggle"
          className={`shrink-0 w-10 h-[22px] rounded-full relative transition-colors ${visible ? 'bg-bq-action shadow-bq-action' : 'bg-bq-hair'} ${saving ? 'opacity-60' : ''}`}
          aria-pressed={visible}
          aria-label={t('profile.leaderboardVisibleLabel')}
        >
          <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${visible ? 'right-[3px]' : 'left-[3px]'}`} />
        </button>
      </div>
    </section>
  )
}
