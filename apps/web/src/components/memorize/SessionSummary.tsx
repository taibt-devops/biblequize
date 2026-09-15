import { useTranslation } from 'react-i18next'

interface SessionSummaryProps {
  reviewed: number
  leveledUp: number
  onBack: () => void
}

/** End of a review session — counts only, no score (Memorize has no XP by design). */
export default function SessionSummary({ reviewed, leveledUp, onBack }: SessionSummaryProps) {
  const { t } = useTranslation()
  return (
    <section data-testid="memorize-summary" className="rounded-2xl border border-bq-hair bg-bq-white p-6 text-center shadow-bq-soft">
      <h2 className="font-display text-xl font-bold text-bq-ink">{t('memorize.session.summaryTitle')}</h2>
      <p className="mt-2 text-sm text-bq-ink2">{t('memorize.session.summaryReviewed', { count: reviewed })}</p>
      {leveledUp > 0 && (
        <p className="mt-1 text-sm font-semibold text-bq-emerald">{t('memorize.session.summaryLeveled', { count: leveledUp })}</p>
      )}
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-xl bg-bq-action px-5 py-2.5 text-sm font-semibold text-white shadow-bq-action hover:brightness-105"
      >
        {t('memorize.session.backToList')}
      </button>
    </section>
  )
}
