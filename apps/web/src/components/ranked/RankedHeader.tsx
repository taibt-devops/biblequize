import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Compact page header for /ranked — title + subtitle on the left,
 * "How to play →" link top-right (mockup line 40-46). Replaces the
 * previous 3xl/4xl super-bold banner per RK-P3-1 (title too dominant
 * relative to content) and adds a soft entry point for the rules
 * tutorial per RK-P2-1 partial.
 */
export default function RankedHeader() {
  const { t } = useTranslation()

  return (
    <header className="flex items-end justify-between mb-4">
      <div>
        <h1 className="text-on-surface text-[20px] md:text-[22px] font-medium leading-tight mb-1">
          {t('ranked.title')}
        </h1>
        <p className="text-on-surface-variant/55 text-[12px] md:text-[13px]">
          {t('ranked.subtitle')}
        </p>
      </div>
      <Link
        to="/help#ranked"
        data-testid="ranked-how-to-play"
        className="text-secondary/70 hover:text-secondary text-[12px] transition-colors shrink-0"
      >
        {t('ranked.howToPlay')}
      </Link>
    </header>
  )
}
