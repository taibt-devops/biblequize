// MLR — Join-by-code 6-input box (lifted out of Multiplayer.tsx).
// Mockup style: 44×52 inputs, slightly larger than the legacy 36×44.
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onJoin: (code: string) => void
  disabled?: boolean
  /** Optional error rendered under the inputs (e.g. "Mã không hợp lệ"). */
  error?: string | null
}

export default function CodeInput({ onJoin, disabled, error }: Props) {
  const { t } = useTranslation()
  const [chars, setChars] = useState<string[]>(['', '', '', '', '', ''])
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const code = chars.join('')
  const filled = chars.filter(Boolean).length
  const ready = filled === 6 && !disabled

  const handleChange = (i: number, val: string) => {
    const char = val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-1)
    const next = [...chars]
    next[i] = char
    setChars(next)
    if (char && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'Enter' && filled === 6) onJoin(code)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
    const next = Array(6).fill('')
    pasted.split('').forEach((c, i) => { next[i] = c })
    setChars(next)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        {chars.map((c, i) => (
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
            className="text-center text-[22px] font-semibold text-bq-ink outline-none transition-colors"
            style={{
              width: 44, height: 52,
              background: '#EFE3C3',
              border: `1px solid ${c ? '#D97F06' : '#C9B58C'}`,
              borderRadius: 10,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#D97F06' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = c ? '#D97F06' : '#C9B58C' }}
          />
        ))}
      </div>
      <button
        onClick={() => { if (ready) onJoin(code) }}
        disabled={!ready}
        className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-[13px] font-semibold transition-colors disabled:cursor-not-allowed"
        style={{
          background: ready ? 'var(--bq-action)' : '#EFE3C3',
          color: ready ? 'var(--bq-action-fg)' : '#6B5530',
          border: ready ? 'none' : '1px solid #C9B58C',
        }}
      >
        {disabled ? t('multiplayer.join.joining') : t('multiplayer.join.submit')}
      </button>
      {error && (
        <div
          className="mt-2 text-[11px] px-2 py-1.5 rounded-lg"
          style={{ background: 'rgba(179,69,47,0.10)', color: '#B3452F' }}
        >
          ⚠ {error}
        </div>
      )}
      {!error && filled > 0 && filled < 6 && (
        <p className="text-[10px] text-bq-ink3 mt-1.5">{t('multiplayer.join.remaining', { count: 6 - filled })}</p>
      )}
    </div>
  )
}
