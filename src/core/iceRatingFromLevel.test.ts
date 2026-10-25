/**
 * Behaviour of the `iceRatingFromActionLevel` buyable: base ICE Rating grows with an action's level, and the ICE Rating
 * multipliers apply to the sum whatever order they were bought in.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { type BuyableDefinition, createConfig, validateConfig } from './index';

const hardened: BuyableDefinition = {
  id: 'hard',
  name: 'Hard',
  description: '',
  cost: num(1),
  effect: { kind: 'iceRatingFromActionLevel', sourceActionId: 'a', perLevel: 10 },
};
const boost: BuyableDefinition = {
  id: 'boost',
  name: 'Boost',
  description: '',
  cost: num(1),
  effect: { kind: 'iceRatingMultiplier', factor: 2 },
};
const gameWith = (buyables: BuyableDefinition[]) => createGame({ config: createConfig(testConfig, { buyables }) });
const setActionXp = (g: ReturnType<typeof gameWith>, xp: number) => {
  (g.getState().actions['a'] as { xp: unknown }).xp = num(xp);
};
const buy = (g: ReturnType<typeof gameWith>, id: string) => {
  setCredits(g, num(10));
  expect(g.buy(id)).toBe('purchased');
};

describe('base ICE Rating from an action level', () => {
  it('changes nothing until bought', () => {
    const g = gameWith([hardened]);
    setActionXp(g, 110); // level 2
    expect(g.sleeveStats().iceRating.toNumber()).toBe(1);
  });

  it('adds perLevel per action level: level 2 at 10 per level makes ICE Rating 1 + 20 = 21', () => {
    const g = gameWith([hardened]);
    buy(g, 'hard');
    setActionXp(g, 110);
    expect(g.actionLevel('a')).toBe(2);
    expect(g.sleeveStats().iceRating.toNumber()).toBe(21);
  });

  it('follows the level as it rises', () => {
    const g = gameWith([hardened]);
    buy(g, 'hard');
    setActionXp(g, 10);
    expect(g.sleeveStats().iceRating.toNumber()).toBe(11);
    setActionXp(g, 110);
    expect(g.sleeveStats().iceRating.toNumber()).toBe(21);
  });

  it('is multiplied by the ICE Rating boost, in either buying order: (1 + 20) x 2 = 42', () => {
    for (const order of [
      ['hard', 'boost'],
      ['boost', 'hard'],
    ]) {
      const g = gameWith([hardened, boost]);
      for (const id of order) buy(g, id);
      setActionXp(g, 110);
      expect(g.sleeveStats().iceRating.toNumber(), order.join(',')).toBe(42);
    }
  });

  it('rejects a source action that does not exist and a non-positive amount', () => {
    const bad = (effect: BuyableDefinition['effect']) => validateConfig(createConfig(testConfig, { buyables: [{ ...hardened, effect }] }));
    expect(bad({ kind: 'iceRatingFromActionLevel', sourceActionId: 'a', perLevel: 10 })).toEqual([]);
    expect(bad({ kind: 'iceRatingFromActionLevel', sourceActionId: 'nope', perLevel: 10 }).length).toBeGreaterThan(0);
    expect(bad({ kind: 'iceRatingFromActionLevel', sourceActionId: 'a', perLevel: 0 }).length).toBeGreaterThan(0);
  });
});
