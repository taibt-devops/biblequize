import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SCENE_IMAGE, SCENE_WIDE, type TimeOfDay } from './sceneData'
import { SceneAmbient } from './SceneDecor'

/** Phone: a window on the core's right half (traveller + signpost). Desktop: the core centred. */
const CORE_BOX = 'absolute top-0 right-0 h-full aspect-[3/2] translate-x-[1.8%] md:right-auto md:left-1/2 md:-translate-x-1/2'

/** Phone height of the picture with Home's HUD row (~132px) underneath. */
export const PHONE_HEIGHT_HOME = 'h-[clamp(400px,calc(100dvh_-_58px_-_132px_-_var(--mobile-nav-h)),547px)]'

interface SceneStageProps {
  tod: TimeOfDay
  testId: string
  /** Accessible name of the picture. */
  label: string
  /** Phone height of the picture (a Tailwind class); desktop always fills the screen. */
  phoneHeight?: string
  /** Things that belong to the painting; positions are % of the 3:2 core. */
  core: ReactNode
  /** Over the picture, placed against the screen (e.g. the player plate). */
  overlay?: ReactNode
  /** After the picture: under it on phones; on desktop each places itself over it (cqh units). */
  children?: ReactNode
}

/**
 * The painted crossroads shared by Home and the guest home (LKF-3): the painting of the hour
 * (3:2 core; on desktop the 3:1 panorama around it fills the screen width), its ambient light,
 * and a size container so the HUD, plate and cards scale with the screen height.
 */
export default function SceneStage({ tod, testId, label, phoneHeight = PHONE_HEIGHT_HOME, core, overlay, children }: SceneStageProps) {
  const { t } = useTranslation()
  return (
    <div
      data-testid={testId}
      className="relative w-full md:[--sh:min(calc(100dvh_-_70px),calc(100vw_/_1.5))] md:h-[var(--sh)] md:[container-type:size]"
    >
      <section
        aria-label={label}
        className={`relative overflow-hidden bg-bq-track border-b-[3px] border-bq-ink ${phoneHeight} md:absolute md:inset-0 md:h-auto md:border-b-4`}
      >
        <picture className={`${CORE_BOX} md:aspect-[3/1]`}>
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
        <div className={`${CORE_BOX} [container-type:inline-size]`}>{core}</div>
        {overlay}
      </section>
      {children}
    </div>
  )
}
