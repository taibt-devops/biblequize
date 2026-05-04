import { useTranslation } from 'react-i18next'
import { getDailyVerse } from '../data/verses'

/**
 * Daily verse card (HR-5 redesign — was a decorative footer in V4).
 * Mockup `.verse-card`: glass card with gold-tinted radial gradient,
 * `menu_book` header icon, italic verse with quote-mark decoration,
 * gold reference right-aligned. Sits in a 2-col grid on Home next to
 * BibleJourneyCard. Verse rotates daily via {@link getDailyVerse}.
 *
 * Component name kept as DailyVerseBanner — same testids preserved
 * so prior Home tests keep passing.
 */
export default function DailyVerseBanner() {
  const { t } = useTranslation()
  const verse = getDailyVerse()

  return (
    <section
      data-testid="home-daily-verse"
      className="relative overflow-hidden rounded-2xl border border-secondary/15 backdrop-blur-md p-5 md:p-6 bg-[linear-gradient(135deg,rgba(232,168,50,0.05)_0%,transparent_50%),rgba(50,52,64,0.4)]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[18px] text-secondary">menu_book</span>
        <h3
          data-testid="home-daily-verse-title"
          className="text-on-surface text-[13px] md:text-[14px] font-bold"
        >
          {t('home.verseToday')}
        </h3>
      </div>

      <p
        data-testid="home-daily-verse-text"
        className="relative pl-4 md:pl-5 text-on-surface text-[14px] md:text-[16px] italic leading-relaxed mb-3"
      >
        <span
          aria-hidden
          className="absolute left-0 -top-2 text-[28px] md:text-[32px] text-secondary leading-none font-serif"
        >
          “
        </span>
        {verse.text}
      </p>

      <p
        data-testid="home-daily-verse-ref"
        className="text-secondary text-[11px] md:text-[12px] font-bold text-right"
      >
        — {verse.ref}
      </p>
    </section>
  )
}
