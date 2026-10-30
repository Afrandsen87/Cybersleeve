/**
 * @module ui
 *
 * The fill-in parts of the action, income and critical tips: pure types, what the text functions receive.
 *
 * @remarks
 * Part of the text table's parts; `uiTextParts.ts` re-exports them, so import from there.
 */
import type { LevelScaling } from '../../core';

/** Pre-formatted pieces of the explanation of an action's speed. */
export interface ActionSpeedTipParts {
  /** The action's speed multiplier, e.g. `"0.115"`. */
  readonly speed: string;
  /** The action's own level (without the level bonus from purchases). */
  readonly actionLevel: number;
  /** Levels added to the action level for speed by purchases (0 when none). */
  readonly levelBonus: number;
  /** Speed factor of the action level. */
  readonly actionFactor: string;
  /** How much each action level is worth. */
  readonly actionScaling: LevelScaling;
  /** False until sleeve levels are unlocked: the tip then does not mention the sleeve level at all. */
  readonly sleeveShown: boolean;
  /** Sleeve level of the action. */
  readonly sleeveLevel: number;
  /** Speed factor of the sleeve level. */
  readonly sleeveFactor: string;
  /** How much each sleeve level is worth. */
  readonly sleeveScaling: LevelScaling;
  /** Interface speed of the sleeve (a speed factor). */
  readonly interfaceFactor: string;
  /** The global speed lever, or `null` while it is 1. */
  readonly globalFactor: string | null;
  /** The factor Overclock gives while it is on for this action, or `null` while it is off. */
  readonly overclockFactor: string | null;
  /** The factor Focus gives while this action is focused, or `null` while it is not. */
  readonly focusFactor: string | null;
  /** Duration of one run at speed 1, formatted. */
  readonly baseDuration: string;
  /** Duration of one run now, formatted. */
  readonly duration: string;
}

/** Pre-formatted pieces of the hover text of an action's Overclock toggle. */
export interface OverclockTipParts {
  /** The toggle is on. */
  readonly on: boolean;
  /** How strong Overclock is (1 with one copy, 1.1 with two, ...). */
  readonly strength: string;
  /** The speed bonus, or `null` when the action's Overclock has none. Percentages: what the action's rule gives at strength 1, and now. */
  readonly speed: { readonly basePercent: string; readonly percent: string } | null;
  /** The bonus on the reward per run, or `null` when the action's Overclock has none. */
  readonly reward: { readonly basePercent: string; readonly percent: string } | null;
  /** Heat added per minute while the action runs overclocked, or `null` when there is none. */
  readonly heatPerMinute: string | null;
  /** What the heat of each run is multiplied by, or `null` when it is not. */
  readonly heatPerRunFactor: string | null;
  /** What the chance that a run makes heat is multiplied by, or `null` when it is not. */
  readonly heatChanceFactor: string | null;
  /** Nodes each completed run costs, or `null` when it costs none. */
  readonly nodesLost: string | null;
  /** Name of the other action whose reward each run also pays, or `null`. */
  readonly alsoPays: string | null;
  /** Heat is held in place while the action runs overclocked. */
  readonly holdsHeat: boolean;
  /** The chain of consecutive runs, or `null` when the action's Overclock has none. Percentages are per link. */
  readonly chain: {
    readonly links: string;
    readonly maxLinks: string;
    readonly rewardPercent: string;
    readonly nodesPercent: string;
  } | null;
}

/** Pre-formatted pieces of the hover text of an action's Focus toggle. */
export interface FocusTipParts {
  /** The action is focused. */
  readonly on: boolean;
  /** The speed bonus of a focused action, in percent. */
  readonly bonusPercent: string;
  /** Actions focused now. */
  readonly used: string;
  /** Focus slots owned. */
  readonly slots: string;
  /** Another action cannot be focused: every slot is taken (and this one is not focused). */
  readonly full: boolean;
  /** Several slots may sit on one action (the Overdrive Cap skill), so the cell has an add and a remove half. */
  readonly stacking: boolean;
  /** Focus slots on this action now. */
  readonly count: string;
}

/** One named factor of a formula, e.g. a bought boost and what it multiplies by. */
export interface TipTerm {
  /** The name of the purchase (with its copies when more than one is owned). */
  readonly label: string;
  /** What it multiplies by, formatted. */
  readonly value: string;
}

/** Pre-formatted pieces of the node payout explanation. */
export interface PayoutTipParts {
  /** Credits one node produces per second before any multiplier. */
  readonly base: string;
  /** The credit lever (`global.creditMultiplier`), or `null` while it is 1. */
  readonly creditLever: string | null;
  /** The purchases that multiply the payout, one named factor each (empty when none is owned). */
  readonly purchases: readonly TipTerm[];
  /** Credits per second that actions (Push malware) have added to the base of every node. */
  readonly actionBonus: string;
  /** What one node pays per second now (before the heat tax, which takes its share of the income instead). */
  readonly perNode: string;
}

/** Pre-formatted pieces of the credits per second explanation. */
export interface IncomeTipParts {
  /** Nodes owned. */
  readonly nodes: string;
  /** What one node pays per second. */
  readonly perNode: string;
  /** Share of the income kept after the heat tax in percent, or `null` while there is no tax. */
  readonly keepPercent: string | null;
  /** Credits per second before the heat tax. */
  readonly gross: string;
  /** Credits per second after the heat tax. */
  readonly total: string;
}

/** Pre-formatted pieces of the critical success explanation. */
export interface CriticalTipParts {
  /** Chance that one completed run is critical, in percent. */
  readonly chancePercent: string;
  /** Multiplier on the action XP of a critical run. */
  readonly xpMultiplier: string;
  /** Multiplier on the reward of a critical run. */
  readonly rewardMultiplier: string;
}

/** Pre-formatted pieces of the one-line description of an action. */
export interface ActionInfoParts {
  readonly speed: string;
  readonly duration: string;
  readonly startCost: string | null;
  readonly auto: boolean;
}

/** Pre-formatted pieces of the reward line on an action card. */
export interface RewardLineParts {
  readonly amount: string;
  readonly unit: string;
  /** The reward multiplier, or `null` when it is 1. */
  readonly multiplier: string | null;
  readonly heatPerRun: number;
  /** The chance in percent that a run makes its heat, or `null` when every run does. */
  readonly heatChancePercent: string | null;
  /** Heat added per second while the action runs. */
  readonly heatPerSecond: number;
}

/** Pre-formatted pieces of the live numbers of the network-growth purchase. */
export interface NetworkGrowthValueParts {
  /** The level of the action the growth depends on. */
  readonly level: string;
  /** The resulting growth per second, in percent. */
  readonly percent: string;
}
