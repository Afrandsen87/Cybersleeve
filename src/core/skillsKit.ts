import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { createConfig, type BuyableDefinition, type GameConfig } from './index';

/** A skill: one point, no action. */
export const skill = (id: string, effect: BuyableDefinition['effect'], cost = 1): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  currency: 'skillPoints',
  cost: num(cost),
  effect,
});

/** An action that does nothing: its level 1 is how a test earns the first skill point without touching the other actions. */
export const inert = { id: 'z', name: 'Z', baseDurationMs: 1_000, reward: num(0), xpPerRun: num(1) };

/** The test configuration with the given skills added (and any other overrides applied). */
export const withSkills = (skills: BuyableDefinition[], overrides: Parameters<typeof createConfig>[1] = {}): GameConfig =>
  createConfig(testConfig, { actions: [...testConfig.actions, inert], buyables: [...testConfig.buyables, ...skills], ...overrides });

/** The state with its read-only fields opened up, for tests that set them directly. */
export type Loose = {
  credits: unknown;
  network: unknown;
  heat: number;
  moles: number;
  hackingProficiency: unknown;
  inventory: unknown;
  actions: Record<string, { xp: unknown; sleeveXp: unknown }>;
};

/** The state of a game, writable (tests only). */
export const mutable = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

/** Earns the first skill point: the inert action reaches level 1. */
export const grantPoint = (g: { getState(): unknown }): void => {
  mutable(g).actions['z']!.xp = num(10);
};

/** A game with the first skill point already earned (the inert action `z` must be in the config). */
export const skillGame = (options: Parameters<typeof createGame>[0]): ReturnType<typeof createGame> => {
  const g = createGame(options);
  grantPoint(g);
  return g;
};
