/**
 * @module testing
 *
 * A fixed configuration for unit tests, independent of the real tuning in `content/gameConfig.ts`
 * so that retuning the game never breaks the unit tests. Not part of the shipped game.
 */
import { num } from '../numbers';
import type { GameConfig } from '../core';

/** Test configuration mirroring milestone 1 (one action, auto-run, dual and duplicate processors). */
export const testConfig: GameConfig = {
  actions: [{ id: 'a', name: 'A', baseDurationMs: 10_000, reward: num(0.5), xpPerRun: num(1) }],
  buyables: [
    { id: 'auto', name: 'Auto', description: '', actionId: 'a', cost: num(10), effect: { kind: 'autoRun' } },
    { id: 'dual', name: 'Dual', description: '', actionId: 'a', cost: num(15), effect: { kind: 'outputMultiplier', factor: 2 } },
    {
      id: 'dup',
      name: 'Dup',
      description: '',
      actionId: 'a',
      cost: num(150),
      costGrowth: 10,
      maxPurchases: Infinity,
      requires: ['dual'],
      effect: { kind: 'outputMultiplier', factor: 2 },
    },
    { id: 'speed', name: 'Speed', description: '', cost: num(100), effect: { kind: 'interfaceSpeed', amount: 0.05 } },
    { id: 'access', name: 'Access', description: '', cost: num(1000), effect: { kind: 'accessLevel', level: 2 } },
  ],
  progression: {
    runsPerSleeveXp: 100,
    sleeveXpPerGrant: 1,
    actionLevels: { firstLevelXp: 10, growthFactor: 10 },
    sleeveLevels: { firstLevelXp: 10, growthFactor: 10 },
    startingCredits: 0,
  },
  speed: {
    actionLevel: { kind: 'linear', perLevel: 1 },
    sleeveLevel: { kind: 'linear', perLevel: 1 },
  },
  global: { speedMultiplier: 1, rewardMultiplier: 1, xpMultiplier: 1, costMultiplier: 1 },
  network: { creditsPerNodePerSecond: 0.05 },
  sleeve: {
    baseAccessLevel: 1,
    baseInterfaceSpeed: 1,
    baseHeat: 0,
    heatCooldownMs: 60_000,
    heatCooldownAmount: 1,
    baseCircumvention: 1,
    circumventionReductionPerOrder: 0.005,
    infamyHeatSlowdown: 0.1,
    infamyDecayPeriodMs: 600_000,
  },
  engine: { maxBatchesPerTick: 1_000, maxSliceMs: 1_000, maxSlicesPerTick: 64 },
  runtime: { stepMs: 50, maxDeltaMs: 600_000, autosaveMs: 10_000, fastForwardFactor: 10 },
};

/** A second test action that pays network nodes instead of credits (20 s runs, 1 node per run). */
export const networkAction: GameConfig['actions'][number] = {
  id: 'net',
  name: 'Net',
  baseDurationMs: 20_000,
  reward: num(1),
  rewardKind: 'networkNodes',
  xpPerRun: num(1),
};

/** A test action that costs 50 nodes per run, pays +1 Circumvention, needs 1000 nodes to unlock and stays unlocked (1 s runs). */
export const killAction: GameConfig['actions'][number] = {
  id: 'kill',
  name: 'Kill',
  baseDurationMs: 1_000,
  reward: num(1),
  rewardKind: 'circumvention',
  startCost: { currency: 'networkNodes', amount: num(50) },
  unlock: { kind: 'nodes', amount: 1000 },
  xpPerRun: num(1),
};

/** A test action that costs 1% of the current nodes (rounded down, so at least 100 nodes) per run and pays +1 Circumvention (1 s runs). */
export const percentKillAction: GameConfig['actions'][number] = {
  id: 'pkill',
  name: 'PKill',
  baseDurationMs: 1_000,
  reward: num(1),
  rewardKind: 'circumvention',
  startCost: { currency: 'networkNodes', fractionOfBalance: 0.01 },
  xpPerRun: num(1),
};

/** A test action that adds 0.001 to the node payout multiplier per run and 1 heat (1 s runs). */
export const payoutAction: GameConfig['actions'][number] = {
  id: 'push',
  name: 'Push',
  baseDurationMs: 1_000,
  reward: num(0.001),
  rewardKind: 'nodePayout',
  heatPerRun: 1,
  xpPerRun: num(1),
};

/** A test action unlocked by owning the `unlock` buyable: +1 Infamy, removes 25% of the nodes and adds 50 heat (1 s runs). */
export const legendAction: GameConfig['actions'][number] = {
  id: 'legend',
  name: 'Legend',
  baseDurationMs: 1_000,
  reward: num(1),
  rewardKind: 'infamy',
  unlock: { kind: 'buyable', buyableId: 'unlock' },
  completionEffects: [
    { kind: 'removeNodesFraction', fraction: 0.25 },
    { kind: 'addHeat', heat: 50 },
  ],
  xpPerRun: num(1),
};

/** A test action that pays interface speed instead of credits (1 s runs, 0.001 per run). */
export const practiceAction: GameConfig['actions'][number] = {
  id: 'practice',
  name: 'Practice',
  baseDurationMs: 1_000,
  reward: num(0.001),
  rewardKind: 'interfaceSpeed',
  xpPerRun: num(1),
};

/** A test action that needs access level 2, pays 1 credit per network node and adds 1 heat per run (6 s runs). */
export const malwareAction: GameConfig['actions'][number] = {
  id: 'mal',
  name: 'Mal',
  baseDurationMs: 6_000,
  reward: num(1),
  rewardPerNetworkNode: true,
  heatPerRun: 1,
  requiredAccessLevel: 2,
  xpPerRun: num(1),
};

/**
 * Sets credits on an engine's state (tests only; the state is otherwise read-only to callers).
 * @param engine anything exposing `getState()`
 * @param credits new credits
 */
export function setCredits(engine: { getState(): unknown }, credits: ReturnType<typeof num>): void {
  (engine.getState() as { credits: unknown }).credits = credits;
}

/**
 * Sets one action's sleeve XP on an engine's state (tests only).
 * @param engine anything exposing `getState()`
 * @param xp new sleeve XP
 * @param actionId the action whose sleeve XP is set (default `'a'`)
 */
export function setSleeveXp(engine: { getState(): unknown }, xp: ReturnType<typeof num>, actionId = 'a'): void {
  (engine.getState() as { actions: Record<string, { sleeveXp: unknown }> }).actions[actionId]!.sleeveXp = xp;
}
