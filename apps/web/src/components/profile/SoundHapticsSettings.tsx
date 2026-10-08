import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { soundManager } from '../../services/soundManager'
import { isHapticsEnabled, setHapticsEnabled } from '../../utils/haptics'
import { FILL_STYLE } from './types'

export function SoundHapticsSettings() {
  const { t } = useTranslation()
  const [soundEnabled, setSoundEnabled] = useState(soundManager.enabled)
  const [volume, setVolume] = useState(Math.round(soundManager.volume * 100))
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled())

  return (
    <section className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 md:p-6">
      <h2 className="font-display text-[19px] font-extrabold text-bq-ink inline-flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[18px] text-bq-amberd" style={FILL_STYLE}>volume_up</span>
        {t('profile.soundAndHapticsTitle')}
      </h2>

      <div className="divide-y divide-bq-hair">
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-sm text-bq-ink">{t('profile.soundEffectsLabel')}</span>
          <div className="flex items-center gap-3">
            {soundEnabled && (
              <input
                type="range"
                aria-label={t('profile.volumeLabel')}
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                  soundManager.setVolume(v / 100)
                }}
                className="w-32 h-1 bg-bq-inset rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bq-sapphire"
              />
            )}
            {soundEnabled && <span className="text-xs font-bold text-bq-amberd w-8 text-right">{volume}%</span>}
            <Toggle
              label={t('profile.soundEffectsLabel')}
              on={soundEnabled}
              onChange={(next) => {
                setSoundEnabled(next)
                soundManager.setEnabled(next)
                if (next) soundManager.play('buttonTap')
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-sm text-bq-ink">{t('profile.hapticsLabel')}</span>
          <Toggle label={t('profile.hapticsLabel')} on={hapticsOn} onChange={(next) => { setHapticsOn(next); setHapticsEnabled(next) }} />
        </div>
      </div>
    </section>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-10 h-[22px] rounded-full relative transition-colors ${on ? 'bg-bq-action shadow-bq-action' : 'bg-bq-hair'}`}
      aria-pressed={on}
      aria-label={label}
    >
      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'right-[3px]' : 'left-[3px]'}`} />
    </button>
  )
}
