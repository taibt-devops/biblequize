import { useTranslation } from 'react-i18next'

interface EnergyCardProps {
  energy: number
  energyMax: number
  /** "{HH}:{MM}:{SS}" countdown to next reset, "--:--:--" if unknown. */
  recoverTimeLeft: string
}

interface UrgencyConfig {
  /** Tailwind class for the segment fill colour. */
  segmentClass: string
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
      segmentClass: 'bg-[rgba(255,255,255,0.08)]',
      numberHex: 'rgba(255,255,255,0.45)',
    }
  }
  const pct = (energy / max) * 100
  if (pct < 10) {
    return {
      segmentClass: 'bg-[#ef4444]',
      numberHex: '#ef4444',
      numberAnimClass: 'animate-pulse',
    }
  }
  if (pct < 20) return { segmentClass: 'bg-[#ff8c42]', numberHex: '#ff8c42' }
  if (pct < 50) return { segmentClass: 'bg-[#eab308]', numberHex: '#eab308' }
  return { segmentClass: 'bg-secondary', numberHex: '#e8a832' }
}

/**
 * Energy card on /ranked — primary card in the 1.5fr / 1fr top row
 * with Streak. Reflects the mockup (line 76-100): label + recover-in
 * countdown, big number with descriptor, 5-segment fill bar, footer
 * explainer.
 *
 * Adds urgency colour bands per RK-P2-4 (gold/yellow/orange/red/grey
 * for out) so the user notices when they're running low without
 * having to read the number.
 */
export default function EnergyCard({
  energy,
  energyMax,
  recoverTimeLeft,
}: EnergyCardProps) {
  const { t } = useTranslation()
  const isOut = energy <= 0
  const cfg = urgencyFor(energy, energyMax)
  // Segments fill in proportion to current energy, 5 slots of 20%.
  const SEG_COUNT = 5
  const filledSegments = isOut ? 0 : Math.max(1, Math.round((energy / energyMax) * SEG_COUNT))
  const questionsLeft = Math.floor(energy / 5)

  return (
    <section
      data-testid="ranked-energy-card"
      className="rounded-2xl border border-secondary/20 p-4 md:p-5"
      style={{ background: 'rgba(50,52,64,0.4)' }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-secondary/80">
          <span className="text-sm">⚡</span>
          <span className="text-[11px] font-medium tracking-wider uppercase">
            {t('ranked.energy')}
          </span>
        </div>
        <span
          data-testid="ranked-reset-timer"
          className="text-on-surface-variant/45 text-[11px]"
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
        <span className="text-on-surface-variant/40 text-[14px]">/{energyMax}</span>
        <span className="text-on-surface-variant/50 text-[11px] ml-auto">
          {isOut
            ? t('ranked.outOfEnergy')
            : t('ranked.questionsLeft', { count: questionsLeft })}
        </span>
      </div>

      <div className="flex gap-1 mb-2" data-testid="ranked-energy-segments">
        {Array.from({ length: SEG_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-[2px] transition-colors ${
              i < filledSegments ? cfg.segmentClass : 'bg-white/[0.06]'
            }`}
          />
        ))}
      </div>

      <p className="text-on-surface-variant/40 text-[10px] leading-snug">
        {t('ranked.energyExplainer')}
      </p>
    </section>
  )
}
