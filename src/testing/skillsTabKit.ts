/**
 * @module testing
 *
 * Shared setup of the Skills tab tests (`ui/skillsTab.test.ts`, `ui/molesSkills.test.ts`): three skills (an interface speed
 * factor, a heat cooldown factor and Back Channel Deals), an inert action whose level 1 earns the first skill point, and a loose
 * view of the flat state.
 *
 * @remarks
 * Called by: those tests. Calls: `createConfig`, `createGame`, `flat`.
 */
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { flat } from './flatState';
import { testConfig } from './testConfig';

/** A skill paid in one skill point. */
const skill = (id: string, effect: BuyableDefinition['effect'], symbol = id.toUpperCase()): BuyableDefinition => ({
  id,
  name: `Skill ${id}`,
  description: 'Does something.',
  symbol,
  currency: 'skillPoints',
  cost: num(1),
  effect,
});
/** The skills of the tests. */
export const skills = [
  skill('s1', { kind: 'interfaceSpeedMultiplier', factor: 1.05 }),
  skill('s2', { kind: 'heatCooldownSpeed', factor: 1.05 }),
  skill('bc', { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 }),
];
/** An action that does nothing: its level 1 is how a test earns the first skill point without touching the other actions. */
const inert = { id: 'z', name: 'Z', baseDurationMs: 1_000, reward: num(0), xpPerRun: num(1) };
/** The test config plus the inert action and the skills. */
export const config = createConfig(testConfig, { actions: [...testConfig.actions, inert], buyables: [...testConfig.buyables, ...skills] });

/** The flat state fields the tests poke. */
export type Loose = { inventory: unknown; moles: number; heat: number; actions: Record<string, { xp: unknown }> };
/** The flat state of a game as {@link Loose}. */
export const loose = (g: { getState(): unknown }): Loose => flat<Loose>(g);

/** A game in which the first skill point has been earned (the inert action reached level 1). */
export const pointGame = (): ReturnType<typeof createGame> => {
  const g = createGame({ config });
  loose(g).actions['z']!.xp = num(10);
  return g;
};
