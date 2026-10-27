/**
 * @module core
 *
 * The effect kinds of the newer re-sleeve skills (retention, reach, synthetics, corporation lanes). They are part of
 * {@link BuyableEffect}; they live in their own file only to keep `buyableTypes.ts` small. Their registry entries are in
 * `resleeveEffects.ts`.
 */
import type { BuyableId } from './buyableTypes';

/** The effect kinds of the newer re-sleeve skills. */
export type ResleeveEffect =
  /**
   * Lets the buyable `targetId` be bought `extra` more times than its own `maxPurchases` (a whole number >= 1), while this one is owned.
   * Applies once, whatever the number of copies. Faster conditioning's floor of runs drops with it, one run per extra copy (see `Progression.runsPerSleeveXp`).
   */
  | { readonly kind: 'buyableCapBonus'; readonly targetId: BuyableId; readonly extra: number }
  /**
   * Several Focus slots may sit on the same action (add and remove buttons instead of one toggle). Each slot on an action multiplies its
   * speed by `1 + focus.speedBonus` again. Sleeve-wide; applies once, whatever the number of copies.
   */
  | { readonly kind: 'focusStacking' }
  /** Every re-sleeve gives `count` synthetic sleeves (a whole number >= 2) instead of one. The one bought with the skill stays single. Read by `SynthSleeves`. */
  | { readonly kind: 'synthsPerResleeve'; readonly count: number }
  /** Interface speed is multiplied by `1 + perLn x ln(1 + number of synthetic sleeves)`, per copy, before the hacking multiplier. Sleeve-wide. */
  | { readonly kind: 'interfaceSpeedPerLnSynths'; readonly perLn: number }
  /**
   * An action whose action level is below the highest level a synthetic sleeve reached on it earns `factor` (> 1) times the action XP per
   * run. Needs the levels of finished runs (`SleeveRunRecord.actionLevels`). Sleeve-wide; applies once.
   */
  | { readonly kind: 'synthXpBoost'; readonly factor: number }
  /** Every synthetic sleeve earns at least what the sleeve's own network earns right now (see `SynthSleeves.creditsPerSecond`). Read by `SynthSleeves`. */
  | { readonly kind: 'perfectCopies' }
  /** Corporation actions run faster by `1 + perLn x ln(1 + number of synthetic sleeves)`, per copy, on top of their action level. Read by `Corporation.durationMs`. */
  | { readonly kind: 'corporationSpeedPerLnSynths'; readonly perLn: number }
  /** Opens the option to buy synthetic sleeves on the Corporation tab (what it does is not designed yet; this is only the unlock). Read by `Corporation`. */
  | { readonly kind: 'unlocksSynthPurchase' };
