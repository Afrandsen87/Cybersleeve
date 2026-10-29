/**
 * @module core
 *
 * Effects that change one action (auto-run, Overclock, Focus, rewards, XP, criticals) or link two actions.
 *
 * Called by: `effects/kinds/index.ts` (the {@link BuyableEffect} union). Calls: nothing.
 */
import type { ActionId, ChainRule } from '../../actions/actionTypes';

/** Effects that change one action (auto-run, Overclock, Focus, rewards, XP, criticals) or link two actions. */
export type ActionEffect =
  | { readonly kind: 'autoRun' }
  /** Unlocks the Overclock toggle of the buyable's action (the action must have an `overclock` rule). Applies once, whatever the number of copies. */
  | { readonly kind: 'overclockUnlock' }
  /**
   * Adds a chain to the Overclock of the buyable's action (see {@link ChainRule}): the action must have a `startCost`, so its runs come one
   * per batch, and an `overclock` rule. Applies once, whatever the number of copies.
   */
  | { readonly kind: 'overclockChain'; readonly chain: ChainRule }
  /** Unlocks the Focus toggle of the buyable's action. Applies once, whatever the number of copies. */
  | { readonly kind: 'focusUnlock' }
  /**
   * Makes every Overclock stronger: strength is `1 + perCopy` per copy owned (0.1 = the gains of every action's Overclock, the speed
   * and reward bonuses, are 10 percent of their base bigger per copy). The costs of an Overclock do not scale.
   */
  | { readonly kind: 'overclockStrength'; readonly perCopy: number }
  /** Each copy owned adds `perCopy` Focus slots (a whole number >= 1) on top of `focus.baseSlots`: that many actions can be focused at once. */
  | { readonly kind: 'focusSlots'; readonly perCopy: number }
  /** Every completed run of any action has `chance` (0..1) per copy owned to be a critical success (see {@link CriticalSuccessRule}); copies add up with no cap, and a total above 1 gives several critical successes per run (150% = one sure success and a 50% chance of a second). */
  | { readonly kind: 'criticalChance'; readonly chance: number }
  | { readonly kind: 'rewardMultiplier'; readonly factor: number }
  /**
   * Lowers the share of the balance the buyable's action takes as its start cost (`StartCost.fractionOfBalance`) by `perLevel` (0.01 =
   * 1 percent) per plain action level, compounding: the share is multiplied by `(1 - perLevel)^level`. The first level is worth the most,
   * every further one is `perLevel` of the new value, so it never ends and never reaches 0. While owned, a node cost that rounds
   * down to 0 is raised to 1 node, so the action stays startable. Applies once, whatever the number of copies.
   */
  | { readonly kind: 'startCostReduction'; readonly perLevel: number }
  /**
   * When a run of the buyable's action starts and its start cost destroys network nodes, the player is paid credits equal to `seconds`
   * seconds of what a node produces now (after the node payout multiplier and the heat tax) for each node destroyed. Applies once.
   */
  | { readonly kind: 'creditSiphon'; readonly seconds: number }
  /**
   * Multiplies the critical success multipliers of the buyable's action (`xpMultiplier` and `rewardMultiplier` of its
   * {@link CriticalSuccessRule}) by `factor` (>= 1), for its critical runs only. Applies once, whatever the number of copies.
   */
  | { readonly kind: 'criticalBoost'; readonly factor: number }
  /**
   * Every critical run of the buyable's action banks one guaranteed critical success for `targetActionId`: that action's next
   * completed runs are critical for sure, one banked success per run. Applies once, whatever the number of copies.
   */
  | { readonly kind: 'criticalLink'; readonly targetActionId: ActionId }
  /**
   * Every critical success of every action has `chance` (0..1) to bring one extra critical success, free. The extra does not roll again.
   * Sleeve-wide; the chances of several copies add up (capped at 1).
   */
  | { readonly kind: 'criticalExtraChance'; readonly chance: number }
  /** Multiplies the reward of every critical success (`CriticalSuccessRule.rewardMultiplier`) of every action by `factor` (>= 1) per copy. Its XP is not touched. */
  | { readonly kind: 'criticalRewardMultiplier'; readonly factor: number }
  /**
   * Every completed run of `sourceActionId` has `chance` (0..1) to also pay one whole reward of `targetActionId`: its reward, its own
   * reward multipliers and its reward kind (like Overclock's `alsoPays`). Never critical, and no XP, heat or drops. Applies once. Sleeve-wide.
   */
  | {
      readonly kind: 'paysActionReward';
      readonly sourceActionId: ActionId;
      readonly targetActionId: ActionId;
      readonly chance: number;
    }
  /**
   * Multiplies the reward of `targetActionId` by `1 + coefficient * ln(1 + level / scale)`, where `level` is the plain action level of
   * `sourceActionId`: a concave curve, quick at first, ever flatter. Applies once, whatever the number of copies. Sleeve-wide.
   */
  | {
      readonly kind: 'rewardMultiplierFromActionLevel';
      readonly sourceActionId: ActionId;
      readonly targetActionId: ActionId;
      readonly coefficient: number;
      readonly scale: number;
    }
  /**
   * Lowers the factor Overclock multiplies the heat of each completed run of `targetActionId` by (`OverclockRule.heatPerRunFactor`)
   * to `factor` (>= 1) when the rule's own factor is higher. Applies once, whatever the number of copies; the lowest factor wins.
   */
  | { readonly kind: 'overclockHeatFactor'; readonly targetActionId: ActionId; readonly factor: number }
  /** Adds the sleeve level of `sourceActionId` to the level of `targetActionId` when computing speed (not its XP progress). */
  | { readonly kind: 'levelBonusFromSleeveLevel'; readonly sourceActionId: ActionId; readonly targetActionId: ActionId }
  /**
   * Lowers the XP needed for every sleeve level of every OTHER action by `min(maxReduction, perLevel * sleeve level of
   * sourceActionId)`, as a fraction (0.25 = 25 percent less XP). The source action itself is not affected.
   */
  | { readonly kind: 'sleeveXpReduction'; readonly sourceActionId: ActionId; readonly perLevel: number; readonly maxReduction: number }
  /**
   * Every ACTION level of every action needs less XP, by an amount that depends on that action's own SLEEVE level `L`: the reduction is
   * `1 - remainingPerOrder ^ log10(L)` (0 up to level 1; with 0.5, half at level 10, three quarters at level 100), never above
   * `maxReduction`. It multiplies with the flat `actionXpReduction` buyables and is not part of their cap.
   */
  | { readonly kind: 'actionXpReductionFromSleeveLevel'; readonly remainingPerOrder: number; readonly maxReduction: number }
  /** Every ACTION level needs `amount` (a fraction, 0.01 = 1 percent) less XP per copy. Sleeve levels are not affected. */
  | { readonly kind: 'actionXpReduction'; readonly amount: number }
  /**
   * Every copy owned lowers the number of completed runs an action needs per batch of sleeve XP (`progression.runsPerSleeveXp`) by
   * `perCopy` runs (an integer >= 1), but never below `minRuns` (an integer >= 1). Applies to every action.
   */
  | { readonly kind: 'runsPerSleeveXpReduction'; readonly perCopy: number; readonly minRuns: number };
