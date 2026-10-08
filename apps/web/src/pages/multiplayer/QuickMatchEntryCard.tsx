// QP-6 — Hero RIGHT card (indigo) — Đấu Nhanh entry point.
// Renamed via `git mv SoloArenaEntryCard.tsx` to preserve history per
// PROMPT_MULTIPLAYER_QUICKMATCH_PIVOT.md. Click → opens
// QuickMatchConfigModal (QP-6.5). Daily quota indicator wired to
// /api/me/multiplayer-stats response (QP-4 quickMatchRemainingToday).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import QuickMatchConfigModal from './QuickMatchConfigModal'

interface Props {
  /** Current user tier — used to gate AI source in the config modal. */
  userTier?: number
}

interface MultiplayerStats { quickMatchRemainingToday?: number }

export default function QuickMatchEntryCard({ userTier = 1 }: Props) {
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)
  const { data } = useQuery<MultiplayerStats>({
    queryKey: ['multiplayer-stats', 'weekly'],
    queryFn: () => api.get('/api/me/multiplayer-stats', { params: { period: 'weekly' } }).then(r => r.data),
    staleTime: 30_000,
    retry: 1,
  })
  const remaining = data?.quickMatchRemainingToday ?? 3
  const used = Math.max(0, 3 - remaining)
  const exhausted = remaining <= 0

  return (
    <>
      <div data-testid="qm-entry-card" className="rounded-bq p-6 relative bg-bq-white border-[3px] border-bq-ink shadow-bq-card">
        <span className="absolute top-5 right-5 px-2.5 py-0.5 rounded-full bg-bq-leaf border-2 border-bq-ink text-[12.5px] font-extrabold">
          ✦ {t('multiplayer.quickMatch.badgeNew')}
        </span>

        <div className="relative">
          <div className="flex items-center gap-2.5 mb-3">
            <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-10" />
            <span className="px-2.5 py-0.5 rounded-full bg-bq-paper border-2 border-bq-ink text-[12.5px] font-extrabold">
              {t('multiplayer.quickMatch.kicker')}
            </span>
          </div>

          <h2 className="m-0 font-display text-[24px] font-extrabold mb-1.5 leading-tight text-bq-ink">{t('multiplayer.quickMatch.title')}</h2>
          <p className="m-0 font-read text-[15px] text-bq-ink2 mb-4 leading-relaxed">
            {t('multiplayer.quickMatch.desc1')}{' '}
            <span dangerouslySetInnerHTML={{ __html: t('multiplayer.quickMatch.desc2') }} />
          </p>

          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Tag icon="tune" label={t('multiplayer.quickMatch.tagBookScope')} />
            <Tag icon="group" label={t('multiplayer.quickMatch.tagPlayers')} />
            <Tag icon="casino" label={t('multiplayer.quickMatch.tagSource')} />
          </div>

          <button
            type="button"
            data-testid="qm-entry-cta"
            onClick={() => setModalOpen(true)}
            disabled={exhausted}
            className="lk-btn lk-btn-2 w-full text-bq-ink text-[16px]"
          >
            <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-6" />
            {exhausted ? t('multiplayer.quickMatch.ctaExhausted') : t('multiplayer.quickMatch.cta')}
          </button>

          <div className="flex items-center justify-between mt-2.5 text-[12.5px] font-bold">
            <span
              data-testid="qm-entry-counter"
              data-used={used}
              data-remaining={remaining}
              className="text-bq-ink2"
              dangerouslySetInnerHTML={{
                __html: t('multiplayer.quickMatch.today', { used }),
              }}
            />
            <span className="text-bq-ink3">{t('multiplayer.quickMatch.noXp')}</span>
          </div>
        </div>
      </div>

      <QuickMatchConfigModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userTier={userTier}
      />
    </>
  )
}

function Tag({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[12.5px] font-bold flex items-center gap-1 bg-bq-paper border-2 border-bq-ink/30 text-bq-ink">
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </span>
  )
}
