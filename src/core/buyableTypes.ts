/**
 * @module core
 *
 * Shapes of purchases: the effect kinds, currencies and the buyable definition.
 */
import type { BigNum } from '../numbers';
import type { ActionId, ChainRule } from './actionTypes';
import type { ItemDropRule, ItemId, RarityId } from './itemTypes';

/** Identifier of a buyable (e.g. `"auto-run"`). Never shown to the player. */
export type BuyableId = string;

/**
 * What a purchase does. Add a new `kind` here and in `effects.ts` to add a new effect type.
 * An effect applies once per copy owned (see `BuyableDefinition.maxPurchases`).
 *
 * - Action effects (`autoRun`, `rewardMultiplier`, `itemDrop`, `rarityShiftFromProficiency`) change the action the buyable belongs to. `rewardMultiplier` scales that action's own
 *   reward per run and nothing else: not its XP, not the runs counted towards sleeve XP, not its heat or completion effects.
 * - Sleeve effects (`interfaceSpeed`, `accessLevel`, `networkGrowth`, `networkGrowthFromActionLevel`, `interfaceSpeedPerLnNodes`, `sleeveXpReduction`) change the
 *   game as a whole; the buyable may still belong to an action, which only decides on which card it is shown.
 * - `levelBonusFromSleeveLevel` links two actions: it adds one action's sleeve level to another action's level for speed.
 */
export type BuyableEffect =
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
  /** Each copy owned gives `perCopy` automation points (a whole number >= 1), each of which unlocks one automation feature. Sleeve-wide. */
  | { readonly kind: 'automationPoints'; readonly perCopy: number }
  /** Every completed run of any action has `chance` (0..1) per copy owned to be a critical success (see {@link CriticalSuccessRule}); the total is capped at 1. */
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
   * Lowers the factor Overclock multiplies the heat of each completed run of `targetActionId` by (`OverclockRule.heatPerRunFactor`)
   * to `factor` (>= 1) when the rule's own factor is higher. Applies once, whatever the number of copies; the lowest factor wins.
   */
  | { readonly kind: 'overclockHeatFactor'; readonly targetActionId: ActionId; readonly factor: number }
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
  /** Adds the sleeve level of `sourceActionId` to the level of `targetActionId` when computing speed (not its XP progress). */
  | { readonly kind: 'levelBonusFromSleeveLevel'; readonly sourceActionId: ActionId; readonly targetActionId: ActionId }
  /**
   * Lowers the XP needed for every sleeve level of every OTHER action by `min(maxReduction, perLevel * sleeve level of
   * sourceActionId)`, as a fraction (0.25 = 25 percent less XP). The source action itself is not affected.
   */
  | { readonly kind: 'sleeveXpReduction'; readonly sourceActionId: ActionId; readonly perLevel: number; readonly maxReduction: number }
  /** Completed runs of the buyable's action may drop an item, as described by `drop`. Applies once, whatever the number of copies. */
  | { readonly kind: 'itemDrop'; readonly drop: ItemDropRule }
  /**
   * Hacking Proficiency shifts the drop ratios of the buyable's action towards the rarer rarities: for every whole order of
   * magnitude of proficiency (`floor(log10)`, none below 10) `fractionPerOrder` of each rarity's weight moves to the next rarity.
   * The amounts are worked out up front for all rarities and moved at once (see `shiftWeights`). Applies once, whatever the number of copies.
   */
  | { readonly kind: 'rarityShiftFromProficiency'; readonly fractionPerOrder: number }
  /** Multiplies the interface speed by `factor` per copy (after the hacking multiplier). */
  | { readonly kind: 'interfaceSpeedMultiplier'; readonly factor: number }
  /** Heat cools down `factor` times as fast per copy (shorter cooldown cycles). */
  | { readonly kind: 'heatCooldownSpeed'; readonly factor: number }
  /**
   * Every heat cooldown cycle removes `perLevel` more heat per sleeve level of `sourceActionId` (and per copy). The cycles are not
   * faster, so the cooldown still completes in discrete steps; each step is just bigger.
   */
  | { readonly kind: 'heatCooldownAmountFromSleeveLevel'; readonly sourceActionId: ActionId; readonly perLevel: number }
  /**
   * Every ACTION level of every action needs less XP, by an amount that depends on that action's own SLEEVE level `L`: the reduction is
   * `1 - remainingPerOrder ^ log10(L)` (0 up to level 1; with 0.5, half at level 10, three quarters at level 100), never above
   * `maxReduction`. It multiplies with the flat `actionXpReduction` buyables and is not part of their cap.
   */
  | { readonly kind: 'actionXpReductionFromSleeveLevel'; readonly remainingPerOrder: number; readonly maxReduction: number }
  /**
   * Synthetic sleeves: buying it gives one synthetic sleeve (copied from the last finished sleeve-run), and every re-sleeve after that
   * gives one more (copied from the run that just ended). See `synthSleeves.ts`.
   */
  | { readonly kind: 'synthSleeves' }
  /**
   * The gate of sleeve levels and re-sleeving. Until it is owned, sleeve XP is still tracked but sleeve levels read 0 (no bonuses) and
   * stay hidden, and the player cannot re-sleeve. Owning it opens all three; it survives re-sleeving and starts a short re-sleeve
   * lockout (`resleeve.lockoutMs`). At most one buyable may have this effect. See `resleeveGate.ts`.
   */
  | { readonly kind: 'unlockSleeveLevels' }
  /** Opens the Corporation tab (and lets its actions be started) while owned. See `corporation.ts`. */
  | { readonly kind: 'unlocksCorporation' }
  /** Does nothing (yet): a node of the re-sleeve tree whose effect is not designed. */
  | { readonly kind: 'placeholder' }
  /** Hacking Proficiency counts `factor` times as much per copy wherever it is used (hacking multiplier, drop ratio shifts). */
  | { readonly kind: 'hackingProficiencyMultiplier'; readonly factor: number }
  /** Every ACTION level needs `amount` (a fraction, 0.01 = 1 percent) less XP per copy. Sleeve levels are not affected. */
  | { readonly kind: 'actionXpReduction'; readonly amount: number }
  /**
   * Every copy owned lowers the number of completed runs an action needs per batch of sleeve XP (`progression.runsPerSleeveXp`) by
   * `perCopy` runs (an integer >= 1), but never below `minRuns` (an integer >= 1). Applies to every action.
   */
  | { readonly kind: 'runsPerSleeveXpReduction'; readonly perCopy: number; readonly minRuns: number }
  /** Multiplies the drop chance (the chance of a drop at all) of every drop rule of `itemId` by `factor` per copy; the result never exceeds 1. */
  | { readonly kind: 'itemDropChanceMultiplier'; readonly itemId: ItemId; readonly factor: number }
  /** Node payout is multiplied by `1 + perItem x` the number of `itemId` items of `rarityId` held, per copy. */
  | { readonly kind: 'nodePayoutFromItems'; readonly itemId: ItemId; readonly rarityId: RarityId; readonly perItem: number }
  /**
   * Lets the player give up items of `itemId` / `rarityId` for Moles: `molesPerItem` Moles each. While Moles remain, heat cools
   * `cooldownBoost` (0.5 = 50 percent) faster, and every point of heat cooled uses up one Mole.
   */
  | {
      readonly kind: 'backChannel';
      readonly itemId: ItemId;
      readonly rarityId: RarityId;
      readonly molesPerItem: number;
      readonly cooldownBoost: number;
    };

