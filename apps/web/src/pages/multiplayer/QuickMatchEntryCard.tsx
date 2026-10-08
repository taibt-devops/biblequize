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

const QM = {
  primary: '#2F6FB0',
  primaryLight: '#2F6FB0',
  primaryLighter: '#2F6FB0',
  gradient: 'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)',
  tintBg: 'rgba(47,111,176,0.10)',
  tintBgSoft: 'rgba(47,111,176,0.03)',
  tintBorder: 'rgba(47,111,176,0.22)',
}

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
      <div
        data-testid="qm-entry-card"
        className="rounded-2xl p-6 relative overflow-hidden transition-transform bg-bq-white shadow-bq-soft"
        style={{
          border: `1px solid ${QM.tintBorder}`,
        }}
      >
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(47,111,176,0.10) 0%, transparent 70%)' }}
        />

        {/* MỚI badge with shimmer */}
        <div
          className="absolute top-5 right-5 flex items-center gap-1 px-2 py-1 rounded-md"
          style={{ background: 'rgba(47,111,176,0.12)', border: '1px solid rgba(47,111,176,0.30)' }}
        >
          <span
            className="material-symbols-outlined animate-pulse"
            style={{ fontSize: 12, color: QM.primaryLight, fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <span className="text-[12px] font-bold" style={{ color: QM.primaryLighter }}>
            {t('multiplayer.quickMatch.badgeNew')}
          </span>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: QM.gradient }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff', fontVariationSettings: "'FILL' 1" }}>
                rocket_launch
              </span>
            </div>
            <div className="text-[12px] font-bold" style={{ color: QM.primaryLighter }}>
              {t('multiplayer.quickMatch.kicker')}
            </div>
          </div>

          <h2 className="font-display text-[20px] font-extrabold mb-1.5 leading-tight text-bq-ink">{t('multiplayer.quickMatch.title')}</h2>
          <p className="text-[12.5px] text-bq-ink2 mb-4 leading-relaxed">
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
            className="w-full inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: QM.gradient }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
            {exhausted ? t('multiplayer.quickMatch.ctaExhausted') : t('multiplayer.quickMatch.cta')}
            {!exhausted && (
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            )}
          </button>

          <div className="flex items-center justify-between mt-2.5 text-[10px]">
            <span
              data-testid="qm-entry-counter"
              data-used={used}
              data-remaining={remaining}
              className="text-bq-ink3"
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
    <span
      className="px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1"
      style={{
        background: 'rgba(47,111,176,0.08)',
        border: '1px solid rgba(47,111,176,0.18)',
        color: '#2F6FB0',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{icon}</span>
      {label}
    </span>
  )
}
