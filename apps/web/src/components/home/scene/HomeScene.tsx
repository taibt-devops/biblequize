import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDailyVerse } from '../../../data/verses'
import { SCENE_IMAGE, SCENE_WIDE, SIGN_BOARDS, lanternState, timeOfDay, type SignMode } from './sceneData'
import SignBoards from './SignBoards'
import PlayerPlate from './PlayerPlate'
import QuestLanterns, { type Quest } from './QuestLanterns'
import HomeHud from './HomeHud'
import { FlyingDove, PerchedDove } from './SceneDove'
import { Footprints, SceneAmbient, SceneGlow, SpeechBubble, StartHereHand, Traveller } from './SceneDecor'
import { QuestPanel, VersePanel } from './ScenePanel'

/** Max XP of the daily challenge (DailyChallengeService.DAILY_XP_BY_CORRECT, 5/5 correct). */
const DAILY_MAX_XP = 150

export interface HomeSceneProps {
  greeting: string
  userName: string
  tierId: number
  tierLabel: string
  nextTierLabel: string | null
  progressPct: number
  points: number
  nextMinPoints?: number
  pointsToNext: number
  /** No XP, no streak, daily not done: show the first-visit hand (HO-1). */
  isNewUser: boolean
  daily: { done: boolean; questionCount: number; correct: number; total: number }
  quests: Quest[]
  journey: { book: string; pct: number } | null
  rank: { rank: number; points: number } | null
  season: { name: string; daysLeft: number } | null
  verseDue: number
}

/**
 * Home as one game scene (LKF-3, mockup "BibleQuiz x Lu Khach" v4): a painted crossroads that
 * follows the hour (day / sunset / night), the ways to play hung on the signpost as living
 * boards, quests as lanterns, today's challenge brought by a dove, shortcuts as HUD medals.
 *
 * Layout. The 3:2 "core" of the painting holds everything that belongs to the picture (boards,
 * traveller, lanterns, dove, bubble); positions are % of the core.
 * - Desktop: full width, as tall as the screen allows (--sh). The core is centred and the
 *   panorama painted around it (3:1) fills the sides, so wide screens show more countryside
 *   instead of empty margins. Plate and HUD sit in the screen corners, sized in cqh.
 * - Phone: a window on the core's right half (traveller + signpost), HUD as a row underneath.
 */
export default function HomeScene(p: HomeSceneProps) {
  const { t } = useTranslation()
  const tod = timeOfDay(new Date().getHours())
  const [hovered, setHovered] = useState<SignMode | null>(null)
  const [panel, setPanel] = useState<'verse' | 'quests' | null>(null)
  const verse = getDailyVerse()
  const goKey = SIGN_BOARDS.find(b => b.mode === hovered)?.goKey
  const questsDone = p.quests.filter(q => lanternState(q.progress ?? 0, q.target ?? 1, q.completed) === 'lit').length
  const bubble = p.isNewUser ? 'first' : p.daily.done ? 'ask' : 'letter'
  // phone: right-anchored window on the core; desktop: centred
  const coreBox = 'absolute top-0 right-0 h-full aspect-[3/2] translate-x-[1.8%] md:right-auto md:left-1/2 md:-translate-x-1/2'

  return (
    <div
      data-testid="home-scene"
      className="relative w-full md:[--sh:min(calc(100dvh_-_70px),calc(100vw_/_1.5))] md:h-[var(--sh)] md:[container-type:size]"
    >
      <section
        aria-label={t('home.signpost.nav')}
        className="relative overflow-hidden bg-bq-track border-b-[3px] border-bq-ink h-[clamp(400px,calc(100dvh_-_58px_-_132px_-_var(--mobile-nav-h)),547px)] md:absolute md:inset-0 md:h-auto md:border-b-4"
      >
        {/* the painting: phone = the 3:2 core, desktop = the 3:1 panorama around it */}
        <picture className={`${coreBox} md:aspect-[3/1]`}>
          <source media="(min-width: 768px)" srcSet={SCENE_WIDE[tod]} />
          <img
            src={SCENE_IMAGE[tod]}
            alt={t('home.signpost.sceneAlt')}
            fetchPriority="high"
            draggable={false}
            className="absolute inset-0 w-full h-full select-none"
          />
        </picture>
        <SceneAmbient tod={tod} />

        <div className={`${coreBox} [container-type:inline-size]`}>
          <SceneGlow tod={tod} />
          <QuestLanterns quests={p.quests} tod={tod} onOpen={() => setPanel('quests')} />
          <Footprints />
          <Traveller tod={tod} />
          <SignBoards tod={tod} onHover={setHovered} />
          {p.daily.done
            ? <PerchedDove correct={p.daily.correct} total={p.daily.total} tod={tod} />
            : <FlyingDove questionCount={p.daily.questionCount} xp={DAILY_MAX_XP} tod={tod} />}
          <SpeechBubble mode={bubble} hovered={hovered} goKey={goKey} xp={DAILY_MAX_XP} />
          {p.isNewUser && <StartHereHand />}
        </div>

        <PlayerPlate
          greeting={p.greeting}
          userName={p.userName}
          tierId={p.tierId}
          tierLabel={p.tierLabel}
          nextTierLabel={p.nextTierLabel}
          progressPct={p.progressPct}
          points={p.points}
          nextMinPoints={p.nextMinPoints}
          pointsToNext={p.pointsToNext}
        />
      </section>

      <HomeHud
        journey={p.journey}
        rank={p.rank}
        verseDue={p.verseDue}
        verseRef={verse.ref}
        season={p.season}
        quests={{ done: questsDone, total: p.quests.length || 3 }}
        onOpenVerse={() => setPanel('verse')}
        onOpenQuests={() => setPanel('quests')}
      />

      {panel === 'verse' && <VersePanel text={verse.text} verseRef={verse.ref} due={p.verseDue} onClose={() => setPanel(null)} />}
      {panel === 'quests' && <QuestPanel quests={p.quests} onClose={() => setPanel(null)} />}
    </div>
  )
}
