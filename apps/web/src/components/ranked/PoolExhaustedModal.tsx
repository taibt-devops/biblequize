import { useTranslation } from 'react-i18next'
import Modal from '../ui/Modal'

interface PoolExhaustedModalProps {
  isOpen: boolean
  onClose: () => void
  /** From coverageStatus.currentWeek.canUnlockNext — drives the CTA set. */
  canUnlockNext: boolean
  onUnlockNextWeek: () => void
}

/**
 * Pool-exhaustion modal (§7.11.4) — replaces the legacy alert() when the
 * week's question pool runs dry. Calming "nights" tone, not an error.
 *
 * canUnlockNext = true  → 2 CTAs: unlock next week / defer
 * canUnlockNext = false → 1 CTA:  close (pool refreshes tomorrow)
 */
export default function PoolExhaustedModal({
  isOpen,
  onClose,
  canUnlockNext,
  onUnlockNextWeek,
}: PoolExhaustedModalProps) {
  const { t } = useTranslation()

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" ariaLabel={t('ranked.pool_exhausted.title')}>
      <div data-testid="pool-exhausted-modal" style={{ textAlign: 'center' }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 60, color: '#D97F06', fontVariationSettings: "'FILL' 1" }}
        >
          nights_stay
        </span>

        <h2
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#1D2B22',
            margin: '12px 0 8px',
          }}
        >
          {t('ranked.pool_exhausted.title')}
        </h2>

        <p style={{ fontSize: 14, color: '#4D3A1F', lineHeight: 1.5, margin: 0 }}>
          {canUnlockNext
            ? t('ranked.pool_exhausted.body')
            : t('ranked.pool_exhausted.no_unlock_body')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          {canUnlockNext ? (
            <>
              <button
                type="button"
                data-testid="pool-exhausted-unlock-cta"
                onClick={() => {
                  onUnlockNextWeek()
                  onClose()
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #FF9D2E 0%, #FF5A45 55%, #B3452F 100%)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {t('ranked.pool_exhausted.unlock_cta')}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'transparent',
                  border: '1px solid #C9B58C',
                  color: '#4D3A1F',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('ranked.pool_exhausted.defer_cta')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                background: 'transparent',
                border: '1px solid #C9B58C',
                color: '#4D3A1F',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('ranked.pool_exhausted.close_cta')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
