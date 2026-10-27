/**
 * @module core
 *
 * Shared setup of the tests of the newer re-sleeve skills: a small configuration with the skills under test, and helpers to earn
 * re-sleeve points and to read or write the loosely typed state. Not part of the game; imported only by `*.test.ts` files.
 */
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { type BuyableDefinition, type GameConfig, createConfig } from './index';

/** A re-sleeve skill that costs `cost` points (default 1), belongs to no action and has the given tree parents. */
export const resleeveSkill = (id: string, effect: BuyableDefinition['effect'], cost = 1, parents?: string[]): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  currency: 'resleevePoints',
  cost: num(cost),
  effect,
  ...(parents ? { parents } : {}),
});

/** A plain purchase paid in credits, bought up to `maxPurchases` times (default 1). */
export const plainBuyable = (
  id: string,
  effect: BuyableDefinition['effect'],
  extra: Partial<BuyableDefinition> = {},
): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  cost: num(1),
  effect,
  ...extra,
});

/** The unit-test configuration with `buyables` added (and any other overrides applied). */
export const withBuyables = (buyables: BuyableDefinition[], overrides: Parameters<typeof createConfig>[1] = {}): GameConfig =>
  createConfig(testConfig, { buyables: [...testConfig.buyables, ...buyables], ...overrides });

/** The state with the fields tests write to opened up. */
export type Loose = {
  credits: unknown;
  network: unknown;
  hackingProficiency: unknown;
  iceRating: unknown;
  actions: Record<string, { xp: unknown; sleeveXp: unknown }>;
  runs: { creditsPerSecond: unknown; actionLevelsTotal: number }[];
};

/** The state of a game, writable (tests only). */
export const loose = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

/** A new game on `config`. */
export const newGame = (config: GameConfig): ReturnType<typeof createGame> => createGame({ config });

/** Gives the game plenty of credits and tries to buy one copy of `id`; returns what the shop said. */
export const tryBuy = (g: ReturnType<typeof createGame>, id: string): string => {
  setCredits(g, num(1e12));
  return g.buy(id);
};

/** Re-sleeves `times` times in a row (the unit-test configuration has no re-sleeve gate), so each gives one re-sleeve point. */
export const resleeveTimes = (g: ReturnType<typeof createGame>, times: number): void => {
  for (let i = 0; i < times; i++) g.resleeve();
};
