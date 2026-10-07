import { useEffect, useState } from 'react';

interface Props {
  count: number;          // 5 or 10
  multiplier: number;     // 1.2 or 1.5
  onDismiss: () => void;
}

/**
 * Sprint 2 S2-7 — fire/orange-gold streak banner that drops in from the
 * top, pulses once, then self-dismisses after ~2.4s. Sound + haptic are
 * driven by the parent (RoomQuiz) so the banner stays a pure
 * presentational component.
 */
export function ComboBanner({ count, multiplier, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200);
    const t2 = setTimeout(onDismiss, 2400);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      data-testid="combo-banner"
      className="fixed top-20 left-1/2 z-[60] combo-banner-anim"
      style={{
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #ff7a59 0%, #e8a832 100%)',
        color: '#1D2B22',
        borderRadius: 16,
        padding: '12px 20px',
        boxShadow: '0 12px 40px rgba(255,122,89,0.45)',
        minWidth: 280,
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">🔥</span>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-base leading-tight">
            COMBO ×{count}!
          </div>
          <div className="text-xs font-medium opacity-90 mt-0.5">
            {count} câu đúng liên tiếp · điểm ×{multiplier.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComboBanner;
