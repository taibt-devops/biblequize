/**
 * Achievement icons are stored as loose names ("FLAME", "zap", "book_2"). Material Symbols needs
 * lower-case ligature names, and a few legacy names have no ligature at all.
 */
const ALIASES: Record<string, string> = {
  flame: 'local_fire_department',
  fire: 'local_fire_department',
  zap: 'bolt',
  lightning: 'bolt',
  book: 'menu_book',
  books: 'menu_book',
  crown: 'crown',
  star: 'star',
  trophy: 'emoji_events',
  target: 'target',
  shield: 'shield',
}

export function achievementIcon(raw: string | null | undefined, fallback = 'emoji_events'): string {
  const name = (raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!name) return fallback
  return ALIASES[name] ?? name
}
