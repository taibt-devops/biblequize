import { useAuth } from '../store/authStore'

/**
 * Sidebar Streak widget — shows the user's current consecutive-day streak
 * with an adaptive motivational caption. Reads `currentStreak` from the
 * auth store (populated by /api/me); when the user is logged out we fall
 * back to 0 and show the "start streak today" caption rather than hide
 * the widget, so the affordance is always visible.
 *
 * Caption thresholds:
 *   streak = 0   → "Bắt đầu streak hôm nay!"
 *   1 ≤ s < 7    → "Đừng dừng — chơi tiếp!"
 *   streak ≥ 7   → "Wow, {streak} ngày! 🎉"
 */
export default function StreakWidget() {
  const { user } = useAuth()
  const streak = user?.currentStreak ?? 0

  const caption =
    streak === 0
      ? 'Bắt đầu streak hôm nay!'
      : streak < 7
      ? 'Đừng dừng — chơi tiếp!'
      : `Wow, ${streak} ngày! 🎉`

  return (
    <div
      data-testid="streak-widget"
      className="rounded-[10px] px-3.5 py-3 bg-bq-white border border-bq-hair shadow-bq-soft"
    >
      <div
        className="text-[12px] font-bold mb-1.5 text-bq-ink2"
        style={{ letterSpacing: '0.12em' }}
      >
        🔥 Streak
      </div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span
          data-testid="streak-widget-count"
          className="text-[22px] font-extrabold leading-none text-bq-amberd"
        >
          {streak}
        </span>
        <span className="text-[11px] text-bq-ink2">
          ngày liên tục
        </span>
      </div>
      <p
        data-testid="streak-widget-caption"
        className="text-[10px] leading-snug text-bq-amberd"
      >
        {caption}
      </p>
    </div>
  )
}
