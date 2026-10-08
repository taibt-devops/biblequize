import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FOOTPRINTS, type SignMode, type TimeOfDay } from './sceneData'
import s from './HomeScene.module.css'

/** Screen-wide light of the hour: sun rays + glow in the top-right corner (day) and a vignette. */
export function SceneAmbient({ tod }: { tod: TimeOfDay }) {
  const layer = 'absolute inset-0 pointer-events-none'
  if (tod === 'night') {
    return <div aria-hidden className={`${layer} bg-[radial-gradient(ellipse_74%_70%_at_52%_48%,rgba(5,10,30,0)_55%,rgba(5,10,30,.5)_100%)]`} />
  }
  if (tod === 'sunset') {
    return <div aria-hidden className={`${layer} bg-[radial-gradient(ellipse_72%_68%_at_52%_46%,rgba(70,25,10,0)_56%,rgba(70,25,10,.4)_100%)]`} />
  }
  return (
    <>
      <div aria-hidden className={`${layer} ${s.rays} mix-blend-screen bg-[conic-gradient(from_198deg_at_100%_0%,rgba(255,240,190,0)_0deg,rgba(255,240,190,.2)_5deg,rgba(255,240,190,0)_10deg,rgba(255,240,190,0)_15deg,rgba(255,240,190,.16)_21deg,rgba(255,240,190,0)_27deg,rgba(255,240,190,0)_33deg,rgba(255,240,190,.13)_38deg,rgba(255,240,190,0)_44deg,rgba(255,240,190,0)_360deg)] [mask-image:radial-gradient(circle_at_100%_0%,#000_0,rgba(0,0,0,.6)_35%,transparent_75%)]`} />
      <div aria-hidden className={`${layer} mix-blend-screen bg-[radial-gradient(circle_at_97%_3%,rgba(255,238,170,.6)_0,rgba(255,238,170,.2)_18%,rgba(255,238,170,0)_40%)]`} />
      <div aria-hidden className={`${layer} bg-[radial-gradient(ellipse_72%_68%_at_52%_46%,rgba(43,26,8,0)_58%,rgba(43,26,8,.34)_100%)]`} />
    </>
  )
}

/** Glow on the painted low sun (sunset) or moon (night); positions are % of the core. */
export function SceneGlow({ tod }: { tod: TimeOfDay }) {
  const layer = 'absolute inset-0 pointer-events-none mix-blend-screen'
  if (tod === 'night') {
    return <div aria-hidden className={`${layer} bg-[radial-gradient(circle_at_71%_15%,rgba(220,232,255,.35)_0,rgba(180,200,255,.1)_14%,rgba(180,200,255,0)_30%)]`} />
  }
  if (tod === 'sunset') {
    return <div aria-hidden className={`${layer} bg-[radial-gradient(circle_at_84%_47%,rgba(255,214,140,.55)_0,rgba(255,170,90,.18)_20%,rgba(255,170,90,0)_42%)]`} />
  }
  return null
}

const BOOT = (
  <>
    <path d="M3 0C4.9 0 6 1.7 6 4.1 6 6.4 5.1 8.3 3 8.3S0 6.4 0 4.1C0 1.7 1.1 0 3 0Z" fill="#FFE27A" />
    <rect x="1" y="9.6" width="4" height="4.4" rx="1.8" fill="#FFE27A" />
  </>
)

