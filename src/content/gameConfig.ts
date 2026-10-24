/**
 * @module content
 *
 * THE tuning file. Every number that shapes progression lives here; change a value and the whole
 * game follows, with no code changes. Names are placeholders and may be renamed freely.
 * See `docs/CONFIG.md` for a description of every variable.
 *
 * @remarks
 * For quick experiments, derive a variant with `createConfig(gameConfig, { global: { speedMultiplier: 10 } })`
 * instead of editing this file.
 */
import { num } from '../numbers';
import type { GameConfig } from '../core';

/** Id of the first action. */
export const PRACTICE_HACKING = 'practice-hacking';
/** Id of the network-building action. */
export const GROW_NETWORK = 'grow-network';
/** Id of the malware action (needs access level 2). */
export const PUSH_MALWARE = 'push-malware';
/** Id of the server-killing action (unlocks at 1000 nodes). */
export const KILL_SERVERS = 'kill-servers';
/** Id of the legend action (unlocked by a global buyable). */
export const LEGEND = 'legend';
/** Id of the global interface-speed buyable. */
export const INTERFACE_BOOST = 'interface-boost';
/** Id of the global access-level buyable. */
export const ACCESS_UPGRADE = 'access-upgrade';
/** Id of the auto-run buyable. */
export const AUTO_RUN = 'auto-run';
/** Id of the duplicate-processors buyable. */
export const DUPLICATE_PROCESSORS = 'duplicate-processors';
/** Id of the skill-transfer buyable (Practice Hacking's sleeve level also levels Grow Network's speed). */
export const SKILL_TRANSFER = 'skill-transfer';
/** Id of the study-methods buyable (reduces the XP every sleeve level needs). */
export const STUDY_METHODS = 'study-methods';
/** Id of the Grow Network auto-run buyable. */
export const NETWORK_AUTO_RUN = 'network-auto-run';
/** Id of the repeatable Grow Network output buyable. */
export const NETWORK_OUTPUT = 'network-output';
/** Id of the self-replicating network buyable. */
export const SELF_REPLICATION = 'self-replication';
/** Id of the buyable that ties interface speed to the size of the network. */
export const NETWORK_SYNERGY = 'network-synergy';
/** Id of the sleeve buyable bought with network nodes. */
export const NODE_UPLINK = 'node-uplink';
/** Id of the sleeve buyable that raises what each node produces. */
export const NODE_PAYOUT = 'node-payout';
/** Id of the Push malware buyable that multiplies Circumvention. */
export const CIRCUMVENTION_BOOST = 'circumvention-boost';
/** Id of the Push malware auto-run buyable. */
export const MALWARE_AUTO_RUN = 'malware-auto-run';
/** Id of the global buyable that unlocks the Legend action. */
export const UNLOCK_LEGEND = 'unlock-legend';

