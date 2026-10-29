/**
 * @module core
 *
 * Shapes of an action's definition: level rule, reward kinds, completion effects, start cost, critical success, Overclock.
 */
import type { BigNum } from '../../numbers';
import type { Currency } from '../effects/buyableTypes';

/** Identifier of an action (e.g. `"practice-hacking"`). Never shown to the player. */
export type ActionId = string;

/**
 * How experience maps to levels.
 *
 * @remarks
 * Levels start at 0. Every level costs its own full amount of XP: leaving level 0 costs `firstLevelXp`, and each further level costs
 * `growthFactor` times the one before: `cost(leaving level n) = firstLevelXp * growthFactor^n`. The XP gathered inside a level
 * starts from 0 again after each level-up. With the defaults (10 and 10): 10 XP for level 1, then 100 more for level 2,
 * then 1000 more for level 3, and so on (110 and 1110 XP in total).
 */
export interface LevelRuleConfig {
  /** XP the first level costs, i.e. what it takes to reach level 1 (> 0). */
  readonly firstLevelXp: number;
  /** Ratio between the costs of consecutive levels (> 1). */
  readonly growthFactor: number;
}

/**
 * How much a level is worth as a multiplier.
 *
 * - `linear`: `1 + level * perLevel` (levels start at 0, so level 0 is worth exactly 1).
 * - `exponential`: `base ^ level`.
 */
export type LevelScaling = { readonly kind: 'linear'; readonly perLevel: number } | { readonly kind: 'exponential'; readonly base: number };

/**
 * What a completed run pays out: `credits` go to the credit balance, `networkNodes` grow the network,
 * `hackingProficiency` adds to Hacking Proficiency, which raises the hacking multiplier on the sleeve's interface speed (until the next re-sleeve), `iceRating` adds to
 * the ICE Rating stat (which lowers the heat tax), `legend` adds to Legend (which speeds up heat cooldown) and `nodePayout`
 * adds to the base value of what every network node produces (credits per second, before the Node payout multiplier). Network nodes are always whole numbers: a `networkNodes`
 * reward is rounded down per run.
 */
export type RewardKind = 'credits' | 'networkNodes' | 'hackingProficiency' | 'iceRating' | 'legend' | 'nodePayout';

/** Something that happens each time an action completes a run, besides its reward. */
export type CompletionEffect =
  | { readonly kind: 'removeNodesFraction'; readonly fraction: number }
  /** Removes this many network nodes (a whole number >= 1) for each run; the network never goes below 0. */
  | { readonly kind: 'removeNodes'; readonly amount: number };

/**
 * A price paid every time a run starts (manually or by auto-run). It is `amount` plus `fractionOfBalance` of the balance held
 * at that moment (network nodes: rounded down to whole nodes). A fraction-based cost that comes to 0 cannot be paid, so
 * the run cannot start: with 1% of nodes you need at least 100 nodes.
 */
export interface StartCost {
  /** What is paid. */
  readonly currency: Currency;
  /** A fixed amount per run (>= 0). Default: 0. */
  readonly amount?: BigNum;
  /** The share (0..1) of the current balance paid per run. Default: none. */
  readonly fractionOfBalance?: number;
}

/**
 * What a critical success does to one completed run.
 *
 * @remarks
 * A critical run is an ordinary run that was drawn as critical (chance from the sleeve's `criticalChance` buyables). The default
 * rule is `GameConfig.criticalSuccess`; an action can replace single fields of it with `ActionDefinition.criticalSuccess`, which is
 * where an action's own critical behaviour goes. The multipliers scale only what their name says, for the critical runs only.
 */
export interface CriticalSuccessRule {
  /** Multiplies the action XP of a critical run (>= 1). Sleeve XP and the run counter are not touched. */
  readonly xpMultiplier: number;
  /** Multiplies the reward the action pays for a critical run, whatever its kind (>= 1). Heat and completion effects are not scaled. */
  readonly rewardMultiplier: number;
  /** Extra effects applied once for each critical run, after the ordinary completion effects. Default: none. */
  readonly completionEffects?: readonly CompletionEffect[];
}

/**
 * A chain (bought with an `overclockChain` buyable): every completed run while the action stays overclocked and keeps running adds one link; a stopped action or a switched-off
 * Overclock breaks it. Each link makes the next run pay more of its own reward and destroy more of the start-cost balance.
 */
export interface ChainRule {
  /** The most links the chain can hold (an integer >= 1). */
  readonly maxLinks: number;
  /**
   * What each link adds to the reward bonus of the run, like `OverclockRule.rewardBonus` (0.1 = +10 percent of the base reward per link; > 0).
   * A gain: it grows with the strength of Overclock.
   */
  readonly rewardPerLink: number;
  /**
   * What each link adds to the share of the balance the start cost takes (0.1 = the share is 10 percent bigger per link, on top of the
   * base share; >= 0). A price: it does not grow with the strength of Overclock.
   */
  readonly nodesPerLink: number;
}