/** Glowing boot prints from the traveller to the post: "this way". */
export function Footprints() {
  const set = (pts: number[][], cls: string) => (
    <div aria-hidden className={`absolute inset-0 pointer-events-none ${s.trail} ${cls}`}>
      {pts.map(([x, y], i) => (
        <svg key={i} viewBox="0 0 6 14" className={s.fp} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.32}s` }}>{BOOT}</svg>
      ))}
    </div>
  )
  return (
    <>
      {set(FOOTPRINTS.phone, 'md:hidden')}
      {set(FOOTPRINTS.desktop, 'hidden md:block')}
    </>
  )
}

/** The traveller, standing on the road (phone: closer to the post so he stays in the window). */
export function Traveller({ tod }: { tod: TimeOfDay }) {
  const tint = tod === 'night' ? 'brightness-[.8] saturate-[.82] hue-rotate-[-6deg]' : tod === 'sunset' ? 'sepia-[.18] saturate-[1.12] brightness-[.98]' : ''
  return (
    <img
      src="/images/lk/hero.webp"
      alt=""
      aria-hidden
      className={`absolute bottom-[5%] h-[34%] left-[55%] md:left-[47%] motion-safe:animate-bob ${tint}`}
    />
  )
}

/** First visit only (no XP, no streak, daily not done): a hand taps the first board. */
export function StartHereHand() {
  const { t } = useTranslation()
  return (
    <div data-testid="home-start-here" className="absolute inset-0 pointer-events-none">
      <span className="sr-only">{t('home.emptyState.label')}: {t('home.lk.startHint')}</span>
      <span aria-hidden className={s.ripple} style={{ left: '72%', top: '20%' }} />
      <img aria-hidden src="/images/lk/tutorial-hand.webp" alt="" className={s.hand} style={{ left: '71.8%', top: '10.9%', width: '5.6%' }} />
    </div>
  )
}

interface BubbleProps {
  mode: 'letter' | 'ask' | 'first'
  hovered: SignMode | null
  goKey?: string
  xp: number
}

/**
 * The traveller's speech bubble. Letter waiting: "a letter for me!" + the open button; first visit:
 * a hint to tap a sign; otherwise the usual question. Hovering a sign says where it leads.
 * Desktop: to the right of his head (tail left). Phone: above him (tail down).
 */
export function SpeechBubble({ mode, hovered, goKey, xp }: BubbleProps) {
  const { t } = useTranslation()
  const line = hovered && goKey ? t(goKey)
    : mode === 'letter' ? t('home.lk.bubbleLetter')
    : mode === 'first' ? <><span className="md:hidden">{t('home.lk.bubbleFirstShort')}</span><span className="hidden md:inline">{t('home.lk.bubbleFirst')}</span></>
    : t('home.signpost.ask')
  return (
    <div className="absolute z-[5] left-[55%] bottom-[37%] md:left-[55.2%] md:top-[49.5%] md:bottom-auto px-3 md:px-[1.3cqw] pt-2 md:pt-[.75cqw] pb-2.5 md:pb-[1cqw] bg-bq-white border-[3px] border-bq-ink rounded-2xl md:rounded-[18px] shadow-[0_4px_0_rgba(29,43,34,.35)]">
      <svg aria-hidden width="26" height="24" viewBox="0 0 26 24" className="md:hidden absolute left-[22px] -bottom-[21px]">
        <path d="M2 1 L12 22 L22 1" fill="#FFF8E7" stroke="#1D2B22" strokeWidth="3" strokeLinejoin="round" />
        <path d="M4 0 L20 0" stroke="#FFF8E7" strokeWidth="5" />
      </svg>
      <svg aria-hidden width="34" height="26" viewBox="0 0 34 26" className="hidden md:block absolute -left-[22px] bottom-[14px]">
        <path d="M33 3 L2 22 L33 18" fill="#FFF8E7" stroke="#1D2B22" strokeWidth="3" strokeLinejoin="round" />
        <path d="M30 6 L31 16" stroke="#FFF8E7" strokeWidth="5" />
      </svg>
      <p className={`m-0 text-[15px] md:[font-size:max(15px,1.45cqw)] font-bold ${mode === 'letter' && !hovered ? 'hidden md:block' : ''} ${mode === 'first' && !hovered ? 'max-w-[190px] md:max-w-[21cqw]' : 'whitespace-nowrap'}`}>{line}</p>
      {mode === 'letter' && (
        <Link
          to="/daily"
          data-testid="featured-daily-cta"
          className={`md:mt-[.55cqw] inline-flex items-center gap-1.5 md:gap-[.6cqw] pl-3 md:pl-[1.3cqw] pr-2 md:pr-[1cqw] py-0.5 md:py-[.35cqw] bg-bq-amber border-[3px] border-bq-ink rounded-full font-extrabold text-[14px] md:[font-size:max(14px,1.35cqw)] text-bq-ink whitespace-nowrap active:translate-y-1 ${s.letterCta}`}
        >
          <span className="md:hidden">{t('home.lk.letterCtaShort')}</span>
          <span className="hidden md:inline">{t('home.lk.letterCta')}</span>
          <span className="px-1.5 md:px-[.55cqw] bg-bq-white border-2 border-bq-ink rounded-full text-[11px] md:[font-size:max(11px,1cqw)]">{t('home.lk.letterXp', { xp })}</span>
        </Link>
      )}
    </div>
  )
}
