import { getDailyVerse } from '../data/verses'

/**
 * Decorative scripture footer at the bottom of Home (mockup line
 * 308-311). Pure ornament — italic serif quote + gold-muted reference,
 * centered, opacity 0.7. Deliberately not clickable so the devotional
 * moment doesn't bounce the user into a quiz screen. Verse rotates
 * daily via {@link getDailyVerse} (deterministic by day-of-year).
 */
export default function DailyVerseBanner() {
  const verse = getDailyVerse()

  return (
    <section
      data-testid="home-daily-verse"
      className="text-center py-3 md:py-4 opacity-70"
    >
      <p
        data-testid="home-daily-verse-text"
        className="font-serif italic text-on-surface-variant/55 text-[11px] md:text-[12px] leading-relaxed"
      >
        “{verse.text}”
      </p>
      <p
        data-testid="home-daily-verse-ref"
        className="text-[9px] md:text-[10px] mt-1 tracking-[0.4px] md:tracking-[0.5px]"
        style={{ color: 'rgba(232,168,50,0.5)' }}
      >
        — {verse.ref}
      </p>
    </section>
  )
}
