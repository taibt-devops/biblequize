import { useTranslation } from 'react-i18next'

interface EnergyCardProps {
  energy: number
  energyMax: number
  /** "{HH}:{MM}:{SS}" countdown to next reset, "--:--:--" if unknown. */
  recoverTimeLeft: string
}

interface UrgencyConfig {
  /** Fill color (hex) for the single horizontal bar. */
  fillHex: string
  /** Hex for the big number text. */
  numberHex: string
  /** Optional CSS animation class — used for low-energy pulse. */
  numberAnimClass?: string
}

/**
 * Maps current energy to a four-band visual urgency state per RK-P2-4.
 * Thresholds picked so the colour ramps before the user is fully out
 * (gold → yellow → orange → red), with a separate "out" lock state.
 */
function urgencyFor(energy: number, max: number): UrgencyConfig {
  if (max <= 0 || energy <= 0) {
    return {
      fillHex: 'rgba(255,255,255,0.08)',
      numberHex: 'rgba(255,255,255,0.45)',
    }
  }
  const pct = (energy / max) * 100
  if (pct < 10) {
    return { fillHex: '#ef4444', numberHex: '#ef4444', numberAnimClass: 'animate-pulse' }
  }
  if (pct < 20) return { fillHex: '#ff8c42', numberHex: '#ff8c42' }
  if (pct < 50) return { fillHex: '#eab308', numberHex: '#eab308' }
  return { fillHex: '#e8a832', numberHex: '#e8a832' }
}

/**
 * Energy card — slim full-width hero (mockup 2026-05-20):
 *   header row : ⚡ NĂNG LƯỢNG          🕐 Phục hồi sau HH:MM:SS
 *   number row : 100 / 100              ✓ Đủ chơi −20 câu
 *   bar        : single yellow horizontal fill (urgency color band)
 *
 * Drops the previous 5-segment bar + bottom explainer per user mockup
 * — the row is the primary "do I have energy?" signal so keep it
 * uncluttered. Urgency colour band (gold→yellow→orange→red→grey) is
 * preserved so the user notices low energy without reading the number.
 */
export default function EnergyCard({
  energy,
  energyMax,
  recoverTimeLeft,
}: EnergyCardProps) {
  const { t } = useTranslation()
  const isOut = energy <= 0
  const cfg = urgencyFor(energy, energyMax)
  const fillPct = energyMax > 0 ? Math.max(0, Math.min(100, (energy / energyMax) * 100)) : 0
  const questionsLeft = Math.floor(energy / 5)

  return (
    <section
      data-testid="ranked-energy-card"
      className="rounded-2xl border border-secondary/20 p-4 md:p-5"
      style={{ background: 'rgba(50,52,64,0.4)' }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-bq-amberd/80">
          <span className="text-sm">⚡</span>
          <span className="text-[12.5px] font-medium">
            {t('ranked.energy')}
          </span>
        </div>
        <span
          data-testid="ranked-reset-timer"
          className="text-bq-ink2/45 text-[11px]"
        >
          {t('ranked.energyRecoverIn', { time: recoverTimeLeft })}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span
          data-testid="ranked-energy-display"
          className={`text-[32px] font-medium leading-none ${cfg.numberAnimClass ?? ''}`}
          style={{ color: cfg.numberHex }}
        >
          {energy}
        </span>
        <span className="text-bq-ink2/40 text-[14px]">/{energyMax}</span>
        {isOut ? (
          <span
            data-testid="ranked-energy-status"
            className="ml-auto text-[11px] font-medium text-bq-ink2/50"
          >
            {t('ranked.outOfEnergy')}
          </span>
        ) : (
          <span
            data-testid="ranked-energy-status"
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium"
            style={{ color: '#4ade80' }}
          >
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            {t('ranked.energyEnoughForNQuestions', { count: questionsLeft })}
          </span>
        )}
      </div>

      <div className="bg-white/[0.06] rounded-full h-2 overflow-hidden" data-testid="ranked-energy-bar">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${fillPct}%`, background: cfg.fillHex }}
        />
      </div>
    </section>
  )
}
