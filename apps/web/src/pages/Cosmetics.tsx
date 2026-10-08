import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { Medal, PlaceBackdrop, Plaque } from '../components/lk/Place'
import { PlayerCrest } from '../components/lk/PlayerCrest'

interface CosmeticItem {
  id: string
  name: string
  tier: number
  unlocked: boolean
  active: boolean
}

interface CosmeticsData {
  activeFrame: string
  activeTheme: string
  frames: CosmeticItem[]
  themes: CosmeticItem[]
}

const TIER_ICONS = ['🌱', '🌿', '📜', '🪔', '🔥', '👑']

export default function Cosmetics() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery<CosmeticsData>({
    queryKey: ['cosmetics'],
    queryFn: () => api.get('/api/me/cosmetics').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (body: { activeFrame?: string; activeTheme?: string }) =>
      api.patch('/api/me/cosmetics', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cosmetics'] }),
  })

  if (isLoading || !data) {
    return (
      <div className="relative space-y-8 max-w-4xl mx-auto animate-pulse">
        <PlaceBackdrop place="camp" veil="strong" />
        <div className="h-12 w-60 bg-bq-inset/80 border-[3px] border-bq-ink/20 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-40 bg-bq-inset/80 border-[3px] border-bq-ink/20 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const card = (active: boolean, unlocked: boolean) =>
    `relative rounded-2xl p-4 pt-5 border-[3px] transition-transform text-center ${
      active
        ? 'border-bq-ink bg-bq-amber/30 shadow-[0_4px_0_#1D2B22]'
        : unlocked
          ? 'border-bq-ink bg-bq-white shadow-[0_4px_0_#1D2B22] hover:-translate-y-0.5'
          : 'border-dashed border-bq-ink/30 bg-bq-paper/90 cursor-not-allowed'
    }`
  const status = (item: CosmeticItem) => (
    <span className={`inline-block mt-1.5 px-2 py-px rounded-full text-[12px] font-extrabold ${
      item.active ? 'bg-bq-leaf border-2 border-bq-ink' : item.unlocked ? 'text-bq-ink2' : 'text-bq-ink3'
    }`}>
      {item.unlocked
        ? (item.active ? t('gameModes.cosmeticsPage.statusActive') : t('gameModes.cosmeticsPage.statusUnlocked'))
        : t('gameModes.cosmeticsPage.statusLockedTier', { tier: item.tier })}
    </span>
  )

  return (
    <div data-testid="cosmetics-page" className="relative space-y-8 max-w-4xl mx-auto">
      <PlaceBackdrop place="camp" veil="strong" />
      {/* Header */}
      <div className="space-y-3">
        <Link to="/profile" className="inline-flex items-center gap-1 px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-full text-[14px] font-bold text-bq-ink no-underline hover:bg-bq-cream">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('profile.title')}
        </Link>
        <div>
          <Plaque className="text-[28px] md:text-[34px]">{t('gameModes.cosmeticsPage.title')}</Plaque>
        </div>
        <p className="m-0 w-fit px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[15px] text-bq-ink2">{t('gameModes.cosmeticsPage.subtitle')}</p>
      </div>

      {/* Avatar frames = the rim of your crest, previewed on your own avatar */}
      <section data-testid="cosmetics-frames-section">
        <Plaque as="h2" className="text-[20px] md:text-[22px] mb-4">{t('gameModes.cosmeticsPage.avatarFramesSection')}</Plaque>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {data.frames.map((frame) => (
            <button
              key={frame.id}
              data-testid="cosmetics-frame-item"
              onClick={() => frame.unlocked && mutation.mutate({ activeFrame: frame.id })}
              disabled={!frame.unlocked}
              aria-pressed={frame.active}
              className={card(frame.active, frame.unlocked)}
            >
              <span className={`inline-block mb-2 ${frame.unlocked ? '' : 'opacity-70'}`}>
                <PlayerCrest name={user?.name ?? '?'} avatarUrl={user?.avatar} tierId={frame.tier} frame={frame.tier} size={78} showTier={false} />
              </span>
              <p className="m-0 text-[15px] font-extrabold text-bq-ink">{frame.name}</p>
              {status(frame)}
              {!frame.unlocked && (
                <span data-testid="cosmetics-lock-icon" className="material-symbols-outlined absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-bq-white border-2 border-bq-ink/30 text-[15px] text-bq-ink3">
                  lock
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Quiz themes */}
      <section data-testid="cosmetics-themes-section">
        <Plaque as="h2" className="text-[20px] md:text-[22px] mb-4">{t('gameModes.cosmeticsPage.quizThemesSection')}</Plaque>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {data.themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => theme.unlocked && mutation.mutate({ activeTheme: theme.id })}
              disabled={!theme.unlocked}
              aria-pressed={theme.active}
              className={card(theme.active, theme.unlocked)}
            >
              <span className={`inline-flex mb-2 ${theme.unlocked ? '' : 'opacity-70'}`}>
                <Medal size={58}><span className="text-[26px] leading-none">{TIER_ICONS[theme.tier - 1]}</span></Medal>
              </span>
              <p className="m-0 text-[15px] font-extrabold text-bq-ink">{theme.name}</p>
              {status(theme)}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
