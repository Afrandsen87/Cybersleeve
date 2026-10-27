/**
 * @module ui
 *
 * The identifiers and the fill-in parts the text table is made of: what each tooltip and label function receives.
 *
 * @remarks
 * Pure types. The functions that turn these parts into words are in `uiText.ts` and `tipText.ts`; the view model in
 * `ui/view/` builds the parts. Re-exported by `uiText.ts`, so other files import them from there.
 */
import type { LevelScaling } from '../core';

/** Identifier of a titled group of Sleeve purchases. */
export type SleeveSectionId = 'rebuyable' | 'oneTime' | 'nodes';

/** Identifier of a cell in the square of an action card. */
export type SquareCellId = 'autoRun' | 'overclock' | 'focus' | 'augment';

/** Identifier of a stat row. */
export type StatId =
  | 'access'
  | 'interfaceSpeed'
  | 'hackingProficiency'
  | 'iceRating'
  | 'heat'
  | 'legend'
  | 'nodes'
  | 'income'
  | 'payout'
  | 'moles'
  | 'synths'
  | 'synthIncome'
  | 'criticalChance'
  | 'corporateRank'
  | 'ownedCorporations'
  | 'employees';

/** The curve that turns Hacking Proficiency into the hacking multiplier (see `sleeve.earnedSpeedScale` and `earnedSpeedExponent`). */
export interface HackingCurve {
  readonly scale: number;
  readonly exponent: number;
  /** The shape of the curve past a knee, when it has a second one that differs from `exponent` (`sleeve.earnedSpeedKnee` and `earnedSpeedExponentBeyond`). */
  readonly beyond?: { readonly knee: number; readonly exponent: number };
}

/** Pre-formatted pieces of the interface speed explanation. */
export interface InterfaceSpeedTipParts {
  /** Interface speed of a new sleeve. */
  readonly base: string;
  /** What the owned boosts add to the base. */
  readonly boosts: string;
  /** `null` while no network-based purchase is owned. */
  readonly networkFactor: string | null;
  /** Nodes owned (what the node bonus is computed from). */
  readonly nodes: string;
  /** The hacking multiplier (`1 +` the curve applied to Hacking Proficiency). */
  readonly hackingMultiplier: string;
  readonly curve: HackingCurve;
  /** Factor from skills, or `null` while there is none. */
  readonly skillFactor: string | null;
  readonly total: string;
}

/** Pre-formatted pieces of the Hacking Proficiency explanation. */
export interface HackingProficiencyTipParts {
  /** Hacking Proficiency: what hacking has paid out so far, before the curve. */
  readonly proficiency: string;
  /** The Hacking Multiplier it gives. */
  readonly hackingMultiplier: string;
  readonly curve: HackingCurve;
}

/** Pre-formatted pieces of the Access Level explanation. */
export interface AccessTipParts {
  /** Access level of a new sleeve. */
  readonly start: string;
  /** What purchases have added to it. */
  readonly purchases: string;
  /** Access level now. */
  readonly level: string;
  /** The next action that opens with a higher level, or `null` when every action is open. */
  readonly next: { readonly name: string; readonly level: string } | null;
}

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

/** Where one stack of items drops from: an action and the chance, in percent, that one completed run of it drops this stack. */
export interface DropChanceParts {
  /** Name of the action. */
  readonly action: string;
  /** Chance per completed run in percent, e.g. `"4.5"`. */
  readonly percent: string;
}

/** Pre-formatted pieces of the hover text of an inventory stack that cannot be paid out. */
export interface StackKeptTipParts {
  /** Where the stack can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** E.g. `"Common Augment schematic"`. */
  readonly label: string;
  /** Items held. */
  readonly count: string;
}

/** Pre-formatted pieces of the hover text of an action's Augment button. */
export interface AugmentTipParts {
  /** The XP per run now, after the augments applied. */
  readonly xpPerRun: string;
  /** The action XP per run before any augment. */
  readonly baseXp: string;
  /** What one augment adds within its rarity, as a plain number (`"0.01"`), for writing the calculation out. */
  readonly bonus: string;
  /** What one schematic adds, in percent. */
  readonly bonusPercent: string;
  /** Schematics applied to this action, per rarity that has any (most common first). */
  readonly applied: readonly { readonly rarity: string; readonly count: string }[];
  /** Schematics of the selected rarity held in the inventory (`"0"` while none is selected). */
  readonly held: string;
  /** Name of the rarity selected in the Inventory (the one a press uses up), or `null` while none is selected. */
  readonly selected: string | null;
  /** Name of the item the schematics are (`"Augment schematic"`). */
  readonly item: string;
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
}

/** Pre-formatted pieces of the hover text of the Zero-day tile. */
export interface ZeroDayTipParts {
  /** E.g. `"Zero-day"`. */
  readonly label: string;
  /** Where the item can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** The action whose runs a Zero-day makes critical. */
  readonly actionName: string;
  /** Zero-days held. */
  readonly count: string;
  /** The toggle is on. */
  readonly on: boolean;
  /** Clicking would do something (the toggle is on, or one is held to switch it on). */
  readonly canToggle: boolean;
}

/** Pre-formatted pieces of the hover text of the Admin key tile. */
export interface AdminKeyTipParts extends ZeroDayTipParts {
  /** Name of the bonus item a key-assisted critical run may drop, or `null` when there is none. */
  readonly bonusName: string | null;
  /** Chance in percent that one key-assisted critical run drops it. */
  readonly bonusPercent: string;
}

