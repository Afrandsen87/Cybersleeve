/**
 * @module core
 *
 * Effects of the corporation: unlocking it, its rank and the effects its actions gain.
 *
 * Called by: `effects/kinds/index.ts` (the {@link BuyableEffect} union). Calls: nothing.
 */
import type { CorporationEffect } from '../../corporation/corporationTypes';

/** Effects of the corporation: unlocking it, its rank and the effects its actions gain. */
export type CorporationKindEffect =
  /** Opens the Corporation tab (and lets its actions be started) while owned. See `corporation.ts`. */
  | { readonly kind: 'unlocksCorporation' }
  /**
   * Raises the corporation's rank by `amount` per copy (an integer >= 1), on top of `corporation.baseRank`. The rank gates the
   * corporation's actions (`CorporationActionDefinition.requiredRank`), like the access level gates the character's. The buyable is
   * shown in the Asset Acquisition widget, and it survives re-sleeving because the corporation does.
   */
  | { readonly kind: 'corporateRank'; readonly amount: number }
  /**
   * Adds `effect` to what every completed run of the buyable's corporation action does (`BuyableDefinition.corporationActionId`), once
   * owned. Applies once, whatever the number of copies. Like the corporation, the buyable survives re-sleeving.
   */
  | { readonly kind: 'addsCorporationEffect'; readonly effect: CorporationEffect };