/** The game's configuration (content and tuning). */
export const gameConfig: GameConfig = {
  actions: [
    {
      id: PRACTICE_HACKING,
      name: 'Practice Hacking',
      /** Seconds per run at speed x1. */
      baseDurationMs: 1_000,
      /** Added to the interface speed multiplier per completed run (no credits). */
      reward: num(0.001),
      rewardKind: 'interfaceSpeed',
      /** Action XP per completed run. */
      xpPerRun: num(1),
      // Optional per-action overrides (fall back to the global rules below):
      //   levels: { firstLevelXp: 10, growthFactor: 10 },
      //   speedScaling: { kind: 'linear', perLevel: 0.05 },
    },
    {
      id: GROW_NETWORK,
      name: 'Grow network',
      /** Seconds per run at speed x1. */
      baseDurationMs: 3_000,
      /** Network nodes per completed run (no credits). */
      reward: num(1),
      rewardKind: 'networkNodes',
      /** Action XP per completed run. */
      xpPerRun: num(1),
    },
    {
      id: PUSH_MALWARE,
      name: 'Push malware',
      /** Seconds per run at speed x1. */
      baseDurationMs: 6_000,
      /** Added to the node payout multiplier per completed run: 0.1% (no credits). */
      reward: num(0.001),
      rewardKind: 'nodePayout',
      /** Heat added per completed run. */
      heatPerRun: 1,
      /** Access level the sleeve needs to perform this action. */
      requiredAccessLevel: 2,
      /** Action XP per completed run. */
      xpPerRun: num(1),
    },
    {
      id: KILL_SERVERS,
      name: 'Kill servers',
      /** Seconds per run at speed x1: 2 minutes. */
      baseDurationMs: 120_000,
      /** Circumvention gained per completed run (no credits). */
      reward: num(1),
      rewardKind: 'circumvention',
      /** Paid at the start of every run: 1% of the current nodes, rounded down to whole nodes (so it needs at least 100 nodes). */
      startCost: { currency: 'networkNodes', fractionOfBalance: 0.01 },
      /** Unlocks once the network reaches 1000 nodes and stays unlocked after that. */
      unlock: { kind: 'nodes', amount: 1000 },
      /** Action XP per completed run. */
      xpPerRun: num(1),
    },
    {
      id: LEGEND,
      name: 'Legend',
      /** Seconds per run at speed x1: 5 minutes. */
      baseDurationMs: 300_000,
      /** Infamy gained per completed run (no credits). */
      reward: num(1),
      rewardKind: 'infamy',
      /** Available once the Unlock Legend buyable is owned. */
      unlock: { kind: 'buyable', buyableId: UNLOCK_LEGEND },
      /** Each completed run removes a quarter of the network and adds 50 heat. */
      completionEffects: [
        { kind: 'removeNodesFraction', fraction: 0.25 },
        { kind: 'addHeat', heat: 50 },
      ],
      /** Action XP per completed run. */
      xpPerRun: num(1),
    },
  ],

  buyables: [
    {
      id: AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes.',
      actionId: PRACTICE_HACKING,
      cost: num(10_000),
      effect: { kind: 'autoRun' },
    },
    {
      id: DUPLICATE_PROCESSORS,
      name: 'Duplicate processors',
      symbol: '+×2',
      description: 'Doubles the output. Can be bought without limit; each copy costs 10x more.',
      cost: num(150),
      costGrowth: 10, // price multiplier per copy already owned
      maxPurchases: Infinity,
      actionId: PRACTICE_HACKING,
      effect: { kind: 'outputMultiplier', factor: 2 },
    },
    {
      id: SKILL_TRANSFER,
      name: 'Skill transfer',
      symbol: 'ST',
      description: "Adds Practice Hacking's sleeve level to the level of Grow Network, which raises its speed (not its XP progress).",
      actionId: PRACTICE_HACKING,
      cost: num(50_000),
      effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: PRACTICE_HACKING, targetActionId: GROW_NETWORK },
    },
    {
      id: STUDY_METHODS,
      name: 'Study methods',
      symbol: 'SM',
      description:
        'Other actions need less XP per sleeve level: 0.01% less per sleeve level of Practice Hacking, at most 25% less (not Practice Hacking itself).',
      actionId: PRACTICE_HACKING,
      cost: num(1e15),
      // perLevel 0.0001 = 0.01 percent per sleeve level (the cap is reached at level 2500); maxReduction 0.25 = at most 25 percent
      effect: { kind: 'sleeveXpReduction', sourceActionId: PRACTICE_HACKING, perLevel: 0.0001, maxReduction: 0.25 },
    },
    {
      id: NETWORK_AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes.',
      actionId: GROW_NETWORK,
      cost: num(100),
      effect: { kind: 'autoRun' },
    },
    {
      id: NETWORK_OUTPUT,
      name: 'Parallel nodes',
      symbol: '×2',
      description: 'Doubles the output. Can be bought without limit; each copy costs 1000x more.',
      actionId: GROW_NETWORK,
      cost: num(10_000),
      costGrowth: 1_000, // every 3rd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'outputMultiplier', factor: 2 },
    },
    {
      id: SELF_REPLICATION,
      name: 'Self-replication',
      symbol: 'SR',
      description: 'The network grows by 0.0001% of its size every second.',
      actionId: GROW_NETWORK,
      cost: num(1e10),
      effect: { kind: 'networkGrowth', ratePerSecond: 0.000001 }, // 0.0001 percent = 1e-6 of its size
    },
    {
      id: NETWORK_SYNERGY,
      name: 'Network synergy',
      symbol: 'NS',
      description: 'Multiplies the base interface speed by 1 + ln(nodes) / 100, before the run multiplier.',
      actionId: GROW_NETWORK,
      cost: num(1e35),
      effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.01 },
    },
    {
      id: CIRCUMVENTION_BOOST,
      name: 'Circumvention boost',
      symbol: 'CB',
      description: 'Multiplies Circumvention by 2. Can be bought without limit; each copy costs 100x more.',
      actionId: PUSH_MALWARE,
      cost: num(250_000),
      costGrowth: 100, // every 2nd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'circumventionMultiplier', factor: 2 },
    },
    {
      id: MALWARE_AUTO_RUN,
      name: 'Auto-run',
      symbol: '↻',
      description: 'Restarts the action automatically when it finishes. Click to switch on or off.',
      actionId: PUSH_MALWARE,
      cost: num(10_000_000),
      effect: { kind: 'autoRun' },
    },
    // Global (sleeve) buyables: no actionId; they change the sleeve's stats. Prices are placeholders.
    {
      id: NODE_PAYOUT,
      name: 'Node payout',
      symbol: 'NP',
      description: 'Each node produces 50% more credits. Can be bought without limit; each copy costs 100,000x more.',
      cost: num(750),
      costGrowth: 100_000, // every 5th order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'nodePayoutMultiplier', factor: 1.5 },
    },
    {
      id: UNLOCK_LEGEND,
      name: 'Unlock Legend',
      symbol: 'LG',
      description: 'Unlocks the Legend action.',
      cost: num(1e20),
      effect: { kind: 'unlock' },
    },
    {
      id: NODE_UPLINK,
      name: 'Node uplink',
      symbol: 'NU',
      description: 'Raises base interface speed by 0.1. Paid in network nodes; each copy costs 100,000x more.',
      currency: 'networkNodes',
      cost: num(100),
      costGrowth: 100_000, // every 5th order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'interfaceSpeed', amount: 0.1 },
    },
    {
      id: INTERFACE_BOOST,
      name: 'Interface boost',
      symbol: 'IF',
      description:
        'Raises interface speed by 0.05, e.g. 0.1 to 0.15 (it multiplies the speed of every action). Each copy costs 1000x more.',
      cost: num(100),
      costGrowth: 1_000, // every 3rd order of magnitude
      maxPurchases: Infinity,
      effect: { kind: 'interfaceSpeed', amount: 0.05 },
    },
    {
      id: ACCESS_UPGRADE,
      name: 'Access upgrade',
      symbol: 'AX',
      description: 'Raises access level to 2, which unlocks Push malware.',
      cost: num(10_000),
      effect: { kind: 'accessLevel', level: 2 },
    },
  ],

  progression: {
    /** Completed runs of one action per batch of that action's sleeve XP. */
    runsPerSleeveXp: 100,
    /** Sleeve XP per batch. */
    sleeveXpPerGrant: 1,
    /** Default action level rule: level 2 at 10 XP, then x10 per level. */
    actionLevels: { firstLevelXp: 10, growthFactor: 10 },
    /** Default sleeve level rule of every action: level 2 at 10 sleeve XP, then x10 per level. */
    sleeveLevels: { firstLevelXp: 10, growthFactor: 10 },
    /** Credits at the start and after a re-sleeve. */
    startingCredits: 0,
  },

  speed: {
    /** Speed multiplier of an action level: linear 0.05 per level means +5% of the base speed per level above 1. */
    actionLevel: { kind: 'linear', perLevel: 0.05 },
    /** Speed multiplier of the sleeve level. */
    sleeveLevel: { kind: 'linear', perLevel: 0.05 },
  },

  /** Broad levers: 1 = unchanged. E.g. speedMultiplier 2 makes everything twice as fast. */
  global: {
    speedMultiplier: 1,
    rewardMultiplier: 1,
    xpMultiplier: 1,
    costMultiplier: 1,
  },

  sleeve: {
    /** Access level of a new sleeve. Actions with a higher requiredAccessLevel stay locked. */
    baseAccessLevel: 1,
    /** Interface speed of a new sleeve (0.1): multiplies the speed of every action. */
    baseInterfaceSpeed: 0.1,
    /** Heat of a new sleeve. Each point is 1% tax on all credits earned. */
    baseHeat: 0,
    /** Time of one heat cooldown cycle (ms): 60 s. */
    heatCooldownMs: 60_000,
    /** Heat removed per completed cooldown cycle. */
    heatCooldownAmount: 1,
    /** Circumvention of a new sleeve. */
    baseCircumvention: 1,
    /** Share of the heat effect removed per order of magnitude of Circumvention: 0.5%, so 100% at 1e200. */
    circumventionReductionPerOrder: 0.005,
    /** Each point of Infamy makes heat cool 10% slower. */
    infamyHeatSlowdown: 0.1,
    /** Infamy falls by 1 every 10 minutes. */
    infamyDecayPeriodMs: 600_000,
  },

  network: {
    /** Credits each network node produces per second. */
    creditsPerNodePerSecond: 0.05,
  },

  engine: {
    /** Safety cap on run batches per action per tick (a batch is the stretch of runs between two level changes). */
    maxBatchesPerTick: 1_000,
    /** Longest stretch simulated in one go (ms); longer ticks are sliced. */
    maxSliceMs: 1_000,
    /** Most slices per tick; bounds the cost of very long ticks. */
    maxSlicesPerTick: 64,
  },

  runtime: {
    /** Interval between game steps (ms). */
    stepMs: 50,
    /** Largest real-time gap simulated in one step (ms): 10 minutes. */
    maxDeltaMs: 10 * 60 * 1000,
    /** Interval between autosaves (ms). */
    autosaveMs: 10_000,
    /** Time multiplier of the fast-forward test toggle. */
    fastForwardFactor: 10,
  },
};
