/**
 * @module core
 *
 * Effects on heat: cooling speed, idle cooling, Moles, burn leads and the heat tax.
 *
 * Called by: `effects/kinds/index.ts` (the {@link BuyableEffect} union). Calls: nothing.
 */
import type { ActionId } from '../../actions/actionTypes';

/** Effects on heat: cooling speed, idle cooling, Moles, burn leads and the heat tax. */
export type HeatEffect =
  /** Heat cools down `factor` times as fast per copy (shorter cooldown cycles). */
  | { readonly kind: 'heatCooldownSpeed'; readonly factor: number }
  /**
   * Every heat cooldown cycle removes `perLevel` more heat per sleeve level of `sourceActionId` (and per copy). The cycles are not
   * faster, so the cooldown still completes in discrete steps; each step is just bigger.
   */
  | { readonly kind: 'heatCooldownAmountFromSleeveLevel'; readonly sourceActionId: ActionId; readonly perLevel: number }
  /** Every Burn lead used also takes `amount` points of heat away, after its percentage (per copy). Heat never goes below 0. */
  | { readonly kind: 'burnLeadFlatHeat'; readonly amount: number }
  /** While no action is in progress, heat cools `factor` times as fast (per copy). See `heatPace.ts`. */
  | { readonly kind: 'idleHeatCooldown'; readonly factor: number }
  /**
   * An action that is running WITHOUT Overclock still counts as "no action in progress" for `idleHeatCooldown`. Does nothing without
   * an `idleHeatCooldown` buyable.
   */
  | { readonly kind: 'idleHeatCooldownAction'; readonly actionId: ActionId }
  /**
   * Moles are no longer spent: they stay and add up. Heat cools `1 + bonusPerOrder` times as fast for every order of magnitude of
   * Moles held (`log10`, none at 1 Mole or fewer), and the Moles' own cooldown boost (`backChannel`) no longer applies. Once, whatever
   * the number of copies.
   */
  | { readonly kind: 'moleAggregation'; readonly bonusPerOrder: number }
  /** The heat tax never takes more than `maxShare` of node income (0.5 = at most half), however much heat there is. The lowest cap wins. */
  | { readonly kind: 'heatTaxCap'; readonly maxShare: number };
