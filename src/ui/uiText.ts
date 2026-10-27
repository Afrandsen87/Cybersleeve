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
import type { AutomationFeature, CorporationEffect, Currency, RewardKind } from '../core';
import { formatPlain } from '../numbers';

import { tipText } from './tipText';

import type {
  AccessTipParts,
  ActionInfoParts,
  ActionSpeedTipParts,
  AdminKeyTipParts,
  AugmentTipParts,
  BackChannelTipParts,
  BurnLeadTipParts,
  BuyableTipParts,
  BuyableValues,
  CriticalTipParts,
  FocusTipParts,
  HackingProficiencyTipParts,
  HeatTipParts,
  IceRatingTipParts,
  IncomeTipParts,
  InterfaceSpeedTipParts,
  LegendTipParts,
  MolesTipParts,
  NetworkGrowthValueParts,
  OverclockTipParts,
  PayoutTipParts,
  RewardLineParts,
  SkillShardTipParts,
  SleeveSectionId,
  SquareCellId,
  StackKeptTipParts,
  StackTipParts,
  StatId,
  SynthTipParts,
  ZeroDayTipParts,
} from './uiTextParts';

export * from './uiTextParts';

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
    readonly automation: string;
    readonly corporation: string;
  };
  /** The tabs at the top. The Skills tab shows the points available, unless there are none. */
  readonly tabs: {
    readonly character: string;
    skills(points: number): string;
    automation(points: number): string;
    readonly stats: string;
    readonly corporation: string;
  };
  /** The Corporation tab: how its actions are described. */
  readonly corporation: {
    /** The line under an action's title. */
    info(duration: string): string;
    /** The hover text of an action: its name, its run time and what it does (one line per effect). */
    tip(parts: { readonly name: string; readonly duration: string; readonly effects: readonly string[] }): string;
    /** One sentence per kind of effect; a kind without one does not compile. */
    readonly effects: {
      readonly [K in CorporationEffect['kind']]: (
        effect: Extract<CorporationEffect, { kind: K }>,
        itemName: (id: string) => string,
        percent: string,
      ) => string;
    };
  };
  /** The Automation tab: the points, each feature and its controls. */
  readonly automation: {
    points(points: string): string;
    /** The unlock button of a feature that is not unlocked yet (it costs one point). */
    readonly unlock: string;
    /** The name and what each feature does. */
    readonly features: Readonly<Record<AutomationFeature, { readonly name: string; readonly description: string }>>;
    /** Auto Burn's switch (shows the state) and the label of its heat ceiling. */
    autoBurnSwitch(on: boolean): string;
    readonly autoBurnCeiling: string;
    /** The label of the share an action gets from Augment dispersal, in percent. */
    readonly dispersalShare: string;
  };
  /** The Skills box and the re-sleeve skills group. */
  readonly skills: {
    points(points: string): string;
    resleevePoints(points: string): string;
    /** Stands in for the name, description, price and tip of a re-sleeve skill until the first re-sleeve. */
    readonly hidden: string;
  };
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
    /** The critical success highlight of a card: just a mark for one success in the last second, an average per second for several. */
    critFlash(count: number, perSecond: string): string;
    /** The cells of the square on an action card: the symbol on the square button and the name read out for it. */
    readonly modes: Readonly<Record<SquareCellId, { readonly symbol: string; readonly name: string }>>;
  };
  readonly tips: {
    access(parts: AccessTipParts): string;
    interfaceSpeed(parts: InterfaceSpeedTipParts): string;
    hackingProficiency(parts: HackingProficiencyTipParts): string;
    actionSpeed(parts: ActionSpeedTipParts): string;
    payout(parts: PayoutTipParts): string;
    income(parts: IncomeTipParts): string;
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
    automation: 'Automation',
    corporation: 'Corporation',
  },
  tabs: {
    character: 'Character',
    skills: (points) => (points > 0 ? `Skills (${points})` : 'Skills'),
    automation: (points) => (points > 0 ? `Automation (${points})` : 'Automation'),
    stats: 'Stats',
    corporation: 'Corporation',
  },
  corporation: {
    info: (duration) => `Run time ${duration}`,
    tip: ({ name, duration, effects }) => [name, `Run Time = ${duration}`, '', ...effects].join('\n'),
    effects: {
      upgradeRandomItem: (effect, itemName, percent) =>
        `Each run has a ${percent}% chance to upgrade one random ${itemName(effect.itemId)} you hold to the next rarity`,
    },
  },
  automation: {
    points: (points) => `Automation points: ${points}`,
    unlock: 'Unlock (1 point)',
    features: {
      autoBurn: {
        name: 'Auto Burn',
        description: 'Keeps using Burn leads while heat is above the ceiling you set, just enough of them to bring it back down.',
      },
      autosale: {
        name: 'Kompromat autosale',
        description: 'Sells what you hold of the rarities you switch on, as it arrives, for the normal price.',
      },
      dispersal: {
        name: 'Augment dispersal',
        description: 'Applies the Augment schematics you hold to the actions by the shares you set.',
      },
    },
    autoBurnSwitch: (on) => (on ? 'Auto Burn: on' : 'Auto Burn: off'),
    autoBurnCeiling: 'Use leads above this heat',
    dispersalShare: 'Share (%)',
  },
  skills: { points: (points) => `Skill points: ${points}`, resleevePoints: (points) => `Re-sleeve points: ${points}`, hidden: '???' },
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
    critFlash: (count, perSecond) => (count > 1 ? `${perSecond} crits/s` : 'CRITICAL!'),
    modes: {
      autoRun: { symbol: '↻', name: 'Auto-run' },
      overclock: { symbol: 'OV', name: 'Overclock' },
      focus: { symbol: 'FO', name: 'Focus' },
      augment: { symbol: 'AU', name: 'Augment' },
    },
  },
  tips: tipText,
  resleeve: {
    idle: 'Re-sleeve',
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
    importInvalid: 'That text is not a valid save of this version. Your current game is kept.',
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
    revealLocked: 'Show all',
    revealLockedTip: 'Shows everything that is still hidden: locked actions, tabs, stats, purchases and items (test aid)',
    testDrop: 'Test drop',
    testDropTip: 'Drops one item now by the current rarity ratios (test aid)',
    doubleCredits: 'Double credits',
    doubleCreditsTip: 'Doubles the credits held now (test aid)',
    startRun: 'Start run',
    speedToggle: (factor) => `Speed x${formatPlain(factor)}`,
    speedToggleTip: 'Runs game time faster (test aid)',
  },
};
