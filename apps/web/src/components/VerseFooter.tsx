import { getDailyVerse } from '../data/verses'

interface VerseFooterProps {
  /** Override the daily verse for tests / preview contexts. */
  verse?: { text: string; ref: string }
  /** Source translation note appended to the cite line. Default = "BTTHĐ 2011"
   *  per CLAUDE.md C4 canonical (Vietnamese audience). */
  source?: string
}

/**
 * Footer-style verse — Cormorant Garamond italic 22px centered, with a
 * gold line + star ornament above and an em-dash uppercase cite below.
 * Per home_modern.html `.verse-section`. This is the ONLY component
 * allowed to render Cormorant Garamond per HR-1 typography rules.
 *
 * The gold drop cap (HR-8) was removed 2026-05-20 per user request —
 * the floated "::first-letter" broke center alignment on short verses
 * and competed visually with the ornament star above. CSS rule
 * `.hr-verse-text::first-letter` remains in global.css for now in case
 * a future page wants to opt in; no component uses the class.
 */
export default function VerseFooter({ verse, source = 'BTTHĐ 2011' }: VerseFooterProps = {}) {
  const v = verse ?? getDailyVerse()

  return (
    <section
      data-testid="verse-footer"
      className="relative mt-8 pt-7"
    >
      {/* Ornament: line · star · line. flex-1 spans expand to fill
          remaining space (capped at 200px each on wide screens) so the
          two gold-gradient lines flank the star symmetrically. h-[2px]
          + 0.6 alpha keeps the lines readable without competing with
          the verse below. Per Bui review 2026-05-14: bumped from h-px
          / 0.4 alpha which were too faint to register. */}
      <div
        aria-hidden
        data-testid="verse-footer-ornament"
        className="flex items-center justify-center gap-3 mb-5"
      >
        <span
          data-testid="verse-footer-ornament-line"
          className="block flex-1 max-w-[200px] h-[2px]"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(232,168,50,0.6), transparent)',
          }}
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e8a832"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
          className="shrink-0"
        >
          <path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" />
        </svg>
        <span
          data-testid="verse-footer-ornament-line"
          className="block flex-1 max-w-[200px] h-[2px]"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(232,168,50,0.6), transparent)',
          }}
        />
      </div>

      <p
        data-testid="verse-footer-text"
        className="font-verse italic text-[18px] md:text-[22px] font-medium text-ivory text-center max-w-[720px] mx-auto px-4 md:px-8 leading-[1.55]"
      >
        {v.text}
      </p>

      <div
        data-testid="verse-footer-cite"
        className="text-center mt-4 text-[12.5px] font-semibold text-ivory-dim"
      >
        <span className="text-ivory-faint mr-2">—</span>
        {v.ref} · {source}
        <span className="text-ivory-faint ml-2">—</span>
      </div>
    </section>
  )
}
