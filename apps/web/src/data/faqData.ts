/**
 * FAQ content registry for the /help page.
 *
 * <p>Each item maps an {@link id} (used for deep-link anchors, e.g.
 * {@code /help#howUnlockRanked}) to an i18n key under
 * {@code help.items.<id>} providing both question + answer in each
 * supported language.
 *
 * <p>Categories are ordered; inside a category items render in the
 * array order. Adding a new topic:
 * <ol>
 *   <li>Append entry here with a unique, stable {@link id}.</li>
 *   <li>Add {@code help.items.<id>.q} and {@code help.items.<id>.a}
 *       translations to both {@code vi.json} and {@code en.json}.</li>
 *   <li>Category label lives at {@code help.categories.<category>}.</li>
 * </ol>
 */
export type FaqCategory =
  | 'gettingStarted'
  | 'tiers'
  | 'modes'
  | 'gameplay'
  | 'account'

export interface FaqItem {
  /** Stable slug used for deep-link anchors. Lower-camelCase. */
  id: string
  category: FaqCategory
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  'gettingStarted',
  'tiers',
  'modes',
  'gameplay',
  'account',
]

export const FAQ_ITEMS: FaqItem[] = [
  // Getting started
  { id: 'howToPlay',         category: 'gettingStarted' },
  { id: 'bibleTranslation',  category: 'gettingStarted' },
  { id: 'changeLanguage',    category: 'gettingStarted' },
  // Tier & XP
  { id: 'tierSystem',        category: 'tiers' },
  { id: 'streakVsXp',        category: 'tiers' },
  { id: 'howUnlockRanked',   category: 'tiers' },
  { id: 'howEarnXp',         category: 'tiers' },
  // Game modes
  { id: 'practiceVsRanked',  category: 'modes' },
  { id: 'dailyStreak',       category: 'modes' },
  { id: 'groupsTournament',  category: 'modes' },
  // Gameplay mechanics
  { id: 'energySystem',      category: 'gameplay' },
  { id: 'lifelines',         category: 'gameplay' },
  // Account & privacy
  { id: 'dataPrivacy',       category: 'account' },
  { id: 'deleteAccount',     category: 'account' },
]
