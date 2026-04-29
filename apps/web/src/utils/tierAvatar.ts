/**
 * Tier-level → emoji avatar mapping for the V3 Home stat-sheet hero.
 *
 * <p>Kept separate from {@code data/tiers.ts#iconEmoji} because that
 * field already feeds notifications, chat, and share cards with a
 * slightly different choice (🌿/📜 in the middle tiers). Changing those
 * surfaces would be scope creep — DECISIONS.md "Don't modify modules
 * outside the current task". The hero gets its own dedicated mapping.
 *
 * <p>Mapping picked to read as a Christian growth journey:
 * seedling → dawn → lamp → flame → star → crown.
 */
export const HERO_TIER_AVATARS: Record<number, string> = {
  1: '🌱', // tier 1 — seedling (growth start)
  2: '🌅', // tier 2 — dawn (seeking light)
  3: '🪔', // tier 3 — lamp (illuminated)
  4: '🔥', // tier 4 — flame (passionate)
  5: '⭐', // tier 5 — star (shining bright)
  6: '👑', // tier 6 — crown (glorified)
}

export function getHeroTierAvatar(tierLevel: number): string {
  return HERO_TIER_AVATARS[tierLevel] ?? HERO_TIER_AVATARS[1]
}
