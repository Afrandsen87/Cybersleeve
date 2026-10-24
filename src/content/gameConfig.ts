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
export const EARN_CREDITS = 'earn-credits';
/** Id of the network-building action. */
export const GROW_NETWORK = 'grow-network';
/** Id of the malware action (needs access level 2). */
export const PUSH_MALWARE = 'push-malware';
/** Id of the global interface-speed buyable. */
export const INTERFACE_BOOST = 'interface-boost';
/** Id of the global access-level buyable. */
export const ACCESS_UPGRADE = 'access-upgrade';
/** Id of the auto-run buyable. */
export const AUTO_RUN = 'auto-run';
/** Id of the dual-processors buyable. */
export const DUAL_PROCESSORS = 'dual-processors';
/** Id of the duplicate-processors buyable. */
export const DUPLICATE_PROCESSORS = 'duplicate-processors';

/** The game's configuration (content and tuning). */
export const gameConfig: GameConfig = {
  actions: [
    {
      id: EARN_CREDITS,
      name: 'Earn credits',
      /** Seconds per run at speed x1. */
      baseDurationMs: 1_000,
      /** Credits per completed run. */
      reward: num(0.5),
      /** Action XP per completed run. */
      xpPerRun: num(1),
      // Optional per-action overrides (fall back to the global rules below):
      //   levels: { firstLevelXp: 10, growthFactor: 10 },
      //   speedScaling: { kind: 'linear', perLevel: 1 },
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
      /** Credits per network node per completed run. */
      reward: num(1),
      rewardPerNetworkNode: true,
      /** Heat added per completed run. */
      heatPerRun: 1,
      /** Access level the sleeve needs to perform this action. */
      requiredAccessLevel: 2,
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
      actionId: EARN_CREDITS,
      cost: num(10_000),
      effect: { kind: 'autoRun' },
    },
    {
      id: DUAL_PROCESSORS,
      name: 'Dual processors',
      symbol: '×2',
      description: 'Runs the action twice at once: doubles credits, XP and counted runs.',
      actionId: EARN_CREDITS,
      cost: num(15),
      effect: { kind: 'outputMultiplier', factor: 2 },
    },
    {
      id: DUPLICATE_PROCESSORS,
      name: 'Duplicate processors',
      symbol: '+×2',
      description: 'Doubles the output again. Can be bought without limit; each copy costs 10x more.',
      cost: num(150), // 10x the price of Dual processors
      costGrowth: 10, // price multiplier per copy already owned
      maxPurchases: Infinity,
      actionId: EARN_CREDITS,
      requires: [DUAL_PROCESSORS],
      effect: { kind: 'outputMultiplier', factor: 2 },
    },
    // Global (sleeve) buyables: no actionId; they change the sleeve's stats. Prices are placeholders.
    {
      id: INTERFACE_BOOST,
      name: 'Interface boost',
      symbol: 'IF',
      description: 'Raises interface speed by 5 percentage points, e.g. 10% to 15% (it multiplies the speed of every action).',
      cost: num(100),
      effect: { kind: 'interfaceSpeed', amount: 0.05 },
    },
    {
      id: ACCESS_UPGRADE,
      name: 'Access upgrade',
      symbol: 'AX',
      description: 'Raises access level to 2, which unlocks Push malware.',
      cost: num(1000),
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
    /** Speed multiplier of an action level: linear 1 per level means "multiplier = level". */
    actionLevel: { kind: 'linear', perLevel: 1 },
    /** Speed multiplier of the sleeve level. */
    sleeveLevel: { kind: 'linear', perLevel: 1 },
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
    /** Interface speed of a new sleeve (0.1 = 10%): multiplies the speed of every action. */
    baseInterfaceSpeed: 0.1,
    /** Heat of a new sleeve. Each point is 1% tax on all credits earned. */
    baseHeat: 0,
    /** Time of one heat cooldown cycle (ms): 60 s. */
    heatCooldownMs: 60_000,
    /** Heat removed per completed cooldown cycle. */
    heatCooldownAmount: 1,
  },

  network: {
    /** Credits each network node produces per second. */
    creditsPerNodePerSecond: 0.05,
  },

  engine: {
    /** Safety cap on run batches per action per tick (a batch is the stretch of runs between two level changes). */
    maxBatchesPerTick: 1_000,
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
