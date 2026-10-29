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

import type { GameConfig } from '../core';
import { actionsConfig } from './actions';
import { buyablesConfig } from './buyables';
import { corporationConfig } from './corporation';
import { itemsConfig } from './items';

export * from './ids';

/** The game's configuration (content and tuning). */
export const gameConfig: GameConfig = {
  items: itemsConfig,

  actions: actionsConfig,

  buyables: buyablesConfig,

  /** The actions of the Corporation tab. */
  corporation: corporationConfig,

  /** What a critical success does unless an action says otherwise: its XP is doubled and its reward tripled. */
  criticalSuccess: { xpMultiplier: 2, rewardMultiplier: 3 },

  /** A focused action runs 25% faster; one action can be focused at the start, Focus upgrades add slots. */
  focus: { speedBonus: 0.25, baseSlots: 1 },

  /** Each re-sleeve gives one re-sleeve point; the Stats tab lists the last 10 sleeve-runs. */
  // The Nth re-sleeve needs base + perResleeve x (N - 1) sleeve levels in total (all actions together). Placeholder values; the first stays low so it is not delayed.
  resleeve: { pointsPerResleeve: 1, runsShown: 10, lockoutMs: 5_000, sleeveLevelsNeeded: { base: 1, perResleeve: 1 } },

  /** A purchase shows once its price is within 3 orders of magnitude of the most of its currency held this life. */
  reveal: { buyableOrders: 3 },

  /** Auto Burn starts out using Burn leads once heat is above 20 points (placeholder; the player changes it). */
  automation: { autoBurnCeiling: 20 },

  progression: {
    /** Completed runs of one action per batch of that action's sleeve XP. */
    runsPerSleeveXp: 100,
    /** Sleeve XP per batch. */
    sleeveXpPerGrant: 1,
    /** Default action level rule (levels start at 0): level 1 at 10 XP, then x2 per level. */
    actionLevels: { firstLevelXp: 10, growthFactor: 2 },
    /** Default sleeve level rule of every action (levels start at 0): level 1 at 10 sleeve XP, then x2 per level. */
    sleeveLevels: { firstLevelXp: 10, growthFactor: 2 },
    /** Credits at the start and after a re-sleeve. */
    startingCredits: 0,
    /** Sleeve-XP reduction buyables can never cut a requirement by more than 99% in total. */
    maxSleeveXpReduction: 0.99,
  },

  speed: {
    /** Speed multiplier of an action level: linear 0.05 per level means +5% of the base speed per level (level 0 is worth exactly 1). */
    actionLevel: { kind: 'linear', perLevel: 0.05 },
    /** Speed multiplier of the sleeve level. */
    sleeveLevel: { kind: 'linear', perLevel: 0.05 },
  },

  /** Broad levers: 1 = unchanged. E.g. speedMultiplier 2 makes everything twice as fast. */
  global: {
    speedMultiplier: 1,
    creditMultiplier: 1,
    xpMultiplier: 1,
    costMultiplier: 1,
  },

  sleeve: {
    /** Access level of a new sleeve. Actions with a higher requiredAccessLevel stay locked. */
    baseAccessLevel: 1,
    /** Interface speed of a new sleeve (0.1): multiplies the speed of every action. */
    baseInterfaceSpeed: 0.1,
    /** Interface speed earned by actions is applied as scale * ((1 + earned)^exponent - 1) / exponent: the first runs count in full. */
    earnedSpeedScale: 1,
    /** 0.25: strongly diminishing returns, no ceiling (1 = straight line, 0 = logarithm). */
    earnedSpeedExponent: 0.25,
    /** From 1 Hacking Proficiency on, the curve changes shape... */
    earnedSpeedKnee: 1,
    /** ...to 0.1: past the knee each further point is worth even less (it joins the first piece smoothly, so nothing jumps). */
    earnedSpeedExponentBeyond: 0.1,
    /** Heat of a new sleeve. */
    baseHeat: 0,
    /** Each point of heat takes 1% of the credits network nodes produce. */
    heatTaxPerPoint: 0.01,
    /** Time of one heat cooldown cycle (ms): 60 s. */
    heatCooldownMs: 60_000,
    /** Heat removed per completed cooldown cycle. */
    heatCooldownAmount: 1,
    /** ICE Rating of a new sleeve. */
    baseIceRating: 1,
    /** Share of the heat effect removed per order of magnitude of ICE Rating: 0.5%, so 100% at 1e200. */
    iceRatingReductionPerOrder: 0.005,
    /** Each point of Legend makes heat cool 10% faster. */
    legendHeatSpeedup: 0.1,
    /** Legend falls by 1 every 10 minutes. */
    legendDecayPeriodMs: 600_000,
  },

  network: {
    /** Credits each network node produces per second. */
    creditsPerNodePerSecond: 0.01,
  },

  engine: {
    /** Safety cap on run batches per action per tick (a batch is the stretch of runs between two level changes). */
    maxBatchesPerTick: 1_000,
    /** Longest stretch simulated in one go (ms); longer ticks are sliced. */
    maxSliceMs: 1_000,
    /** Most slices per tick; bounds the cost of very long ticks. */
    maxSlicesPerTick: 64,
    /** A run never takes less than a thousandth of a millisecond, whatever the speed. */
    minRunDurationMs: 0.001,
  },

  runtime: {
    /** Interval between game steps (ms). */
    stepMs: 50,
    /** Shortest interval between screen refreshes (ms). */
    renderMs: 100,
    /** Largest real-time gap simulated in one step (ms): 10 minutes. */
    maxDeltaMs: 10 * 60 * 1000,
    /** Interval between autosaves (ms). */
    autosaveMs: 10_000,
    /** Time multiplier of the fast-forward test toggle. */
    fastForwardFactor: 10,
  },
};
