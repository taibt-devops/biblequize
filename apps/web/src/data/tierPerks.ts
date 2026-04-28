/**
 * Aspirational perks shown by {@code <TierPerksTeaser>} on Home — for each
 * tier we list what the user gains by reaching THAT tier (i.e. the teaser
 * for a tier-1 user displays the perks at index 2).
 *
 * Numbers come from SPEC_USER_v3 §3.2.2 (Tier benefits — verified in code):
 *   - XP multiplier: T1=1.0, T2=1.1, T3=1.2, T4=1.3, T5=1.5, T6=2.0
 *   - Energy regen / hour: T1=20, T2=22, T3=25, T4=28, T5=30, T6=35
 *   - Streak freeze / week: T1-2=1, T3-4=2, T5-6=3
 *
 * We intentionally only surface perks that the codebase actually delivers
 * today. Avatar frames, exclusive titles, glory badges and the like
 * appear in some design docs but have no implementation — surfacing them
 * here would be a promise the app cannot keep.
 */

export interface TierPerk {
  /** Material Symbols icon name (filled). */
  icon: string
  /** i18n key under {@code home.tierPerks.<textKey>}. */
  textKey: string
  /** Interpolation params for the i18n key, when present. */
  textParams?: Record<string, string | number>
}

/**
 * Indexed by destination tier id (2-6). No entry for tier 1 because no one
 * is "moving up to" tier 1.
 */
export const TIER_PERKS: Record<number, TierPerk[]> = {
  // T2 Seeker — first XP-multiplier bump, slightly faster energy regen
  2: [
    { icon: 'bolt',          textKey: 'xpBoost',     textParams: { percent: 10 } },
    { icon: 'battery_charging_full', textKey: 'energyRegen', textParams: { perHour: 22 } },
  ],

  // T3 Disciple — second XP bump + first streak-freeze upgrade
  3: [
    { icon: 'bolt',          textKey: 'xpBoost',      textParams: { percent: 20 } },
    { icon: 'battery_charging_full', textKey: 'energyRegen',  textParams: { perHour: 25 } },
    { icon: 'ac_unit',       textKey: 'streakFreeze', textParams: { from: 1, to: 2 } },
  ],

  // T4 Sage — third XP bump, energy 28/h
  4: [
    { icon: 'bolt',          textKey: 'xpBoost',     textParams: { percent: 30 } },
    { icon: 'battery_charging_full', textKey: 'energyRegen', textParams: { perHour: 28 } },
  ],

  // T5 Prophet — big XP jump (+20pp from prev) + freeze upgrade
  5: [
    { icon: 'bolt',          textKey: 'xpBoost',      textParams: { percent: 50 } },
    { icon: 'battery_charging_full', textKey: 'energyRegen',  textParams: { perHour: 30 } },
    { icon: 'ac_unit',       textKey: 'streakFreeze', textParams: { from: 2, to: 3 } },
  ],

  // T6 Apostle — XP doubles (×2 max), top-tier energy regen
  6: [
    { icon: 'bolt',          textKey: 'xpBoostMax' },
    { icon: 'battery_charging_full', textKey: 'energyRegen', textParams: { perHour: 35 } },
  ],
}
