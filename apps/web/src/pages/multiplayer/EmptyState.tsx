// QP-8 — Empty state with 2 primary CTAs per mockup v3.
// Replaces the previous 4-mode quick-create grid + Solo soft-link.
// Đấu Nhanh (indigo) opens the QuickMatchConfigModal; Tạo phòng Quản
// trò (gold outline) navigates to the existing /room/create flow.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import QuickMatchConfigModal from './QuickMatchConfigModal'

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
      <div className="rounded-bq p-8 md:p-10 bg-bq-white border-[3px] border-bq-ink shadow-bq-card">
        <div className="text-center max-w-md mx-auto">
          <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-28 mb-3" />
          <h4 className="m-0 font-display text-[22px] font-extrabold mb-2 text-bq-ink">
            {t('multiplayer.empty.title')}
          </h4>
          <p className="m-0 font-read text-[15px] text-bq-ink2 leading-relaxed mb-6">
            {t('multiplayer.empty.subtitle')}
          </p>

          <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
            <button type="button" onClick={() => setModalOpen(true)} className="lk-btn lk-btn-2 w-full text-bq-ink text-[15px]">
              <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-6" />
              {t('multiplayer.empty.ctaQuickMatch')}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t-2 border-dashed border-bq-ink/25" />
              <div className="text-[13px] text-bq-ink2 font-extrabold">{t('multiplayer.empty.or')}</div>
              <div className="flex-1 border-t-2 border-dashed border-bq-ink/25" />
            </div>

            <button type="button" onClick={() => navigate('/room/create')} className="lk-btn w-full text-bq-ink text-[15px]">
              <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-6" />
              {t('multiplayer.empty.ctaCreateOrganizer')}
            </button>
          </div>
        </div>
      </div>

      <QuickMatchConfigModal open={modalOpen} onClose={() => setModalOpen(false)} userTier={userTier} />
    </>
  )
}
