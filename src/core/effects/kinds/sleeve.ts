/**
 * @module core
 *
 * Effects that change the sleeve as a whole: interface speed, access level, node payout, ICE Rating, network growth, automation.
 *
 * Called by: `effects/kinds/index.ts` (the {@link BuyableEffect} union). Calls: nothing.
 */
import type { AutomationFeature } from '../../automation/automation';
import type { ActionId } from '../../actions/actionTypes';

/** Effects that change the sleeve as a whole: interface speed, access level, node payout, ICE Rating, network growth, automation. */
export type SleeveEffect =
  /** Each copy owned gives `perCopy` automation points (a whole number >= 1), which pay for the skills of the automation lanes. Sleeve-wide. */
  | { readonly kind: 'automationPoints'; readonly perCopy: number }
  /**
   * Multiplies the interface speed by `1 + perRarity` for each distinct rarity (of the five) that has at least one augment applied on any
   * action: additive, so five rarities give `1 + 5 * perRarity`. Applies once.
   */
  | { readonly kind: 'interfaceSpeedFromAugmentRarities'; readonly perRarity: number }
  | { readonly kind: 'interfaceSpeed'; readonly amount: number }
  /** Raises the access level by `amount` per copy (an integer >= 1), on top of `sleeve.baseAccessLevel`. */
  | { readonly kind: 'accessLevel'; readonly amount: number }
  /** Multiplies the credits each network node produces by this factor per copy. */
  | { readonly kind: 'nodePayoutMultiplier'; readonly factor: number }
  /** Multiplies the ICE Rating stat by this factor per copy. */
  | { readonly kind: 'iceRatingMultiplier'; readonly factor: number }
  /**
   * Adds `perLevel` per copy owned and per plain action level of `sourceActionId` to the BASE ICE Rating, that is, before the
   * `iceRatingMultiplier` buyables multiply it (so it does not matter in which order they are bought).
   */
  | { readonly kind: 'iceRatingFromActionLevel'; readonly sourceActionId: ActionId; readonly perLevel: number }
  /** Network nodes grow by this fraction of themselves per second (0.000001 = 0.0001 percent), compounding; only whole nodes are added, the rest is carried. */
  | { readonly kind: 'networkGrowth'; readonly ratePerSecond: number }
  /**
   * Network nodes grow by `level * percentPerLevel` percent of themselves per second, where `level` is the (plain) action level of
   * `sourceActionId`, per copy owned. E.g. `percentPerLevel: 0.001` at level 50 gives 0.05 percent per second. Same compounding and
   * whole-node rules as `networkGrowth`.
   */
  | { readonly kind: 'networkGrowthFromActionLevel'; readonly sourceActionId: ActionId; readonly percentPerLevel: number }
  /** Multiplies the base interface speed by `1 + perLn * ln(nodes)` (never below 1), before the hacking multiplier. */
  | { readonly kind: 'interfaceSpeedPerLnNodes'; readonly perLn: number }
  /** Multiplies the interface speed by `factor` per copy (after the hacking multiplier). */
  | { readonly kind: 'interfaceSpeedMultiplier'; readonly factor: number }
  /** Owning this skill (the root of an automation lane) unlocks the automation `feature`: its settings and its work. Sleeve-wide. */
  | { readonly kind: 'unlocksAutomation'; readonly feature: AutomationFeature }
  /** Does nothing (yet): a node of a tree whose effect is not designed. */
  | { readonly kind: 'placeholder' }
  /** Hacking Proficiency counts `factor` times as much per copy wherever it is used (hacking multiplier, drop ratio shifts). */
  | { readonly kind: 'hackingProficiencyMultiplier'; readonly factor: number };
