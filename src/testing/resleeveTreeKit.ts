/**
 * Test setup for the re-sleeve tests that play a small tree: one Sleeve Euphoria-like root, a synthetic-sleeves skill and a placeholder under it,
 * and two plain purchases, on top of the unit-test config.
 *
 * Purpose: the re-sleeve tests (points, what is kept, runs, synthetic sleeves, Sleeve Euphoria, saving) used to share one 18 KB file; they now
 * share this setup. Helpers: `newGame`, `withNodes` (give the sleeve network nodes), `atLevel` (give action `a` a level), `mutable` (edit state fields).
 * Called by: `core/resleeve/*.test.ts`. Calls: `createGame`, `createConfig`, `flat`.
 */
import { expect } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, type BuyableDefinition, type GameConfig } from '../core';
import { num } from '../numbers';
import { flat } from './flatState';
import { testConfig } from './testConfig';

/** A re-sleeve skill: one point, no action. */
export const resleeveSkill = (id: string, effect: BuyableDefinition['effect'], requires?: string[]): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  currency: 'resleevePoints',
  cost: num(1),
  effect,
  ...(requires ? { parents: requires } : {}),
});

export const treeBuyables: BuyableDefinition[] = [
  resleeveSkill('eu', { kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 0.999 }),
  resleeveSkill('syn', { kind: 'synthSleeves' }, ['eu']),
  resleeveSkill('inc', { kind: 'placeholder' }, ['eu']),
  { id: 'flat', name: 'Flat', description: '', cost: num(1), effect: { kind: 'actionXpReduction', amount: 0.2 } },
  { id: 'cheap', name: 'Cheap', description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 1 } },
];

export const config: GameConfig = createConfig(testConfig, { buyables: [...testConfig.buyables, ...treeBuyables] });

export type Loose = {
  credits: unknown;
  network: unknown;
  heat: number;
  actions: Record<string, { xp: unknown; sleeveXp: unknown }>;
};
export const mutable = (g: { getState(): unknown }): Loose => flat<Loose>(g);

export const newGame = (c: GameConfig = config): ReturnType<typeof createGame> => createGame({ config: c });

/** Gives the sleeve `nodes` network nodes (credits per second = nodes x 0.05 with no heat). */
export const withNodes = (g: ReturnType<typeof createGame>, nodes: number): void => {
  mutable(g).network = num(nodes);
};
/** Gives action `a` enough XP to be at least the level `level` (thresholds in the test config: 10, 110, 1110, 11110 ...). */
export const XP_FOR_LEVEL = [0, 10, 110, 1110, 11_110];
export const atLevel = (g: ReturnType<typeof createGame>, level: number): void => {
  mutable(g).actions['a']!.xp = num(XP_FOR_LEVEL[level]!);
  expect(g.actionLevel('a')).toBe(level);
};
