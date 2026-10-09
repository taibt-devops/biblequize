import { useTranslation } from 'react-i18next'
import { lanternState, type TimeOfDay } from './sceneData'
import s from './HomeScene.module.css'

export interface Quest {
  description?: string
  progress?: number
  target?: number
  completed?: boolean
}

interface QuestLanternsProps {
  quests: Quest[]
  tod: TimeOfDay
  onOpen: () => void
  /** Guest home: no quests yet; each dark lantern says this instead of a quest and its status. */
  hint?: string
}

/**
 * Today's quests as three lanterns in the picture (LKF-3): lit = done, flickering = in progress,
 * dark = not started. No words in the scene; hover / focus names the quest, a tap opens the list.
 * Desktop: on the left stone wall. Phone: in front of the wall by the signpost.
 */
export default function QuestLanterns({ quests, tod, onOpen, hint }: QuestLanternsProps) {
  const { t } = useTranslation()
  const tone = tod === 'night' ? s.night : ''
  const rows: Quest[] = quests.length > 0
    ? quests.slice(0, 3)
    : [0, 1, 2].map(() => ({ description: t('home.lk.questsEmpty') as string, progress: 0, target: 1 }))

  return (
    <div
      data-testid="home-daily-missions"
      className={`absolute z-[4] left-[83.6%] top-[65.6%] w-[11.4%] md:left-[9.6%] md:top-[48.6%] md:w-[12%] flex justify-between items-end ${tone}`}
    >
      {rows.map((q, i) => {
        const progress = q.progress ?? 0
        const target = q.target ?? 1
        const state = lanternState(progress, target, q.completed)
        const status = state === 'lit' ? t('home.lk.lanternDone') : state === 'burning' ? `${progress}/${target}` : t('home.lk.lanternTodo')
        return (
          <button
            key={i}
            type="button"
            onClick={onOpen}
            aria-label={hint ?? `${q.description ?? ''}: ${status}`}
            className="group relative w-[3.6cqw] md:w-[3.9cqw] transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none"
          >
            {state !== 'dark' && <span aria-hidden className={`${s.glow} ${state === 'lit' ? s.glowLit : s.glowBurning}`} />}
            <img
              src={state === 'dark' ? '/images/lk/lantern-off.webp' : '/images/lk/lantern-on.webp'}
              alt=""
              className={`relative mx-auto h-[6.4cqw] md:h-[6.6cqw] ${state === 'lit' ? s.lampLit : state === 'burning' ? s.lampBurning : s.lampDark}`}
            />
            <span className="hidden md:block pointer-events-none absolute left-0 bottom-[104%] z-20 px-3 py-1.5 bg-bq-white border-[3px] border-bq-ink rounded-2xl shadow-[0_5px_0_#1D2B22] text-[15px] font-bold text-bq-ink whitespace-nowrap opacity-0 translate-y-1.5 transition group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
              {hint ?? <><span>{q.description}</span> · <span>{status}</span></>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
