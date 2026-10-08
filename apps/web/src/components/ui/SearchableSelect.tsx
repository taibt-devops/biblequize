import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'

export interface SearchableOption {
  value: string
  label: string
}

interface Props {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allLabel?: string
  /** Placeholder of the search box; defaults to `placeholder`. */
  searchPlaceholder?: string
  /** Drop the "all" row: a choice is required and the button shows `placeholder` until one is made. */
  hideAll?: boolean
}

// Khung Sáng (light): white surface + ink text + hairline border + amber accent.
// Migrated off the old dark `--hp-*` vars (cream text on light paper = invisible).
const SearchableSelect: React.FC<Props> = ({ options, value, onChange, placeholder, allLabel, searchPlaceholder, hideAll = false }) => {
  const { t } = useTranslation()
  const effectivePlaceholder = placeholder ?? t('components.searchableSelect.chooseDefault')
  const effectiveAllLabel = allLabel ?? t('common.all')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () => options.find(o => o.value === value)?.label ?? (hideAll ? '' : effectiveAllLabel),
    [options, value, effectiveAllLabel, hideAll],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const optionClass = (isActive: boolean) =>
    clsx(
      'w-full text-left px-3.5 py-2 text-sm rounded-md transition-colors',
      isActive
        ? 'bg-bq-amber/10 text-bq-amberd font-bold'
        : 'text-bq-ink font-semibold hover:bg-bq-inset',
    )

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg',
          'bg-bq-white border text-sm font-semibold transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-bq-sapphire',
          open ? 'border-bq-amber/50 ring-1 ring-bq-amber/25' : 'border-bq-hair',
          value ? 'text-bq-ink' : 'text-bq-ink2',
        )}
      >
        <span className="text-left overflow-hidden text-ellipsis whitespace-nowrap">
          {selected || effectivePlaceholder}
        </span>
        <svg
          className={clsx('w-3.5 h-3.5 text-bq-ink3 shrink-0 transition-transform', open && 'rotate-180')}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-bq-white border border-bq-hair rounded-xl shadow-bq-soft overflow-hidden">
          <div className="p-2 border-b border-bq-hair">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? (effectivePlaceholder || t('common.search'))}
              className="w-full px-2.5 py-2 rounded-lg bg-bq-inset border border-bq-hair text-bq-ink text-sm placeholder:text-bq-ink3 focus:outline-none focus:ring-1 focus:ring-bq-sapphire"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {!hideAll && (
              <li>
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false) }}
                  className={optionClass(value === '')}
                >{effectiveAllLabel}</button>
              </li>
            )}
            {filtered.map(opt => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setQuery('') }}
                  className={optionClass(value === opt.value)}
                >{opt.label}</button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3.5 py-2 text-sm text-bq-ink3">
                {t('components.searchableSelect.noMatch')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
