// QP-8 — Empty state with 2 primary CTAs per mockup v3.
// Replaces the previous 4-mode quick-create grid + Solo soft-link.
// Đấu Nhanh (indigo) opens the QuickMatchConfigModal; Tạo phòng Quản
// trò (gold outline) navigates to the existing /room/create flow.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import QuickMatchConfigModal from './QuickMatchConfigModal'

const INDIGO_GRADIENT = 'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)'

interface Props {
  /** Forward to config modal so AI source can be tier-gated. */
  userTier?: number
}

export default function EmptyState({ userTier = 1 }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div
        className="rounded-2xl p-10 bg-bq-white border border-bq-hair shadow-bq-soft"
      >
        <div className="text-center max-w-md mx-auto">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(255,224,138,0.06))',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 32, color: '#D97F06', fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>

          <h4 className="font-display text-[18px] font-bold mb-2 text-bq-ink">
            {t('multiplayer.empty.title')}
          </h4>
          <p className="text-[13px] text-bq-ink2 leading-relaxed mb-6">
            {t('multiplayer.empty.subtitle')}
          </p>

          <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
            {/* Primary: Đấu Nhanh */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 h-11 rounded-lg text-white text-[13px] font-bold transition-opacity hover:opacity-90"
              style={{ background: INDIGO_GRADIENT }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
              {t('multiplayer.empty.ctaQuickMatch')}
              <span className="material-symbols-outlined ml-auto" style={{ fontSize: 14 }}>arrow_forward</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-bq-hair" />
              <div className="text-[10px] tracking-widest uppercase text-bq-ink3 font-bold">{t('multiplayer.empty.or')}</div>
              <div className="flex-1 h-px bg-bq-hair" />
            </div>

            {/* Secondary: Tạo phòng Quản trò */}
            <button
              type="button"
              onClick={() => navigate('/room/create')}
              className="flex items-center gap-2 px-4 h-11 rounded-lg text-[13px] font-bold transition-colors"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(255,224,138,0.06))',
                border: '1px solid rgba(245,158,11,0.35)',
                color: '#D97F06',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.6)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>workspace_premium</span>
              {t('multiplayer.empty.ctaCreateOrganizer')}
              <span className="material-symbols-outlined ml-auto" style={{ fontSize: 14 }}>arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      <QuickMatchConfigModal open={modalOpen} onClose={() => setModalOpen(false)} userTier={userTier} />
    </>
  )
}