/**
 * What a buyable is paid with. `skillPoints` are not held: the points available are what the action levels have earned minus what the
 * owned skills cost (see `skills.ts`), so paying them spends nothing from the state.
 */
export type Currency = 'credits' | 'networkNodes' | 'skillPoints' | 'resleevePoints';

/**
 * The currencies that are points, not held amounts: what the player can spend is what has been earned minus the cost of the buyables
 * owned. Skill points come from action levels; re-sleeve points come from re-sleeving (`resleeve.pointsPerResleeve` each).
 */
export type PointCurrency = 'skillPoints' | 'resleevePoints';

/** Static description of a purchase (one-time or repeatable). It is shown on its action's card, or in the Sleeve widget when it has no action. */
export interface BuyableDefinition {
  readonly id: BuyableId;
  /** The action whose card shows this purchase (and whose behaviour an action effect changes). Absent: shown in the Sleeve widget. */
  readonly actionId?: ActionId;
  readonly name: string;
  /** What the purchase does, in a sentence (shown in the hover tooltip). */
  readonly description: string;
  /** A formula that explains the effect, shown under the description in the tooltip (e.g. `"Growth factor percentage = Action level / 1000"`). */
  readonly formula?: string;
  /** Short text shown on the purchase's square button (default: initials of `name`). */
  readonly symbol?: string;
  /** Price of the first copy, in `currency` (before `global.costMultiplier`). */
  readonly cost: BigNum;
  /** What the price is paid in. Default: credits. Paying in network nodes removes those nodes. */
  readonly currency?: Currency;
  readonly effect: BuyableEffect;
  /** Buyables that must be owned before this one becomes available. Default: none. */
  readonly requires?: readonly BuyableId[];
  /** How many copies can be bought; `Infinity` for unlimited. Default: 1. */
  readonly maxPurchases?: number;
  /** Price multiplier per copy already owned (>= 1). Default: 1 (constant price). */
  readonly costGrowth?: number;
}
