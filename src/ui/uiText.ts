import { formatPlain } from '../numbers';

import { tipText } from './tipText';

export * from './uiTextParts';

import type { UiText } from './uiTextTypes';

export type { UiText };

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
    holdings: 'Holdings',
    assetAcquisition: 'Asset Acquisition',
    hostileNegotiation: 'Hostile Negotiation',
    syntheticSleeves: 'Synthetic Sleeves',
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
    locked: (rank) => `Needs corporate rank ${rank}`,
    tip: ({ name, duration, effects }) => [name, `Run Time = ${duration}`, '', ...effects].join('\n'),
    effects: {
      acquireStock: (_effect, _itemName, percent) => `Each run has a ${percent}% chance to acquire a stock of a competitor`,
      upgradeRandomItem: (effect, itemName, percent) =>
        `Each run has a ${percent}% chance to upgrade one random ${itemName(effect.itemId)} you hold to the next rarity`,
    },
  },
  automation: {
    points: (points) => `Automation points: ${points}`,
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
  skills: {
    points: (points) => `Skill points: ${points}`,
    resleevePoints: (points) => `Re-sleeve points: ${points}`,
    hidden: '???',
    branches: {
      cybernetics: 'Cybernetics',
      anonymity: 'Anonymity',
      leverage: 'Leverage',
      retention: 'Retention',
      reach: 'Reach',
      synthetics: 'Synthetics',
      corporation: 'Corporation',
    },
    generalBranch: 'General',
    note: 'Skills that read ??? will be unlocked as you play further.',
  },
  runs: {
    empty: 'No finished sleeve-runs yet. Re-sleeve to write the first one down.',
    headers: { run: 'Run', income: 'Credits per second at the end', levels: 'Action levels in total' },
    label: (number) => `Run ${number}`,
    actionLevel: (name, level) => `${name} ${level}`,
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
    access: 'Access Level',
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
    corporateRank: 'Corporate rank',
    ownedCorporations: 'Owned corporations',
    employees: 'Employees',
    stocksOwned: 'Stocks owned',
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
  costUnits: {
    credits: 'credits',
    networkNodes: 'nodes',
    skillPoints: 'skill points',
    resleevePoints: 're-sleeve points',
    automationPoints: 'automation points',
  },
  lock: {
    access: (level) => `Requires Access Level ${level}`,
    poster: (level) => `Requires Access Level ${level}`,
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
    reward: ({ amount, unit, multiplier, heatPerRun, heatChancePercent, heatPerSecond }) =>
      `+${amount} ${unit}/run${multiplier === null ? '' : ` | x${multiplier}`}${heatPerRun > 0 ? ` | ${heatChancePercent === null ? '' : `${heatChancePercent}% chance of `}+${heatPerRun} heat` : ''}${heatPerSecond > 0 ? ` | +${heatPerSecond} heat/s` : ''}`,
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
    armed: 'Confirm re-sleeve: credits, network, levels and purchases reset. You will keep sleeve levels and gain a re-sleeve point.',
    cancel: 'Cancel',
    needLevels: (held, needed) => `Needs ${needed} sleeve levels in total across all actions to re-sleeve. You have ${held}.`,
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
