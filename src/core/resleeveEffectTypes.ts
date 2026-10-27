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
  | { readonly kind: 'focusStacking' };
