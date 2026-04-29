import { getDailyVerse } from '../data/verses'

/**
 * Centered scripture banner for Home, V3 design. Replaces the old
 * border-left highlighted card. The verse rotates daily via
 * {@link getDailyVerse} (deterministic by day-of-year), framed by an
 * ornamental ✦ divider with gold-fading lines either side.
 *
 * No props — selection is purely time-based. Reference DOM testid
 * `home-daily-verse` is preserved so existing layout-order tests in
 * Home.test continue to assert "verse banner sits above game modes".
 */
export default function DailyVerseBanner() {
  const verse = getDailyVerse()

  return (
    <section data-testid="home-daily-verse" className="daily-verse-v3">
      <div className="daily-verse-v3-divider" aria-hidden="true">
        <span className="daily-verse-v3-divider-line" />
        <span className="daily-verse-v3-divider-ornament">✦</span>
        <span className="daily-verse-v3-divider-line right" />
      </div>
      <p data-testid="home-daily-verse-text" className="daily-verse-v3-text">
        “{verse.text}”
      </p>
      <p data-testid="home-daily-verse-ref" className="daily-verse-v3-ref">
        {verse.ref}
      </p>
    </section>
  )
}
