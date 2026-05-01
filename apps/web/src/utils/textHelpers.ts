import React from 'react'

/**
 * Matches a Vietnamese hyphen-compound proper noun.
 *
 * - Starts with a capital letter (plus the Vietnamese accent set).
 * - Followed by one or more lowercase letters (with diacritics).
 * - Has at least one `-letters` segment after that — this is what makes
 *   the noun "compound" and prone to ugly mid-word wraps in browsers.
 *
 * Bible examples it catches: Ra-chên, Bên-gia-min, Ép-ra-ta, Bết-lê-hem,
 * Y-sác, Ai-cập, Ca-na-an. It deliberately does NOT match:
 *   - Plain words without hyphens ("Sáng", "Theo")
 *   - Verse references ("35:16-20" — digits, not letters)
 *   - Acronym-style hyphens ("T-shirt" — no lowercase between capital and `-`)
 *   - Lowercase-start hyphenations ("ad-hoc")
 */
const PROPER_NOUN_REGEX = /([A-ZĐÁẢÀẠÃÉẾỀỂỄỆÌÍỊỈĨÒÓỎỌÕÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦỤŨƯỪỨỬỮỰỲÝỶỴỸ][a-zđáảàạãéẽẻẹèêếềểễệìíịỉĩòóỏọõôồốổỗộơờớởỡợùúủụũưừứửữựỳýỷỵỹ]+(?:-[A-Za-zĐđÀ-ỹ]+)+)/g

/**
 * Wrap Vietnamese hyphen-compound proper nouns in `<span class="whitespace-nowrap">`
 * so the browser never breaks them mid-word.
 *
 * Returns a `ReactNode[]` (mix of plain strings + spans) suitable for
 * splatting into JSX directly: `<h2>{wrapProperNouns(text)}</h2>`.
 *
 * Why this matters: Bible questions like
 *   "Ra-chên qua đời ở đâu khi sinh Bên-gia-min?"
 * render with broken proper-noun wraps on narrow viewports without it
 * (BUG_REPORT_QUIZ.md QZ-P0-2). Verse refs ("35:16-20") are left alone
 * because they're already protected by the `text-wrap: pretty` CSS rule
 * applied to the question card.
 */
export function wrapProperNouns(text: string): React.ReactNode[] {
  if (!text) return []
  // String.prototype.split with a capturing group keeps the captures in
  // the result, alternating non-match / match: indices 0,2,4… are plain
  // text; 1,3,5… are proper nouns to wrap.
  const parts = text.split(PROPER_NOUN_REGEX)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return React.createElement(
        'span',
        { key: i, className: 'whitespace-nowrap' },
        part,
      )
    }
    return part
  })
}
