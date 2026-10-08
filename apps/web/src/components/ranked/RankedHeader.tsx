import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plaque } from '../lk/Place'

/**
 * /ranked title (LKF-9): the arena's wooden plaque with the sword, the promise of the mode on a
 * cream ribbon, and "how to play" as a round wooden tag.
 */
export default function RankedHeader() {
  const { t } = useTranslation()

  return (
    <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
      <div className="min-w-0 space-y-3">
        <Plaque className="text-[28px] md:text-[38px]">
          <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-[0.95em]" />
          {t('ranked.titleLeading')} {t('ranked.titleAccent')}
        </Plaque>
        <p className="m-0 w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[14px] md:text-[15px] text-bq-ink2">
          {t('ranked.subtitle')}
        </p>
      </div>
      <Link
        to="/help#ranked"
        data-testid="ranked-how-to-play"
        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-bq-white border-2 border-bq-ink rounded-full text-[14px] font-extrabold shadow-[0_3px_0_#1D2B22] hover:bg-bq-cream active:translate-y-[3px] active:shadow-none"
      >
        <span aria-hidden className="grid place-items-center w-5 h-5 rounded-full bg-bq-amber border-2 border-bq-ink text-[11px] leading-none">?</span>
        {t('ranked.howToPlay')}
      </Link>
    </header>
  )
}
