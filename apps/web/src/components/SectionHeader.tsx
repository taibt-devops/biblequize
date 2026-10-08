interface SectionHeaderProps {
  title: string
  /** Optional right-aligned secondary text. Hidden when omitted. */
  meta?: string
  className?: string
}

/**
 * Small-caps section header with a gold accent bar — used between Home
 * sections per home_modern.html `.sec-head`. Title is uppercase tracked
 * 0.16em ivory; meta is right-aligned ivory-faint.
 */
export default function SectionHeader({ title, meta, className = '' }: SectionHeaderProps) {
  return (
    <div
      data-testid="section-header"
      className={`flex items-center gap-3 mt-7 mb-3.5 ${className}`}
    >
      <span
        aria-hidden
        className="block w-[3px] h-3.5 rounded-[2px] shrink-0 bg-bq-spectrum"
      />
      <h2
        data-testid="section-header-title"
        className="font-display text-[12.5px] font-bold text-bq-ink"
      >
        {title}
      </h2>
      {meta && (
        <span
          data-testid="section-header-meta"
          className="ml-auto text-[11px] text-bq-ink3 font-medium"
        >
          {meta}
        </span>
      )}
    </div>
  )
}
