interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
      <span className="grid place-items-center w-16 h-16 mb-4 rounded-full bg-bq-leaf border-[3px] border-bq-ink shadow-[0_4px_0_#1D2B22]">
        <span className="material-symbols-outlined text-3xl text-bq-ink">{icon}</span>
      </span>
      <h3 className="font-display text-xl font-extrabold text-bq-ink mb-1">{title}</h3>
      {description && <p className="font-read text-bq-ink2 text-sm max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="lk-btn mt-5 text-sm text-bq-ink">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
