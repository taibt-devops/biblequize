import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SIGN_BOARDS, timeOfDay, type SignMode } from './sceneData'
import SceneStage from './SceneStage'
import SignBoards from './SignBoards'
import QuestLanterns from './QuestLanterns'
import { Medal } from './HomeHud'
import { FlyingDove } from './SceneDove'
import { Footprints, SceneGlow, SpeechBubble, Traveller } from './SceneDecor'
import { GatePanel, type GateReason } from './ScenePanel'
import GoogleSignInButton from '../../auth/GoogleSignInButton'
import QuizLanguageSelect from '../../QuizLanguageSelect'

/** Boards that need an account. Practice and today's letter stay open to visitors. */
export const GUEST_LOCKED: SignMode[] = ['ranked', 'rooms', 'journey']

/** Questions in today's letter (DailyChallengeService default). */
const LETTER_QUESTIONS = 5

/** Phone: the picture leaves room for the welcome card and the link row underneath. */
const PHONE_HEIGHT = 'h-[clamp(260px,calc(100dvh_-_58px_-_320px_-_var(--mobile-nav-h)),500px)]'

/**
 * Who we are and the way in, at the top-left of the picture (desktop) or right under it (phone).
 * The only h1 of the page: the guest home's headline for search engines too.
 */
function WelcomeCard() {
  const { t } = useTranslation()
  return (
    <div
      data-testid="guest-welcome"
      className="relative z-[6] mx-3.5 mt-4 px-4 py-3.5 bg-bq-white border-[3px] border-bq-ink rounded-[20px] shadow-[0_5px_0_rgba(29,43,34,.4)] md:absolute md:m-0 md:left-[2.4%] md:top-[4%] md:w-[max(360px,58cqh)] md:px-[3cqh] md:py-[2.6cqh]"
    >
      <h1 className="m-0 text-[24px] md:[font-size:max(26px,4.7cqh)] leading-[1.08] font-extrabold tracking-[-0.01em] text-bq-ink">
        {t('guest.title')}
      </h1>
      <p className="mt-2 mb-0 font-read text-[15px] md:[font-size:max(15px,2.15cqh)] leading-snug text-bq-ink2">
        {t('guest.intro')}
      </p>
      <div className="mt-3.5 md:mt-[2.4cqh] flex flex-col items-stretch sm:items-start gap-2.5 md:gap-[1.7cqh]">
        <GoogleSignInButton testId="guest-google" className="w-full sm:w-auto" />
        <Link
          to="/daily"
          data-testid="guest-try"
          className="text-center sm:text-left whitespace-nowrap text-[15px] md:[font-size:max(14px,2cqh)] font-bold text-bq-ink underline decoration-2 underline-offset-4 hover:text-bq-amberd"
        >
          {t('guest.try')}
        </Link>
      </div>
    </div>
  )
}

/** Desktop shortcuts in the HUD corner: what BibleQuiz is, and the national board. */
function GuestHud() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('guest.hudNav')} className="hidden md:flex absolute z-[6] left-[2.4%] bottom-[4.5%] gap-[3.9cqh] items-start">
      <Medal to="/gioi-thieu" testId="guest-about" icon="/images/lk/scroll.webp" label={t('guest.hud.about')} tip={t('guest.hud.aboutTip')} />
      <Medal to="/leaderboard" testId="guest-ranking" icon="/images/lk/icon-trophy.webp" label={t('guest.hud.ranking')} tip={t('guest.hud.rankingTip')} />
    </nav>
  )
}

/** The small print every home page needs (Google sign-in requires the privacy link) + language. */
function GuestLinks() {
  const { t } = useTranslation()
  const link = 'font-bold text-bq-ink2 hover:text-bq-ink underline-offset-4 hover:underline'
  return (
    <nav
      aria-label={t('guest.linksNav')}
      className="relative z-[6] mx-3.5 mt-3 mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] md:absolute md:m-0 md:right-[2.4%] md:bottom-[3%] md:px-3 md:py-1 md:bg-bq-white/85 md:border-2 md:border-bq-ink md:rounded-full"
    >
      <Link to="/gioi-thieu" className={`${link} md:hidden`}>{t('guest.hud.about')}</Link>
      <Link to="/cau-do-kinh-thanh" className={link}>{t('guest.links.riddles')}</Link>
      <Link to="/help" className={link}>{t('guest.links.help')}</Link>
      <Link to="/privacy" className={link}>{t('guest.links.privacy')}</Link>
      <Link to="/terms" className={link}>{t('guest.links.terms')}</Link>
      <QuizLanguageSelect className="!p-0.5 !bg-transparent" />
    </nav>
  )
}

/**
 * The guest home (2026-10-09): the same crossroads as Home, so a visitor sees the game itself.
 * Practice and today's letter are open; Ranked, Rooms, Journey and the quest lanterns carry a
 * padlock and open a sign-in card. The welcome card says what BibleQuiz is in two sentences.
 */
export default function GuestScene() {
  const { t } = useTranslation()
  const tod = timeOfDay(new Date().getHours())
  const [hovered, setHovered] = useState<SignMode | null>(null)
  const [gate, setGate] = useState<GateReason | null>(null)
  const goKey = hovered && GUEST_LOCKED.includes(hovered)
    ? `guest.goLocked.${hovered}`
    : SIGN_BOARDS.find(b => b.mode === hovered)?.goKey

  return (
    <SceneStage
      tod={tod}
      testId="guest-scene"
      label={t('home.signpost.nav')}
      phoneHeight={PHONE_HEIGHT}
      core={<>
        <SceneGlow tod={tod} />
        <QuestLanterns quests={[]} tod={tod} hint={t('guest.lanternHint')} onOpen={() => setGate('quests')} />
        <Footprints />
        <Traveller tod={tod} />
        <SignBoards tod={tod} onHover={setHovered} locked={GUEST_LOCKED} onLocked={mode => setGate(mode as GateReason)} />
        <FlyingDove questionCount={LETTER_QUESTIONS} xp={0} tod={tod} ariaLabel={t('guest.doveAria', { count: LETTER_QUESTIONS })} />
        <SpeechBubble mode="guest" hovered={hovered} goKey={goKey} xp={0} questionCount={LETTER_QUESTIONS} />
      </>}
    >
      <WelcomeCard />
      <GuestHud />
      <GuestLinks />
      {gate && <GatePanel reason={gate} onClose={() => setGate(null)} />}
    </SceneStage>
  )
}
