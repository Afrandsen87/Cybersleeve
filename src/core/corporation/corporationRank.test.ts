import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { setCredits, setSleeveXp, testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig } from '..';

/** Test content: the corporation is open, a rank purchase costs 100 (x10 per copy), and the second action needs rank 2. */
const config = createConfig(testConfig, {
  buyables: [
    ...testConfig.buyables,
    { id: 'levels', name: 'Levels', description: '', cost: num(1), effect: { kind: 'unlockSleeveLevels' } },
    { id: 'inc', name: 'Inc', description: '', cost: num(1), effect: { kind: 'unlocksCorporation' } },
    {
      id: 'rank',
      name: 'Rank',
      description: '',
      cost: num(100),
      costGrowth: 10,
      maxPurchases: Infinity,
      effect: { kind: 'corporateRank', amount: 1 },
    },
  ],
  corporation: {
    actions: [
      { id: 'c1', name: 'C1', baseDurationMs: 1000, effects: [] },
      { id: 'c2', name: 'C2', baseDurationMs: 1000, requiredRank: 2, effects: [] },
    ],
  },
});

const open = () => {
  const g = createGame({ config });
  (g.getState().sleeve.purchased as Record<string, number>)['inc'] = 1;
  return g;
};

describe('corporate rank', () => {
  it('starts at 1 and each copy of a rank purchase adds its amount', () => {
    const g = open();
    expect(g.corporateRank()).toBe(1);
    setCredits(g, num(100_000));
    g.buy('rank');
    g.buy('rank');
    expect(g.corporateRank()).toBe(3);
  });

  it('the base rank comes from the configuration', () => {
    const g = createGame({ config: createConfig(config, { corporation: { baseRank: 4, actions: config.corporation!.actions } }) });
    expect(g.corporateRank()).toBe(4);
  });

  it('an action needs its required rank to be started', () => {
    const g = open();
    expect(g.canStartCorporationAction('c1')).toBe(true);
    expect(g.canStartCorporationAction('c2')).toBe(false);
    expect(g.startCorporationAction('c2')).toBe(false);
    setCredits(g, num(100));
    g.buy('rank');
    expect(g.canStartCorporationAction('c2')).toBe(true);
  });

  it('is kept through re-sleeving, like the corporation', () => {
    const g = open();
    setSleeveXp(g, num(1e6));
    setCredits(g, num(101));
    g.buy('levels');
    g.buy('rank');
    g.tick(10_000); // the lockout after the unlock
    expect(g.resleeve()).toBe(true);
    expect(g.corporateRank()).toBe(2);
  });

  it('rejects a base rank or a required rank that is not a whole number >= 1, and a rank amount of 0', () => {
    const bad = (corporation: NonNullable<typeof config.corporation>) => validateConfig(createConfig(config, { corporation }));
    expect(bad({ baseRank: 0, actions: [] })).toEqual(expect.arrayContaining([expect.stringContaining('baseRank')]));
    expect(bad({ actions: [{ id: 'x', name: 'X', baseDurationMs: 1, requiredRank: 1.5, effects: [] }] })).toEqual(
      expect.arrayContaining([expect.stringContaining('requiredRank')]),
    );
    const zero = createConfig(config, {
      buyables: [...config.buyables, { id: 'z', name: 'Z', description: '', cost: num(1), effect: { kind: 'corporateRank', amount: 0 } }],
    });
    expect(validateConfig(zero)).toEqual(expect.arrayContaining([expect.stringContaining('corporate rank amount')]));
  });
});
