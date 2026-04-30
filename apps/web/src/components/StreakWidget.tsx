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
      className="rounded-[10px] px-3.5 py-3"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="text-[10px] uppercase font-bold mb-1.5"
        style={{ letterSpacing: '0.12em', color: 'rgba(225,225,241,0.5)' }}
      >
        🔥 Streak
      </div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span
          data-testid="streak-widget-count"
          className="text-[22px] font-extrabold leading-none"
          style={{ color: '#fb923c' }}
        >
          {streak}
        </span>
        <span className="text-[11px]" style={{ color: 'rgba(225,225,241,0.55)' }}>
          ngày liên tục
        </span>
      </div>
      <p
        data-testid="streak-widget-caption"
        className="text-[10px] leading-snug"
        style={{ color: 'rgba(251,146,60,0.8)' }}
      >
        {caption}
      </p>
    </div>
  )
}
