import React, { useEffect, useRef, useState } from 'react'

export interface AdminSelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: AdminSelectOption[]
  className?: string
  testId?: string
}

/**
 * Lightweight dark-themed dropdown for the admin panel — replaces native
 * <select> so the open list matches the theme (rounded panel, gold-accented
 * selected row, hover). No dependency; closes on outside click / Escape.
 */
export default function AdminSelect({ value, onChange, options, className = '', testId }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find(o => o.value === value) ?? options[0]

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        data-testid={testId}
        onClick={() => setOpen(o => !o)}
        className="w-full h-9 pl-3 pr-2 rounded-md bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm text-left text-[#1D2B22] hover:border-[#8A5A12]/40 focus:outline-none focus:border-[#8A5A12]/60 transition-colors flex items-center justify-between gap-2"
      >
        <span className="truncate">{current?.label}</span>
        <span className={`material-symbols-outlined text-base text-[#4D3A1F]/50 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1.5 min-w-full w-max max-w-[240px] rounded-lg bg-[#EFE3C3] border border-[#1D2B22]/15 shadow-lg shadow-[#1D2B22]/15 py-1 max-h-64 overflow-y-auto"
        >
          {options.map(o => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full text-left pl-2 pr-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                  active ? 'text-[#8A5A12] bg-[#FFC93C]/10' : 'text-[#4D3A1F] hover:bg-[#1D2B22]/[0.04] hover:text-[#1D2B22]'
                }`}
              >
                <span className="material-symbols-outlined text-sm w-4 shrink-0">{active ? 'check' : ''}</span>
                <span className="truncate">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
