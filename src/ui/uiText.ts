/**
 * @module ui
 *
 * Every word the interface shows that is not content (action and buyable names live in `content/gameConfig.ts`).
 *
 * @remarks
 * The names here are placeholders and will be renamed. They are gathered in one table so that renaming, or translating,
 * touches this file only: `viewModel.ts` and `dom.ts` hold no display text of their own. Entries that depend on numbers
 * are functions that receive already-formatted strings; the numeric work stays in the view model.
 */
import type { Currency, LevelScaling, RewardKind } from '../core';
import { formatPlain } from '../numbers';

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
  | 'criticalChance';

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
  /** Schematics held in the inventory (all rarities). */
  readonly held: string;
  /** Name of the rarity the next press uses up (the most common one held), or `null` while none is held. */
  readonly next: string | null;
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

/** Pre-formatted pieces of the node payout explanation. */
export interface PayoutTipParts {
  /** Credits one node produces per second before any multiplier. */
  readonly base: string;
  /** The credit lever (`global.creditMultiplier`), or `null` while it is 1. */
  readonly creditLever: string | null;
  /** The multiplier from purchases. */
  readonly purchases: string;
  /** Credits per second that actions (Push malware) have added to the base of every node. */
  readonly actionBonus: string;
  /** Share of the credits kept after the heat tax in percent, or `null` while there is no tax. */
  readonly keepPercent: string | null;
  /** What one node pays per second now. */
  readonly perNode: string;
  /** Nodes owned. */
  readonly nodes: string;
  /** What the whole network pays per second now. */
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

/** All display text of the interface. */
export interface UiText {
  /** An amount per second, e.g. `"0.015/s"`. */
  perSecond(amount: string): string;
  /** Small display forms of numbers that other texts are built from. */
  readonly format: {
    /** A speed multiplier, e.g. `x1.5`. */
    speed(value: string): string;
    /** An income per second with its sign, e.g. `+12`. */
    income(value: string): string;
    /** A number of heat points, e.g. `200 heat`. */
    heatPoints(value: string): string;
    /** A power of ten, e.g. `1e200`. */
    powerOfTen(exponent: string): string;
    /** A duration in seconds, e.g. `3.33s`. */
    seconds(value: string): string;
  };
  /** The balance line, e.g. `"12 credits"`. */
  credits(amount: string): string;
  /** Widget titles. `upgrades` heads the widget with the sleeve-wide purchases paid in credits, `exploitation` the one with those paid in nodes. */
  readonly titles: {
    readonly sleeve: string;
    readonly network: string;
    readonly inventory: string;
    readonly upgrades: string;
    readonly exploitation: string;
    readonly skills: string;
    readonly resleeveSkills: string;
    readonly stats: string;
  };
  /** The tabs at the top. The Skills tab shows the points available, unless there are none. */
  readonly tabs: { readonly character: string; skills(points: number): string; readonly stats: string };
  /** The Skills box and the re-sleeve skills group. */
  readonly skills: { points(points: string): string; resleevePoints(points: string): string };
  /** The Stats tab: the list of the latest finished sleeve-runs. */
  readonly runs: {
    readonly empty: string;
    readonly headers: { readonly run: string; readonly income: string; readonly levels: string };
    /** The number of a run, e.g. `"Run 3"`. */
    label(number: number): string;
  };
  /** The Inventory widget. */
  readonly inventory: {
    /** The name of a stack, e.g. `"Common Kompromat file"`. */
    label(rarity: string, item: string): string;
    /** The headings of the two sections: items that are kept or used, and items that can be sold (selected, then sold with the buttons). */
    readonly sections: { readonly kept: string; readonly sellable: string };
    readonly sellOne: string;
    readonly sellAll: string;
    readonly backChannel: string;
  };
  readonly sections: Readonly<Record<SleeveSectionId, string>>;
  readonly statLabels: Readonly<Record<StatId, string>>;
  /** Label of the bar under a decaying stat; says so when the cycle is paused. */
  readonly bars: { heat(running: boolean): string; legend(running: boolean): string };
  /** Display unit of each reward kind (UI text only; logic never reads it). */
  readonly rewardUnits: Readonly<Record<RewardKind, string>>;
  /** Display unit of each currency a buyable can be paid in. */
  readonly costUnits: Readonly<Record<Currency, string>>;
  /** Why an action is locked, in a few words. */
  readonly lock: { access(level: number): string; poster(level: number): string };
  /** What starting an action costs. */
  readonly startCost: {
    amount(amount: string, unit: string): string;
    share(percent: string, unit: string, current: string | null): string;
    join(parts: readonly string[]): string;
    none(unit: string): string;
  };
  readonly action: {
    locked(reason: string): string;
    info(parts: ActionInfoParts): string;
    levelBar(level: number, xp: string, next: string): string;
    sleeveBar(level: number, xp: string, next: string, runsToNext: number): string;
    reward(parts: RewardLineParts): string;
    /** The label of the button in the top right corner of an action card that applies a schematic. */
    readonly augment: string;
    /** The cells of the square on an action card: the symbol on the square button and the name read out for it. */
    readonly modes: Readonly<Record<SquareCellId, { readonly symbol: string; readonly name: string }>>;
  };
  readonly tips: {
    access(parts: AccessTipParts): string;
    interfaceSpeed(parts: InterfaceSpeedTipParts): string;
    hackingProficiency(parts: HackingProficiencyTipParts): string;
    actionSpeed(parts: ActionSpeedTipParts): string;
    payout(parts: PayoutTipParts): string;
    heat(parts: HeatTipParts): string;
    iceRating(parts: IceRatingTipParts): string;
    legend(parts: LegendTipParts): string;
    critical(parts: CriticalTipParts): string;
    buyable(parts: BuyableTipParts): string;
    stack(parts: StackTipParts): string;
    augment(parts: AugmentTipParts): string;
    overclock(parts: OverclockTipParts): string;
    focus(parts: FocusTipParts): string;
    burnLead(parts: BurnLeadTipParts): string;
    zeroDay(parts: ZeroDayTipParts): string;
    adminKey(parts: AdminKeyTipParts): string;
    skillShard(parts: SkillShardTipParts): string;
    /** The tip of a stack of items that cannot be paid out (applied instead). */
    stackKept(parts: StackKeptTipParts): string;
    backChannel(parts: BackChannelTipParts): string;
    moles(parts: MolesTipParts): string;
    synths(parts: SynthTipParts): string;
    networkGrowthValues(parts: NetworkGrowthValueParts): BuyableValues;
  };
  readonly resleeve: { readonly idle: string; readonly armed: string; readonly cancel: string };
  /** Messages shown over the game. */
  readonly notices: { readonly otherTab: string; readonly taken: string };
  /** The buttons and messages for moving a save in and out as text. */
  readonly saveTools: {
    readonly export: string;
    readonly exportTip: string;
    readonly import: string;
    readonly importTip: string;
    readonly exported: string;
    readonly exportFailed: string;
    readonly importPrompt: string;
    readonly imported: string;
    readonly importInvalid: string;
  };
  /** The changelog button and its modal. */
  readonly changelog: {
    readonly button: string;
    readonly tip: string;
    readonly title: string;
    readonly empty: string;
    readonly close: string;
  };
  readonly controls: {
    readonly resetSave: string;
    readonly resetSaveTip: string;
    readonly revealLocked: string;
    readonly revealLockedTip: string;
    readonly testDrop: string;
    readonly testDropTip: string;
    readonly doubleCredits: string;
    readonly doubleCreditsTip: string;
    /** Label of the icon button in the corner of an action card that starts a run. */
    readonly startRun: string;
    speedToggle(factor: number): string;
    readonly speedToggleTip: string;
  };
}

/** The drop chance lines of an item tooltip: one per action that can drop the stack, or 0% while none can. */
function dropChanceLines(drops: readonly DropChanceParts[]): string[] {
  return drops.length === 0 ? ['Drop Chance = 0%'] : drops.map((d) => `Drop Chance = ${d.percent}% per ${d.action} run`);
}

/** The hacking multiplier written out for a curve: `1 + scale x ((1 + Hacking Proficiency)^exponent - 1) / exponent`. */
function hackingMultiplierFormula(curve: HackingCurve): string {
  const scale = formatPlain(curve.scale);
  const exponent = formatPlain(curve.exponent);
  if (curve.exponent === 1) return `1 + ${scale} x Hacking Proficiency`;
  if (curve.exponent === 0) return `1 + ${scale} x ln(1 + Hacking Proficiency)`;
  return `1 + ${scale} x ((1 + Hacking Proficiency)^${exponent} - 1) / ${exponent}`;
}

/** A line that says where the Hacking Multiplier curve changes shape, or nothing while it is one curve. */
function hackingCurveBeyondLines(curve: HackingCurve): string[] {
  if (!curve.beyond) return [];
  const { knee, exponent } = curve.beyond;
  const effect = exponent < curve.exponent ? 'each further point adds even less' : 'each further point adds more';
  return [`Past ${formatPlain(knee)} Hacking Proficiency the exponent is ${formatPlain(exponent)}: ${effect}`];
}

/** The default (placeholder) text of the game. */
export const uiText: UiText = {
  perSecond: (amount) => `${amount}/s`,
  format: {
    speed: (value) => `x${value}`,
    income: (value) => `+${value}`,
    heatPoints: (value) => `${value} heat`,
    powerOfTen: (exponent) => `1e${exponent}`,
    seconds: (value) => `${value}s`,
  },
  credits: (amount) => `Credits: ${amount}`,
  titles: {
    sleeve: 'Sleeve',
    network: 'Network',
    inventory: 'Inventory',
    upgrades: 'Sleeve Improvements',
    exploitation: 'Network Exploitation',
    skills: 'Skills',
    resleeveSkills: 'Re-sleeve skills',
    stats: 'Stats',
  },
  tabs: { character: 'Character', skills: (points) => (points > 0 ? `Skills (${points})` : 'Skills'), stats: 'Stats' },
  skills: { points: (points) => `Skill points: ${points}`, resleevePoints: (points) => `Re-sleeve points: ${points}` },
  runs: {
    empty: 'No finished sleeve-runs yet. Re-sleeve to write the first one down.',
    headers: { run: 'Run', income: 'Credits per second at the end', levels: 'Action levels in total' },
    label: (number) => `Run ${number}`,
  },
  inventory: {
    label: (rarity, item) => `${rarity} ${item}`,
    sections: { kept: 'Items', sellable: 'For sale' },
    sellOne: 'Sell',
    sellAll: 'Sell all',
    backChannel: 'Back channel',
  },
  sections: { rebuyable: 'Rebuyable', oneTime: 'One-time', nodes: 'Paid in nodes' },
  statLabels: {
    access: 'Access level',
    interfaceSpeed: 'Interface speed',
    hackingProficiency: 'Hacking Proficiency',
    iceRating: 'ICE Rating',
    heat: 'Heat',
    legend: 'Legend',
    nodes: 'Nodes',
    income: 'Credits per second',
    payout: 'Payout per node',
    moles: 'Moles',
    synths: 'Synthetic sleeves',
    synthIncome: 'Synthetic credits per second',
    criticalChance: 'Critical success',
  },
  bars: {
    heat: (running) => (running ? 'Heat cooldown' : 'Heat cooldown (paused: needs a whole point of heat)'),
    legend: (running) => (running ? 'Legend cooldown' : 'Legend cooldown (paused: no legend)'),
  },
  rewardUnits: {
    credits: 'credits',
    networkNodes: 'nodes',
    hackingProficiency: 'hacking proficiency',
    nodePayout: 'node payout',
    iceRating: 'iceRating',
    legend: 'legend',
  },
  costUnits: { credits: 'credits', networkNodes: 'nodes', skillPoints: 'skill points', resleevePoints: 're-sleeve points' },
  lock: {
    access: (level) => `Needs access level ${level}`,
    poster: (level) => `Increase Access level to ${level} to unlock`,
  },
  startCost: {
    amount: (amount, unit) => `${amount} ${unit}`,
    share: (percent, unit, current) => `${percent}% of ${unit}${current === null ? '' : ` (${current})`}`,
    join: (parts) => parts.join(' + '),
    none: (unit) => `0 ${unit}`,
  },
  action: {
    locked: (reason) => `Locked: ${reason}`,
    info: ({ speed, duration, startCost, auto }) =>
      `Action speed ${speed} | ${duration}${startCost ? ` | costs ${startCost}` : ''}${auto ? ' | auto' : ''}`,
    levelBar: (level, xp, next) => `Lv ${level} - ${xp}/${next} XP`,
    sleeveBar: (level, xp, next, runsToNext) => `Sleeve Lv ${level} - ${xp}/${next} XP | ${runsToNext} runs`,
    reward: ({ amount, unit, multiplier, heatPerRun, heatPerSecond }) =>
      `+${amount} ${unit}/run${multiplier === null ? '' : ` | x${multiplier}`}${heatPerRun > 0 ? ` | +${heatPerRun} heat` : ''}${heatPerSecond > 0 ? ` | +${heatPerSecond} heat/s` : ''}`,
    augment: 'Augment',
    modes: {
      autoRun: { symbol: '↻', name: 'Auto-run' },
      overclock: { symbol: 'OV', name: 'Overclock' },
      focus: { symbol: 'FO', name: 'Focus' },
      augment: { symbol: 'AU', name: 'Augment' },
    },
  },
  // Every calculation tip has the same layout: the formulas, a blank line, the variables, a blank line, the result.
  // The blank lines are intentional. The text says what things do.
  tips: {
    access: ({ start, purchases, level, next }) =>
      [
        'Access Level = Start Level + Purchases',
        '',
        `Start Level = ${start}`,
        `Purchases = ${purchases}`,
        '',
        `Access Level = ${level}`,
        ...(next === null ? [] : ['', `Next unlock: ${next.name} at Access Level ${next.level}`]),
      ].join('\n'),
    interfaceSpeed: ({ base, boosts, networkFactor, nodes, hackingMultiplier, curve, skillFactor, total }) =>
      [
        `Interface Speed = (base + boost) x ${networkFactor === null ? '' : 'Node Bonus x '}Hacking Multiplier${skillFactor === null ? '' : ' x Skills'}`,
        `Hacking Multiplier = ${hackingMultiplierFormula(curve)}`,
        ...hackingCurveBeyondLines(curve),
        '',
        `Base = ${base}`,
        `Boosts = ${boosts}`,
        ...(networkFactor === null ? [] : [`Node Bonus = ${networkFactor} (1 + ln(nodes) / 100, with ${nodes} nodes)`]),
        `Hacking Multiplier = ${hackingMultiplier}`,
        ...(skillFactor === null ? [] : [`Skills = ${skillFactor}`]),
        '',
        `Interface Speed = ${total}`,
      ].join('\n'),
    hackingProficiency: ({ proficiency, hackingMultiplier, curve }) =>
      [
        `Hacking Multiplier = ${hackingMultiplierFormula(curve)}`,
        ...hackingCurveBeyondLines(curve),
        'Interface Speed = (base + boost) x Hacking Multiplier',
        '',
        `Hacking Proficiency = ${proficiency}${curve.exponent < 1 ? ' (each further point adds less)' : ''}`,
        '',
        `Hacking Multiplier = ${hackingMultiplier}`,
      ].join('\n'),
    actionSpeed: ({
      speed,
      actionLevel,
      levelBonus,
      actionFactor,
      actionScaling,
      sleeveLevel,
      sleeveFactor,
      sleeveScaling,
      interfaceFactor,
      globalFactor,
      overclockFactor,
      focusFactor,
      baseDuration,
      duration,
    }) => {
      const perLevel = (s: LevelScaling): string =>
        s.kind === 'linear' ? `+${formatPlain(s.perLevel * 100)}% per level` : `x${formatPlain(s.base)} per level`;
      return [
        `Action Speed = Action Level x Sleeve Level x Interface Speed${globalFactor === null ? '' : ' x Global Speed'}${overclockFactor === null ? '' : ' x Overclock'}${focusFactor === null ? '' : ' x Focus'}`,
        'Run Time = Base Time / Action Speed',
        '',
        `Action Level = ${actionFactor} (level ${actionLevel}${levelBonus > 0 ? ` + ${levelBonus} from purchases` : ''}, ${perLevel(actionScaling)})`,
        `Sleeve Level = ${sleeveFactor} (level ${sleeveLevel}, ${perLevel(sleeveScaling)})`,
        `Interface Speed = ${interfaceFactor}`,
        ...(globalFactor === null ? [] : [`Global Speed = ${globalFactor}`]),
        ...(overclockFactor === null ? [] : [`Overclock = ${overclockFactor}`]),
        ...(focusFactor === null ? [] : [`Focus = ${focusFactor}`]),
        '',
        `Action Speed = ${speed}`,
        `Run Time = ${duration} (${baseDuration} / ${speed})`,
      ].join('\n');
    },
    payout: ({ base, creditLever, purchases, actionBonus, keepPercent, perNode, nodes, total }) =>
      [
        `Payout per Node = (Base + Action Bonus) x ${creditLever === null ? '' : 'Credit Lever x '}Purchases${keepPercent === null ? '' : ' x Heat Tax Kept'}`,
        'Network Payout = Nodes x Payout per Node',
        '',
        `Base = ${base} credits/s`,
        ...(creditLever === null ? [] : [`Credit Lever = ${creditLever}`]),
        `Purchases = ${purchases}`,
        `Action Bonus = ${actionBonus} credits/s`,
        ...(keepPercent === null ? [] : [`Heat Tax Kept = ${keepPercent}%`]),
        '',
        `Payout per Node = ${perNode} credits/s`,
        `Network Payout = ${nodes} x ${perNode} = ${total} credits/s`,
      ].join('\n'),
    heat: ({ heat, perPointPercent, reductionPercent, taxPercent, stopsAt, amount, cycleSeconds, moles }) =>
      [
        'Heat Tax = Heat x Tax per Point x (1 - Heat Reduction)',
        '',
        `Heat = ${heat}`,
        `Tax per Point = ${perPointPercent}%`,
        `Heat Reduction = ${reductionPercent}% (from ICE Rating)`,
        '',
        `Heat Tax = ${taxPercent}% of all credits earned from nodes`,
        ...(stopsAt === null ? [] : [`Node credits stop at ${stopsAt}`]),
        `Heat falls by ${amount} every ${cycleSeconds}s, in whole points only: it waits until there is at least ${amount}`,
        ...(moles === null ? [] : [`${moles.moles} Moles make it ${moles.boostPercent}% faster`]),
      ].join('\n'),
    iceRating: ({ orders, perOrderPercent, reductionPercent, fullAt }) =>
      [
        'Heat Reduction = Orders of Magnitude x Reduction per Order',
        '',
        `Orders of Magnitude = ${orders}`,
        `Reduction per Order = ${perOrderPercent}%`,
        '',
        `Heat Reduction = ${reductionPercent}%`,
        ...(fullAt === null ? [] : [`Reaches 100% at ${fullAt}`]),
      ].join('\n'),
    critical: ({ chancePercent, xpMultiplier, rewardMultiplier }) =>
      [
        `Chance per completed run = ${chancePercent}%`,
        '',
        `A critical success gives ${xpMultiplier}x action XP and pays ${rewardMultiplier}x the reward`,
        'Some actions may do something different',
      ].join('\n'),
    legend: ({ legend, baseSeconds, speedupPercent, cycleSeconds, decayMinutes }) =>
      [
        'Heat Cooldown Time = Base Time / (1 + Speedup per Legend x Legend)',
        '',
        `Base Time = ${baseSeconds}s`,
        `Speedup per Legend = ${speedupPercent}%`,
        `Legend = ${legend}`,
        '',
        `Heat Cooldown Time = ${cycleSeconds}s`,
        `Legend falls by 1 every ${decayMinutes} min`,
      ].join('\n'),
    buyable: ({ name, description, formula, values, cost, costUnit, owned, repeatable, maxed, toggleable, enabled }) => {
      // The name, what the purchase does and its formula; then the current numbers; then what the player can do with it.
      const about = [...(description ? [description] : []), ...(formula ? [formula] : [])];
      const numbers = values === null ? [] : ['', ...values.variables, '', values.result];
      if (toggleable && owned > 0) {
        return [`${name} (${enabled ? 'on' : 'off'})`, ...about, ...numbers, '', `Click to switch ${enabled ? 'off' : 'on'}`].join('\n');
      }
      if (maxed) return [name, ...about, ...numbers, '', 'Owned'].join('\n');
      return [name, ...about, ...numbers, '', `Cost = ${cost} ${costUnit}`, ...(repeatable ? [`Owned = ${owned}`] : [])].join('\n');
    },
    stack: ({ label, sellValue, count, total, unit, drops }) =>
      [
        label,
        `Used as blackmail: pays ${sellValue} ${unit} each`,
        'Heat and the credit lever leave the payment untouched',
        'Click to select it, then press Sell or Sell all',
        '',
        ...dropChanceLines(drops),
        `Owned = ${count}`,
        `Payment = ${total} ${unit}`,
      ].join('\n'),
    augment: ({ xpPerRun, baseXp, bonus, bonusPercent, applied, held, next, item }) =>
      [
        'XP per Run = Base XP x Boost of each Rarity',
        'Boost of a Rarity = 1 + Bonus per Augment x Augments of that Rarity',
        '',
        `Bonus per Augment = ${bonusPercent}%`,
        ...(applied.length === 0 ? ['Augments = 0'] : applied.map((a) => `${a.rarity} Augments = ${a.count}`)),
        '',
        // The whole calculation with the numbers in: the base XP, then the boost of each rarity that has augments, and the result.
        `XP per Run = ${[baseXp, ...applied.map((a) => `(1 + ${bonus} x ${a.count})`)].join(' x ')} = ${xpPerRun}`,
        '',
        `${item}s held = ${held}`,
        ...(next === null ? [] : [`Next to apply = ${next}`]),
        'Click to apply one to this action: its action levels come sooner (sleeve levels are unaffected)',
      ].join('\n'),
    overclock: ({ on, strength, speed, reward, heatPerMinute, heatPerRunFactor, nodesLost, alsoPays, holdsHeat, chain }) =>
      [
        `Overclock (${on ? 'on' : 'off'})`,
        ...(speed === null ? [] : ['Action Speed = Action Speed x (1 + Speed Bonus)']),
        ...(reward === null ? [] : ['Reward per Run = Reward per Run x (1 + Reward Bonus)']),
        ...(speed === null && reward === null ? [] : ['Bonus = Action Bonus x Strength', '']),
        ...(speed === null && reward === null ? [] : [`Strength = ${strength} (each extra copy of Overclock adds to it)`]),
        ...(speed === null ? [] : [`Speed Bonus = ${speed.percent}% (${speed.basePercent}% x Strength)`]),
        ...(reward === null ? [] : [`Reward Bonus = ${reward.percent}% (${reward.basePercent}% x Strength)`]),
        ...(alsoPays === null ? [] : [`Each completed run also pays the nodes of one ${alsoPays} run`]),
        ...(speed === null && reward === null && alsoPays === null ? [] : ['']),
        ...(heatPerMinute === null ? [] : [`Costs ${heatPerMinute} heat per minute while this action runs`]),
        ...(heatPerRunFactor === null ? [] : [`Each run makes ${heatPerRunFactor}x as much heat`]),
        ...(nodesLost === null ? [] : [`Each completed run costs ${nodesLost} nodes`]),
        ...(holdsHeat ? ['Heat is held in place while this action runs: it cannot cool and Burn leads cannot be used'] : []),
        ...(chain === null
          ? []
          : [
              '',
              `Kill chain = ${chain.links} / ${chain.maxLinks} links`,
              `Each link adds ${chain.rewardPercent}% to the Reward Bonus and ${chain.nodesPercent}% to the share of the balance a run takes`,
              'Stopping the action or switching Overclock off breaks the chain',
            ]),
        '',
        `Click to switch ${on ? 'off' : 'on'}`,
      ].join('\n'),
    focus: ({ on, bonusPercent, used, slots, full }) =>
      [
        `Focus (${on ? 'on' : 'off'})`,
        'Action Speed = Action Speed x (1 + Focus Bonus)',
        '',
        `Focus Bonus = ${bonusPercent}%`,
        `Focus Slots in use = ${used} / ${slots}`,
        '',
        full ? 'Every slot is in use: switch another action off first' : `Click to switch ${on ? 'off' : 'on'}`,
      ].join('\n'),
    burnLead: ({ label, sharePercent, drops, heat, heatAfter, count, canUse }) =>
      [
        label,
        'Heat after Use = Heat x (1 - Share Removed)',
        'Click the lead to use one; it leaves the Inventory',
        '',
        `Share Removed = ${sharePercent}% of the current heat`,
        `Heat now = ${heat}`,
        ...dropChanceLines(drops),
        '',
        canUse ? `Heat after Use = ${heatAfter}` : 'Needs some heat to act on',
        `Owned = ${count}`,
      ].join('\n'),
    zeroDay: ({ label, drops, actionName, count, on, canToggle }) =>
      [
        label,
        `While switched on, every completed ${actionName} run uses one up and is a critical success`,
        'It switches itself off when the last one is used',
        '',
        ...dropChanceLines(drops),
        on ? 'Switched on' : 'Switched off',
        canToggle ? `Click to switch ${on ? 'off' : 'on'}` : 'Needs a Zero-day to switch on',
        `Owned = ${count}`,
      ].join('\n'),
    adminKey: ({ label, drops, actionName, count, on, canToggle, bonusName, bonusPercent }) =>
      [
        label,
        `While switched on, every completed ${actionName} run uses one up and is a critical success`,
        ...(bonusName === null ? [] : [`Each of those critical runs has a ${bonusPercent}% chance to drop a ${bonusName}`]),
        'It switches itself off when the last one is used',
        '',
        ...dropChanceLines(drops),
        on ? 'Switched on' : 'Switched off',
        canToggle ? `Click to switch ${on ? 'off' : 'on'}` : 'Needs an Admin key to switch on',
        `Owned = ${count}`,
      ].join('\n'),
    skillShard: ({ label, levels, count, canUse, drops }) =>
      [
        label,
        `Delays the XP scaling of a random unlocked action by ${levels} level${levels === '1' ? '' : 's'}: its next level costs stay at the first level's cost for longer`,
        'Action levels only; sleeve levels are unaffected',
        '',
        ...dropChanceLines(drops),
        canUse ? 'Click to use one; it leaves the Inventory' : 'Needs a shard and an unlocked action',
        `Owned = ${count}`,
      ].join('\n'),
    stackKept: ({ label, count, drops }) =>
      [
        label,
        'Applied to an action with its Augment button',
        'The most common one is used first',
        '',
        ...dropChanceLines(drops),
        `Owned = ${count}`,
      ].join('\n'),
    backChannel: ({ label, molesPerItem, boostPercent }) =>
      [label, `Give up one for ${molesPerItem} Moles`, `Each Mole is one point of heat that cools down ${boostPercent}% faster`].join('\n'),
    synths: ({ count, perSecond }) =>
      [
        'Credits per Second = Sum of Credits per Second Then x min(1, Action Levels Now / Action Levels Then)',
        '',
        'Each synthetic sleeve copies a finished sleeve-run: Then is the end of that run, Now is this sleeve',
        'A synthetic sleeve keeps its full amount once this sleeve has caught up with it',
        'Heat takes none of it',
        '',
        `Synthetic Sleeves = ${count}`,
        `Credits per Second = ${perSecond}`,
      ].join('\n'),
    moles: ({ moles, boostPercent }) =>
      [
        'Heat Cooldown Speed = Normal Speed x (1 + Mole Boost) while Moles remain',
        'Each point of heat cooled uses one Mole',
        '',
        `Mole Boost = ${boostPercent}%`,
        '',
        `Moles = ${moles}`,
      ].join('\n'),
    networkGrowthValues: ({ level, percent }) => ({
      variables: [`Action level = ${level}`],
      result: `Growth factor percentage = ${percent}%`,
    }),
  },
  resleeve: {
    idle: 'Re-sleeve (test: no requirement)',
    armed: 'Confirm re-sleeve: credits, network, levels and purchases reset. Re-sleeve skills stay, and you gain a re-sleeve point.',
    cancel: 'Cancel',
  },
  notices: {
    otherTab: 'This game was opened in another tab, which now owns the save. Reload this page to play here instead.',
    taken: 'This game is already open in another tab or window. Close this one and play there, or close that one and reload this page.',
  },
  saveTools: {
    export: 'Export save',
    exportTip: 'Copies your save as text, as a backup or to move it to another browser',
    import: 'Import save',
    importTip: 'Replaces your save with text you copied earlier',
    exported: 'Save copied to the clipboard.',
    exportFailed: 'Could not copy the save. Your browser blocked the clipboard.',
    importPrompt: 'Paste your save here. It replaces the game you are playing now.',
    imported: 'Save imported. The page reloads now.',
    importInvalid: 'That text is not a valid save of this version. Nothing was changed.',
  },
  changelog: {
    button: 'Changelog',
    tip: 'Shows what changed in each version of the game',
    title: 'Changelog',
    empty: 'Nothing here yet.',
    close: 'Close',
  },
  controls: {
    resetSave: 'Reset save',
    resetSaveTip: 'Wipes the game and the save, and starts over',
    revealLocked: 'Show locked',
    revealLockedTip: 'Shows the full card of actions that are still locked instead of the access level poster (test aid)',
    testDrop: 'Test drop',
    testDropTip: 'Drops one item now by the current rarity ratios (test aid)',
    doubleCredits: 'Double credits',
    doubleCreditsTip: 'Doubles the credits held now (test aid)',
    startRun: 'Start run',
    speedToggle: (factor) => `Speed x${formatPlain(factor)}`,
    speedToggleTip: 'Runs game time faster (test aid)',
  },
};
