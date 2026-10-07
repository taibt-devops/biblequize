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
      className="rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap bg-bq-white shadow-bq-soft"
      style={{
        border: '1px solid #E7E4DA',
      }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.14)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#D97F06' }}>key</span>
        </div>
        <div>
          <div className="text-[12px] font-bold leading-tight text-bq-ink">{t('multiplayer.join.kicker')}</div>
          <div className="text-[10px] leading-tight" style={{ color: error ? '#E0354B' : '#6C6A62' }}>
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
            className="text-center text-base font-semibold text-bq-ink outline-none transition-colors"
            style={{
              width: 36, height: 36,
              background: '#F2F0E7',
              border: `1px solid ${c ? '#D97F06' : '#E7E4DA'}`,
              borderRadius: 8,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#D97F06' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = c ? '#D97F06' : '#E7E4DA' }}
          />
        ))}
      </div>

      <button
        onClick={() => { if (ready) onJoin(code) }}
        disabled={!ready}
        className="ml-auto h-9 px-4 rounded-lg text-[12px] font-semibold transition-opacity disabled:cursor-not-allowed"
        style={{
          background: ready ? 'var(--bq-action)' : '#F2F0E7',
          color: ready ? 'var(--bq-action-fg)' : '#A8A69C',
          border: ready ? 'none' : '1px solid #E7E4DA',
        }}
      >
        {disabled ? t('multiplayer.join.joining') : t('multiplayer.join.submit')}
      </button>
    </div>
  )
}
