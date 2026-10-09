import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { lanternState } from './sceneData'
import type { Quest } from './QuestLanterns'
import GoogleSignInButton from '../../auth/GoogleSignInButton'

interface ScenePanelProps {
  onClose: () => void
  labelledBy: string
  /** Desktop placement: the verse scroll rises above the HUD, the quest card sits by the lanterns,
   *  the guest's sign-in card in the middle of the sky. */
  place: 'verse' | 'quests' | 'gate'
  children: ReactNode
}

const DESKTOP = '(min-width: 768px)'
function useIsDesktop(): boolean {
  const query = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP).matches
  const [desktop, setDesktop] = useState(query)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(DESKTOP)
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return desktop
}

/**
 * Panel opened from the scene (LKF-3). Phone: a bottom sheet over the tab bar (portalled to the
 * body so the page's stacking context does not trap it). Desktop: a parchment scroll / card over
 * the picture. Escape or a tap outside closes it; focus moves in and back out without scrolling.
 */
function ScenePanel({ onClose, labelledBy, place, children }: ScenePanelProps) {
  const { t } = useTranslation()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const desktop = useIsDesktop()

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.({ preventScroll: true })
    }
  }, [])

  const scroll = place === 'verse'
  // verse rises above the HUD (screen bottom-left); quests sit right of the lanterns (core 22 %)
  const where = scroll ? 'left-[calc(2.4%_+_6cqh)] bottom-[17%]'
    : place === 'gate' ? 'left-1/2 -translate-x-1/2 top-[20%]'
    : 'left-[calc(50%_-_42cqh)] top-[28%]'
  const rod = 'hidden md:block h-[max(14px,2.25cqh)] bg-bq-wood border-[3px] border-bq-ink rounded-full'
  const panel = (
    <>
      <div aria-hidden onClick={onClose} className={desktop ? 'absolute inset-0 z-[7] bg-bq-ink/25' : 'fixed inset-0 z-[70] bg-bq-ink/45'} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={desktop ? `absolute z-[8] w-[max(320px,45cqh)] ${where}` : 'fixed inset-x-0 bottom-0 z-[71]'}
      >
        {scroll && <div aria-hidden className={rod} />}
        <div
          className={`relative px-[18px] pt-2.5 pb-[max(22px,env(safe-area-inset-bottom))] bg-bq-white border-t-[3px] border-bq-ink rounded-t-[26px] shadow-[0_-6px_0_rgba(29,43,34,.25)] md:pb-[2.7cqh] md:pt-[2.4cqh] md:px-[3cqh] md:shadow-none ${
            scroll
              ? 'md:mx-[1.5cqh] md:-my-[3px] md:rounded-none md:border-t-0 md:border-x-[3px] md:bg-bq-parch md:text-center'
              : 'md:border-[3px] md:rounded-bq md:shadow-bq-card'
          }`}
        >
          <div aria-hidden className="md:hidden w-14 h-1.5 mx-auto mb-2.5 bg-bq-hair rounded-full" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('home.lk.close')}
            className="absolute right-3 top-3 w-9 h-9 grid place-items-center bg-bq-white border-2 border-bq-ink rounded-full hover:bg-bq-cream"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="#1D2B22" strokeWidth="3.4" strokeLinecap="round" /></svg>
          </button>
          {children}
        </div>
        {scroll && <div aria-hidden className={rod} />}
      </section>
    </>
  )
  return desktop || typeof document === 'undefined' ? panel : createPortal(panel, document.body)
}

const btn = 'inline-flex items-center gap-1.5 px-4 py-1.5 border-[3px] border-bq-ink rounded-[14px] shadow-[0_5px_0_#1D2B22] font-extrabold text-[16px] text-bq-ink active:translate-y-1 active:shadow-[0_1px_0_#1D2B22] transition-transform'

interface VersePanelProps {
  text: string
  verseRef: string
  due: number
  onClose: () => void
}

/** Today's verse on a parchment scroll: listen, memorize, and review the verses that are due. */
export function VersePanel({ text, verseRef, due, onClose }: VersePanelProps) {
  const { t } = useTranslation()
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  const speak = () => {
    const u = new SpeechSynthesisUtterance(`${text} ${verseRef}`)
    u.lang = 'vi-VN'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }
  return (
    <ScenePanel onClose={onClose} labelledBy="home-verse-title" place="verse">
      <img src="/images/lk/lantern-on.webp" alt="" className="hidden md:block h-[max(40px,6cqh)] mx-auto" />
      <h2 id="home-verse-title" className="m-0 md:mt-1 text-[15px] md:[font-size:max(14px,1.95cqh)] font-bold text-bq-amberd">{t('home.lk.verseTitle')}</h2>
      <p className="mt-1 mb-0 pr-8 md:pr-0 text-[20px] md:[font-size:max(18px,2.85cqh)] leading-[1.3] font-bold text-bq-ink">{text}</p>
      <p className="mt-1.5 mb-3.5 text-[15px] md:[font-size:max(14px,2cqh)] font-extrabold text-bq-amberd">{verseRef}</p>
      <div className="flex flex-wrap gap-2.5 md:justify-center">
        {canSpeak && (
          <button type="button" onClick={speak} className={`${btn} bg-bq-leaf`}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="none" stroke="#1D2B22" strokeWidth="2.2" strokeLinejoin="round" /><path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="#1D2B22" strokeWidth="2.2" strokeLinecap="round" /></svg>
            {t('home.lk.verseListen')}
          </button>
        )}
        <Link to="/practice/memorize/add" className={`${btn} bg-bq-white`}>{t('home.lk.verseLearn')}</Link>
      </div>
      {due > 0 && (
        <Link to="/practice/memorize/session" data-testid="home-memory-due-btn" className={`${btn} mt-3 w-full justify-center bg-bq-amber`}>
          {t('home.lk.verseDueBtn', { count: due })}
        </Link>
      )}
    </ScenePanel>
  )
}

