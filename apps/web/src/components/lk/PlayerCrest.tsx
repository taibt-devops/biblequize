import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TIERS } from '../../data/tiers'
import { resolveAvatar } from '../../utils/avatar'
import k from './lk.module.css'

/**
 * A player's crest (LKF-11): the avatar set in a riveted rim made of the tier's material — light
 * wood, dark wood, bronze, silver, gold, radiant gold — with the tier medallion pinned to the
 * bottom-right like a game badge. Gold tiers get a slow shine. Players without a picture get a
 * pastel portrait chosen from their name, so every row looks different.
 */

const RIM: Record<number, string> = {
  1: 'linear-gradient(150deg,#E3B47A 0%,#B07A43 45%,#7A4E26 100%)',
  2: 'linear-gradient(150deg,#B98552 0%,#7E5129 50%,#5A3618 100%)',
  3: 'linear-gradient(150deg,#F0C08A 0%,#C68A4E 40%,#8F5A2A 75%,#D9A066 100%)',
  4: 'linear-gradient(150deg,#FFFFFF 0%,#C9D1D8 30%,#8E989F 65%,#DDE3E8 100%)',
  5: 'linear-gradient(150deg,#FFF1B0 0%,#FFC93C 35%,#C98A12 70%,#FFE27A 100%)',
  6: 'conic-gradient(from 210deg,#FFE27A,#FFC93C,#E07A3C,#FFC93C,#FFF4C2,#FFC93C,#FFE27A)',
}
// Equipped cosmetic frames (frame_tier1..6) keep the colours their names promise.
const FRAME_RIM: Record<number, string> = {
  1: 'linear-gradient(150deg,#F1F3F5 0%,#AEB5BB 45%,#7D858C 100%)',
  2: 'linear-gradient(150deg,#E6F7DA 0%,#A5DB92 45%,#5E9E57 100%)',
  3: 'linear-gradient(150deg,#CDE6FF 0%,#5B9BD8 45%,#2F5F98 100%)',
  4: 'linear-gradient(150deg,#E2CCF5 0%,#9B6AC8 45%,#E07A3C 100%)',
  5: 'conic-gradient(from 200deg,#FFF4C2,#FFC93C,#C98A12,#FFE27A,#FFF4C2,#FFC93C,#FFF4C2)',
  6: 'linear-gradient(150deg,#FFE27A 0%,#E0A42A 40%,#B3452F 100%)',
}
const RIVET: Record<number, string> = { 1: '#5A3618', 2: '#3A230E', 3: '#5A3618', 4: '#5E676D', 5: '#8F5A0A', 6: '#B3452F' }
const RIBBON: Record<number, string> = { 1: '#EBDDBE', 2: '#D9F0C8', 3: '#CFE6F7', 4: '#E8DBF5', 5: '#FFE08A', 6: '#FFD2B8' }
const PORTRAIT = ['#D9F0C8', '#CFE6F7', '#FFE0A3', '#F9D2C5', '#E6D9F2', '#F3E3C0', '#CDEBE3']

function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return h
}

interface PlayerCrestProps {
  name: string
  avatarUrl?: string | null
  tierId: number
  /** outer diameter in px */
  size?: number
  /** pin the tier medallion (off for tiny avatars) */
  showTier?: boolean
  /** equipped cosmetic frame 1..6: its colour replaces the tier material */
  frame?: number | null
  className?: string
}

export function PlayerCrest({ name, avatarUrl, tierId, size = 44, showTier = true, frame = null, className = '' }: PlayerCrestProps) {
  const { t } = useTranslation()
  const tier = Math.min(6, Math.max(1, tierId))
  const rim = Math.max(4, Math.round(size * 0.13))
  const border = size >= 60 ? 3 : 2
  const [broken, setBroken] = useState(false)
  const resolved = resolveAvatar(broken ? undefined : avatarUrl ?? undefined, name)
  const radius = size / 2 - border - rim / 2
  const rivet = Math.max(3, Math.round(rim * 0.42))
  const tierName = t(TIERS[tier - 1]?.nameKey ?? '')

  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <span
        className={`${k.crest} ${(frame ?? tier) >= 5 ? k.crestShine : ''} ${(frame ?? tier) === 6 ? k.crestRadiant : ''}`}
        style={{ background: frame ? FRAME_RIM[Math.min(6, Math.max(1, frame))] : RIM[tier], padding: rim, borderWidth: border }}
      >
        <span className="block w-full h-full rounded-full overflow-hidden border-2 border-bq-ink/80">
          {resolved.kind === 'img' ? (
            <img alt={name} src={resolved.src} onError={() => setBroken(true)} className="w-full h-full object-cover" />
          ) : resolved.kind === 'preset' ? (
            <span className="w-full h-full grid place-items-center leading-none" style={{ background: resolved.preset.bg, fontSize: size * 0.4 }} aria-hidden>
              {resolved.preset.emoji}
            </span>
          ) : (
            <span
              className="w-full h-full grid place-items-center font-display font-extrabold text-bq-ink leading-none"
              style={{ background: PORTRAIT[hash(name) % PORTRAIT.length], fontSize: size * 0.36 }}
            >
              {resolved.initial}
            </span>
          )}
        </span>
      </span>
      {/* four rivets on the rim, like the tier medallions */}
      {size >= 40 && [45, 135, 225, 315].map(deg => {
        const a = (deg * Math.PI) / 180
        return (
          <span
            key={deg}
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: rivet, height: rivet,
              left: size / 2 + radius * Math.cos(a) - rivet / 2,
              top: size / 2 + radius * Math.sin(a) - rivet / 2,
              background: RIVET[tier],
              boxShadow: 'inset 1px 1px 0 rgba(255,255,255,.45)',
            }}
          />
        )
      })}
      {showTier && (
        <img
          src={`/images/lk/tier-${tier}.webp`}
          alt=""
          title={tierName}
          className="absolute drop-shadow-[0_2px_0_rgba(29,43,34,.55)]"
          style={{ width: Math.round(size * (size < 60 ? 0.54 : 0.46)), right: -Math.round(size * 0.1), bottom: -Math.round(size * 0.08) }}
        />
      )}
    </span>
  )
}

/** The tier name on a small ribbon tinted with the tier colour. */
export function TierRibbon({ tierId, className = '' }: { tierId: number; className?: string }) {
  const { t } = useTranslation()
  const id = Math.min(6, Math.max(1, tierId))
  const tier = TIERS[id - 1]
  return (
    <span
      className={`inline-flex items-center gap-1 pl-1.5 pr-2.5 py-px rounded-full border-2 border-bq-ink text-[11.5px] md:text-[12px] font-extrabold text-bq-ink whitespace-nowrap ${className}`}
      style={{ background: RIBBON[id] }}
    >
      <span aria-hidden className="w-2 h-2 rounded-full border border-bq-ink" style={{ background: tier.colorHex }} />
      {t(tier.nameKey)}
    </span>
  )
}