/** Pre-formatted pieces of the hover text of the Skill shard tile. */
export interface SkillShardTipParts {
  /** E.g. `"Skill shard"`. */
  readonly label: string;
  /** Levels one shard delays the XP scaling of its action by. */
  readonly levels: string;
  /** Shards held. */
  readonly count: string;
  /** Using one now would do something (one is held and some action is unlocked). */
  readonly canUse: boolean;
  /** Where the shard can drop from (empty while the Admin keys that make it possible cannot be had). */
  readonly drops: readonly DropChanceParts[];
}

/** Pre-formatted pieces of the hover text of a stack of Burn leads. */
export interface BurnLeadTipParts {
  /** E.g. `"Common Burn lead"`. */
  readonly label: string;
  /** The share of the current heat one lead removes, in percent. */
  readonly sharePercent: string;
  /** Where the lead can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** Heat now. */
  readonly heat: string;
  /** What the heat would be after using one lead now. */
  readonly heatAfter: string;
  /** Leads held. */
  readonly count: string;
  /** Using one now would do something (a lead is held and there is heat). */
  readonly canUse: boolean;
}

/** Pre-formatted pieces of the synthetic sleeves explanation. */
export interface SynthTipParts {
  /** How many synthetic sleeves there are. */
  readonly count: string;
  /** What they earn per second together. */
  readonly perSecond: string;
}

/** Pre-formatted pieces of the Moles explanation. */
export interface MolesTipParts {
  /** Moles held. */
  readonly moles: string;
  /** The extra cooldown speed while Moles remain, in percent. */
  readonly boostPercent: string;
}

/** Pre-formatted pieces of the explanation of the back channel button on an inventory stack. */
export interface BackChannelTipParts {
  /** E.g. `"Common Kompromat file"`. */
  readonly label: string;
  /** Moles one item given up is worth. */
  readonly molesPerItem: string;
  /** The extra cooldown speed while Moles remain, in percent. */
  readonly boostPercent: string;
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

/** Pre-formatted pieces of the heat explanation. */
export interface HeatTipParts {
  readonly heat: string;
  /** Tax one point of heat takes, in percent. */
  readonly perPointPercent: string;
  /** Share of the heat's effect removed by ICE Rating, in percent. */
  readonly reductionPercent: string;
  /** Resulting tax in percent. */
  readonly taxPercent: string;
  /** Heat at which credits stop, e.g. `"200 heat"`, or `null` when they never do. */
  readonly stopsAt: string | null;
  /** Heat removed per cooldown cycle. */
  readonly amount: string;
  /** Length of one cooldown cycle in seconds (Legend and skills included). */
  readonly cycleSeconds: string;
  /** Moles held and the extra speed they give in percent, or `null` while there are none. */
  readonly moles: { readonly moles: string; readonly boostPercent: string } | null;
}

/** Pre-formatted pieces of the ICE Rating explanation. */
export interface IceRatingTipParts {
  /** ICE Rating earned by runs. */
  readonly earned: string;
  /** Base ICE Rating that purchases add per action level, or `null` when there is none. */
  readonly levelBonus: string | null;
  /** Name of the purchase(s) that give {@link levelBonus}, e.g. `"Hardened payload"`. */
  readonly levelBonusSource: string;
  /** The purchases that multiply ICE Rating, one named factor each (empty when none is owned). */
  readonly multipliers: readonly TipTerm[];
  /** ICE Rating now. */
  readonly total: string;
  readonly orders: string;
  readonly perOrderPercent: string;
  readonly reductionPercent: string;
  /** Where the reduction reaches 100%, e.g. `"1e200"`, or `null` when it never does. */
  readonly fullAt: string | null;
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

/** Pre-formatted pieces of the Legend explanation. */
export interface LegendTipParts {
  /** Legend points held. */
  readonly legend: string;
  /** Length of a heat cooldown cycle without Legend, in seconds. */
  readonly baseSeconds: string;
  /** How much faster one point of Legend makes a cycle, in percent. */
  readonly speedupPercent: string;
  /** Length of a heat cooldown cycle now, in seconds. */
  readonly cycleSeconds: string;
  /** Minutes until Legend falls by 1. */
  readonly decayMinutes: string;
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
  /** Heat added per second while the action runs. */
  readonly heatPerSecond: number;
}

/** Pre-formatted pieces of a buyable's hover text. */
export interface BuyableTipParts {
  readonly name: string;
  readonly description: string;
  /** A formula shown under the description, or `null`. */
  readonly formula: string | null;
  /** The current numbers behind the formula, or `null` when the purchase has none to show. */
  readonly values: BuyableValues | null;
  readonly cost: string;
  readonly costUnit: string;
  readonly owned: number;
  readonly repeatable: boolean;
  readonly maxed: boolean;
  readonly toggleable: boolean;
  readonly enabled: boolean;
}

/** The live numbers behind a purchase's formula: the variables with their values, then the result. */
export interface BuyableValues {
  readonly variables: readonly string[];
  readonly result: string;
}

/** Pre-formatted pieces of the live numbers of the network-growth purchase. */
export interface NetworkGrowthValueParts {
  /** The level of the action the growth depends on. */
  readonly level: string;
  /** The resulting growth per second, in percent. */
  readonly percent: string;
}

/** Pre-formatted pieces of the hover text of an inventory stack. */
export interface StackTipParts {
  /** Where the stack can drop from (empty while no action can drop it). */
  readonly drops: readonly DropChanceParts[];
  /** E.g. `"Common Kompromat file"`. */
  readonly label: string;
  /** What one item sells for. */
  readonly sellValue: string;
  /** Items held. */
  readonly count: string;
  /** What the whole stack sells for. */
  readonly total: string;
  /** Display unit of the price. */
  readonly unit: string;
}