interface QuestPanelProps {
  quests: Quest[]
  onClose: () => void
}

/** Today's quests, one lantern per row. */
export function QuestPanel({ quests, onClose }: QuestPanelProps) {
  const { t } = useTranslation()
  const done = quests.filter(q => lanternState(q.progress ?? 0, q.target ?? 1, q.completed) === 'lit').length
  return (
    <ScenePanel onClose={onClose} labelledBy="home-quests-title" place="quests">
      <div className="flex flex-wrap items-center gap-2.5 pr-10">
        <h2 id="home-quests-title" className="m-0 text-[24px] font-extrabold">{t('home.lk.questsTitle')}</h2>
        <span className="px-3 bg-bq-leaf border-2 border-bq-ink rounded-full text-[15px] font-extrabold">
          {t('home.lk.questsLit', { done, total: quests.length || 3 })}
        </span>
      </div>
      {quests.length === 0 && <p className="my-4 text-[16px] text-bq-ink2">{t('home.lk.questsEmpty')}</p>}
      {quests.map((q, i) => {
        const progress = q.progress ?? 0
        const target = q.target ?? 1
        const state = lanternState(progress, target, q.completed)
        return (
          <div key={i} className="flex items-center gap-3 py-3 border-b-2 border-dashed border-bq-hair last:border-0">
            <img
              src={state === 'dark' ? '/images/lk/lantern-off.webp' : '/images/lk/lantern-on.webp'}
              alt=""
              className={`h-11 w-[30px] object-contain shrink-0 ${state === 'burning' ? 'opacity-60 saturate-[.6]' : ''}`}
            />
            <span className="flex-1 min-w-0">
              <span className={`block text-[17px] font-semibold ${state === 'lit' ? 'text-bq-ink3' : ''}`}>{q.description}</span>
              {state === 'burning' && (
                <span className="block mt-1 h-3 bg-bq-track border-2 border-bq-ink rounded-full overflow-hidden">
                  <span className="block h-full bg-bq-ember" style={{ width: `${Math.min(100, (progress / Math.max(1, target)) * 100)}%` }} />
                </span>
              )}
            </span>
            <span className="text-[16px] font-extrabold tabular-nums">{state === 'lit' ? t('home.lk.questDone') : `${progress}/${target}`}</span>
          </div>
        )
      })}
      <Link to="/practice" onClick={onClose} className={`${btn} mt-2 w-full justify-center bg-bq-amber text-[19px]`}>{t('home.lk.questsGo')}</Link>
    </ScenePanel>
  )
}

export type GateReason = 'ranked' | 'rooms' | 'journey' | 'quests'

const GATE_ICON: Record<GateReason, string> = {
  ranked: '/images/lk/sword.webp',
  rooms: '/images/lk/heart.webp',
  journey: '/images/lk/icon-map.webp',
  quests: '/images/lk/lantern-off.webp',
}

interface GatePanelProps {
  reason: GateReason
  onClose: () => void
}

/** Guest home: what a locked board or lantern needs, and the way in (Google, or email on /login). */
export function GatePanel({ reason, onClose }: GatePanelProps) {
  const { t } = useTranslation()
  return (
    <ScenePanel onClose={onClose} labelledBy="guest-gate-title" place="gate">
      <div data-testid="guest-gate" data-reason={reason} className="flex items-start gap-3 pr-10">
        <img src={GATE_ICON[reason]} alt="" className="w-12 h-12 object-contain shrink-0" />
        <div className="min-w-0">
          <h2 id="guest-gate-title" className="m-0 text-[22px] font-extrabold leading-tight">{t(`guest.gate.${reason}.title`)}</h2>
          <p className="mt-1 mb-0 font-read text-[15px] leading-snug text-bq-ink2">{t(`guest.gate.${reason}.body`)}</p>
        </div>
      </div>
      <GoogleSignInButton testId="guest-gate-google" className="mt-4 w-full" />
      <Link to="/login" onClick={onClose} data-testid="guest-gate-email" className="block mt-3 text-center text-[14px] font-bold text-bq-ink2 underline underline-offset-4 hover:text-bq-ink">
        {t('guest.gate.email')}
      </Link>
    </ScenePanel>
  )
}
