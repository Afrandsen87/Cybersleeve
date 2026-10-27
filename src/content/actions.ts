/**
 * @module content
 *
 * The actions of the game, in the order of the action grid.
 */
import type { GameConfig } from '../core';
import { num } from '../numbers';
import { PRACTICE_HACKING, GROW_NETWORK, PUSH_MALWARE, KILL_SERVERS, LEGEND } from './ids';

/** The actions of the game, in the order of the action grid. */
export const actionsConfig: GameConfig['actions'] = [
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
    /** Overclock: 50% faster, at the price of 2 heat per minute of running. */
    overclock: { speedBonus: 0.5, heatPerMinute: 2 },
  },
  {
    id: PRACTICE_HACKING,
    name: 'Practice Hacking',
    /** Time per run at speed x1: 5 s, so a run takes 50 s at the starting interface speed of 0.1. */
    baseDurationMs: 5_000,
    /** Added to Hacking Proficiency per completed run (no credits). Proficiency raises the hacking multiplier on interface speed. */
    reward: num(0.01),
    rewardKind: 'hackingProficiency',
    /** Locked until the sleeve has access level 2 (the first Access upgrade). */
    requiredAccessLevel: 2,
    /** Action XP per completed run. */
    xpPerRun: num(1),
    /** Overclock: pays 200% more (x3) per run, but each completed run costs 5 nodes. */
    overclock: { rewardBonus: 2, completionEffects: [{ kind: 'removeNodes', amount: 5 }] },
    // Optional per-action overrides (fall back to the global rules below):
    //   levels: { firstLevelXp: 10, growthFactor: 10 },
    //   speedScaling: { kind: 'linear', perLevel: 0.05 },
  },
  {
    id: PUSH_MALWARE,
    name: 'Push malware',
    /** Seconds per run at speed x1. */
    baseDurationMs: 6_000,
    /** Added to the BASE credits per second of every node per completed run (no credits of its own): 0.0001, i.e. 1% of the starting base of 0.01. */
    reward: num(1e-4),
    rewardKind: 'nodePayout',
    /** Heat added by a run that makes heat. */
    heatPerRun: 1,
    /** Chance that a completed run makes heat: 10%. */
    heatChance: 0.1,
    /** Access level the sleeve needs to perform this action. */
    requiredAccessLevel: 3,
    /** Action XP per completed run. */
    xpPerRun: num(1),
    /** Overclock: each run also pays the nodes of a Grow network run, but makes three times as much heat, and twice as often (20%). */
    overclock: { alsoPays: GROW_NETWORK, heatPerRunFactor: 3, heatChanceFactor: 2 },
  },
  {
    id: KILL_SERVERS,
    name: 'Kill servers',
    /** Seconds per run at speed x1: 2 minutes. */
    baseDurationMs: 120_000,
    /** ICE Rating gained per completed run (no credits). */
    reward: num(1),
    rewardKind: 'iceRating',
    /** Paid at the start of every run: 1% of the current nodes, rounded down to whole nodes (so it needs at least 100 nodes). */
    startCost: { currency: 'networkNodes', fractionOfBalance: 0.01 },
    /** Access level the sleeve needs to perform this action. */
    requiredAccessLevel: 4,
    /** Action XP per completed run. */
    xpPerRun: num(1),
    /**
     * Overclock: pays double the ICE Rating per run, but heat is held in place while it runs. The Kill chain buyable adds a chain
     * to it (see KILL_CHAIN).
     */
    overclock: { rewardBonus: 1, stopsHeatCooling: true },
  },
  {
    id: LEGEND,
    name: 'Build Legend',
    /** Seconds per run at speed x1: 5 minutes. */
    baseDurationMs: 300_000,
    /** Legend gained per completed run (no credits). */
    reward: num(1),
    rewardKind: 'legend',
    /** Access level the sleeve needs to perform this action. */
    requiredAccessLevel: 5,
    /** Heat added for every second the action runs. */
    heatPerSecond: 5,
    /** Each completed run removes a quarter of the network. */
    completionEffects: [{ kind: 'removeNodesFraction', fraction: 0.25 }],
    /** Action XP per completed run. */
    xpPerRun: num(1),
  },
];
