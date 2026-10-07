import { useTranslation } from 'react-i18next'
import Modal from '../ui/Modal'

interface WeekCompleteModalProps {
  isOpen: boolean
  onClose: () => void
  completedWeek: number
  /** Empty when the user is at week 13 (Mastery — no next week). */
  nextWeekBooks: string[]
  onStartNextWeek: () => void
}

/**
 * Week-completion celebration (§7.1.5). Shown on the RankedQuizResults screen
 * after a session whose final answer completed all 6 books of the week —
 * deferred from mid-quiz per Bui UX decision (Option B, 2026-05-21).
 *
 * Mastery Week (nextWeekBooks empty) → simplified layout, single Close CTA.
 */
export default function WeekCompleteModal({
  isOpen,
  onClose,
  completedWeek,
  nextWeekBooks,
  onStartNextWeek,
}: WeekCompleteModalProps) {
  const { t } = useTranslation()
  const isMasteryWeek = nextWeekBooks.length === 0

  const verses = t('ranked.week_complete.verses', { returnObjects: true }) as string[]
  const verse = Array.isArray(verses) && verses.length > 0
    ? verses[completedWeek % verses.length]
    : ''

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md"
           ariaLabel={t('ranked.week_complete.heading_lg')}>
      <div style={{ textAlign: 'center' }}>
        {/* Celebration mark */}
        <div
          style={{
            width: 80, height: 80, margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, rgba(245,158,11,0) 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F59E0B, #D97F06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined"
                  style={{ fontSize: 36, color: '#FFFFFF', fontVariationSettings: "'FILL' 1" }}>
              check
            </span>
          </div>
        </div>

        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: '#D97F06',
        }}>
          {isMasteryWeek
            ? t('ranked.week_complete.mastery_week_heading')
            : t('ranked.week_complete.heading_sm', { week: completedWeek })}
        </div>

        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#1D2B22', margin: '6px 0 12px' }}>
          {isMasteryWeek
            ? t('ranked.week_complete.mastery_week_body')
            : t('ranked.week_complete.heading_lg')}
        </h2>

        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
          fontSize: 16, color: '#4D3A1F', lineHeight: 1.4, margin: 0,
        }}>
          {verse}
        </p>

        {!isMasteryWeek && (
          <div style={{
            marginTop: 20, padding: '12px 14px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#D97F06', marginBottom: 8,
            }}>
              {t('ranked.week_complete.next_week_label', { next: completedWeek + 1 })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {nextWeekBooks.map((book) => (
                <span
                  key={book}
                  style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    color: '#D97F06',
                    background: 'rgba(245,158,11,0.15)',
                    border: '1px solid rgba(245,158,11,0.3)',
                  }}
                >
                  {book}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          {!isMasteryWeek && (
            <button
              type="button"
              onClick={() => { onStartNextWeek(); onClose() }}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #FF9D2E 0%, #FF5A45 55%, #B3452F 100%)',
                color: '#FFFFFF', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}
            >
              {t('ranked.week_complete.start_next_cta', { next: completedWeek + 1 })}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 12,
              background: 'transparent',
              border: '1px solid #C9B58C',
              color: '#4D3A1F', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isMasteryWeek
              ? t('ranked.week_complete.close_cta')
              : t('ranked.week_complete.defer_cta')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
