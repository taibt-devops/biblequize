interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <span className="material-symbols-outlined text-5xl text-bq-ink3 mb-4">{icon}</span>
      <h3 className="font-display text-lg font-semibold text-bq-ink mb-1">{title}</h3>
      {description && <p className="text-bq-ink2 text-center text-sm">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 bg-bq-action text-bq-ink shadow-bq-action px-5 py-2.5 rounded-xl font-semibold text-sm hover:brightness-105 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