/** What a `paysActionReward` buyable does: each completed run of `sourceActionId` has `chance` to also pay one reward of `targetActionId`. */
export interface PaysActionRule {
  readonly sourceActionId: ActionId;
  readonly targetActionId: ActionId;
  /** Chance (0..1) that one completed run pays it. */
  readonly chance: number;
}

/**
 * What Overclock does to ONE action while it is switched on (the toggle exists on every action that has a rule, once the Overclock
 * buyable is owned). Each action's rule is its own, so Overclock can do something different for each. A rule lists any mix of the
 * fields below and needs at least one.
 *
 * @remarks
 * The two bonuses (`speedBonus`, `rewardBonus`) are the gain and grow with the strength of Overclock (more copies of the buyable). The
 * rest (heat, node costs, the extra payment) are fixed by the rule: more copies make the gain stronger, never the price.
 */
export interface OverclockRule {
  /**
   * While the action is running overclocked, heat does not cool down at all (the cooldown stands still, Moles are not used, and Burn
   * leads cannot be used). Default: false.
   */
  readonly stopsHeatCooling?: boolean;
  /** The action runs this much faster at Overclock strength 1 (0.5 = 50 percent faster; > 0). Default: no speed change. */
  readonly speedBonus?: number;
  /** The reward the action pays per run is this much bigger at strength 1 (2 = 200 percent more, i.e. x3; > 0). Scales that reward only. Default: none. */
  readonly rewardBonus?: number;
  /** Heat the action adds per minute of game time while it is running overclocked (>= 0). Fractions of a point of heat are kept. Default: 0. */
  readonly heatPerMinute?: number;
  /** The heat each completed run adds (`heatPerRun`) is multiplied by this (>= 1; 3 = three times as much). Default: 1. */
  readonly heatPerRunFactor?: number;
  /** The chance that a completed run makes heat (`heatPerRun`) is multiplied by this (>= 1; 2 = twice as likely), capped at a chance of 1. Default: 1. */
  readonly heatChanceFactor?: number;
  /** Applied once for each completed run while Overclock is on, after the ordinary completion effects. Default: none. */
  readonly completionEffects?: readonly CompletionEffect[];
  /** Each completed run also pays the reward of this other action, as if that action had completed one run (its own reward multipliers apply). Default: none. */
  readonly alsoPays?: ActionId;
}

/** Static description of an action the character can perform. */
export interface ActionDefinition {
  readonly id: ActionId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Duration of one run at speed multiplier 1, in milliseconds. */
  readonly baseDurationMs: number;
  /** Amount paid per completed run, in units of `rewardKind` (before reward multipliers). */
  readonly reward: BigNum;
  /** What `reward` is paid as. Default: `'credits'`. */
  readonly rewardKind?: RewardKind;
  /** When true, `reward` is paid once per network node owned (so the payout is `reward * nodes`). Default: false. */
  readonly rewardPerNetworkNode?: boolean;
  /** Heat added to the sleeve by each completed run (>= 0). Default: 0. */
  readonly heatPerRun?: number;
  /**
   * The chance (0..1) that one completed run adds its `heatPerRun`. A batch of runs draws how many add heat in one binomial draw
   * (never per run). Default: 1, i.e. every run makes heat and nothing is drawn.
   */
  readonly heatChance?: number;
  /** Heat added to the sleeve for every second this action is actually running (>= 0, may be a fraction). Default: 0. */
  readonly heatPerSecond?: number;
  /** Access level the sleeve needs before this action can be performed (integer >= 1). Default: 1. */
  readonly requiredAccessLevel?: number;
  /** Paid each time a run starts; without enough of the currency the run cannot start. Such actions complete one run per batch. */
  readonly startCost?: StartCost;
  /** Applied after each completed run (in order). */
  readonly completionEffects?: readonly CompletionEffect[];
  /** Action experience gained per completed run (reward multipliers do not change it). */
  readonly xpPerRun: BigNum;
  /** Overrides `progression.actionLevels` for this action. */
  readonly levels?: LevelRuleConfig;
  /** Overrides `progression.sleeveLevels` for this action's sleeve level. */
  readonly sleeveLevels?: LevelRuleConfig;
  /** Overrides `speed.actionLevel` for this action. */
  readonly speedScaling?: LevelScaling;
  /** Replaces single fields of `GameConfig.criticalSuccess` for this action's critical runs. Default: the global rule applies unchanged. */
  readonly criticalSuccess?: Partial<CriticalSuccessRule>;
  /** What Overclock does to this action. Default: none, so the action has no Overclock toggle. */
  readonly overclock?: OverclockRule;
}
