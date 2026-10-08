// MPP-3 — Thin 56px "Tham gia bằng mã" bar variant of CodeInput.
// Replaces the 2/5 RIGHT card from MLR; sits ABOVE the hero per mockup.
// Inputs are 36×36 (compact) vs the legacy 44×52 CodeInput.

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onJoin: (code: string) => void
  disabled?: boolean
  error?: string | null
}

export default function JoinByCodeBar({ onJoin, disabled, error }: Props) {
  const { t } = useTranslation()
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const code = digits.join('')
  const filled = digits.filter(Boolean).length
  const ready = filled === 6 && !disabled

  const handleChange = (i: number, val: string) => {
    const c = val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-1)
    const next = [...digits]; next[i] = c
    setDigits(next)
    if (c && i < 5) refs.current[i + 1]?.focus()
  }
  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'Enter' && filled === 6) onJoin(code)
  }
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
    const next = Array(6).fill('')
    p.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    refs.current[Math.min(p.length, 5)]?.focus()
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap bg-bq-cream border-[3px] border-bq-ink shadow-[0_4px_0_#1D2B22]"
    >
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="w-10 h-10 rounded-full grid place-items-center bg-bq-amber border-2 border-bq-ink">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>key</span>
        </span>
        <div>
          <div className="text-[15px] font-extrabold leading-tight text-bq-ink">{t('multiplayer.join.kicker')}</div>
          <div className={`text-[12.5px] font-bold leading-tight ${error ? 'text-bq-ruby' : 'text-bq-ink2'}`}>
            {error ?? t('multiplayer.join.hint')}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
        {digits.map((c, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            type="text"
            inputMode="text"
            maxLength={2}
            value={c}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            data-testid={`code-digit-${i}`}
            className={`w-10 h-11 text-center text-[18px] font-extrabold text-bq-ink rounded-xl border-[3px] outline-none focus:border-bq-ink focus:ring-2 focus:ring-bq-amber ${
              c ? 'bg-bq-white border-bq-ink' : 'bg-bq-paper border-bq-ink/30'
            }`}
          />
        ))}
      </div>

      <button
        onClick={() => { if (ready) onJoin(code) }}
        disabled={!ready}
        className="lk-btn ml-auto !py-2 text-bq-ink text-[15px]"
      >
        {disabled ? t('multiplayer.join.joining') : t('multiplayer.join.submit')}
      </button>
    </div>
  )
}
