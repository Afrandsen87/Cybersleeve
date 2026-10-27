import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { seededRandom } from '../testing/random';
import { testConfig } from '../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig } from './index';

/** Test content: the corporation is open; one action of 1 second gives 4 XP per run; levels follow the test rule (see below). */
const config = createConfig(testConfig, {
  buyables: [...testConfig.buyables, { id: 'inc', name: 'Inc', description: '', cost: num(1), effect: { kind: 'unlocksCorporation' } }],
  corporation: { actions: [{ id: 'c1', name: 'C1', baseDurationMs: 1000, xpPerRun: 4, effects: [] }] },
});

const open = () => {
  const g = createGame({ config, random: seededRandom(1) });
  (g.getState().purchased as Record<string, number>)['inc'] = 1;
  return g;
};

const run = (g: ReturnType<typeof open>, times: number): void => {
  for (let i = 0; i < times; i++) {
    g.startCorporationAction('c1');
    g.tick(1000);
  }
};

describe('corporation action levels', () => {
  const first = config.progression.actionLevels.firstLevelXp;

  it('start at level 0 with no XP', () => {
    const g = open();
    expect(g.corporationLevel('c1')).toBe(0);
    expect(g.corporationXpIntoLevel('c1').toNumber()).toBeCloseTo(0);
    expect(g.corporationLevelProgress('c1')).toBe(0);
  });

  it('each completed run gives its XP, and enough XP gives a level (the same rule as the character)', () => {
    const g = open();
    run(g, 1);
    expect(g.corporationXpIntoLevel('c1').toNumber()).toBe(4);
    expect(g.corporationXpForLevel('c1').toNumber()).toBe(first);
    expect(g.corporationLevelProgress('c1')).toBeCloseTo(4 / first);
    run(g, Math.ceil(first / 4));
    expect(g.corporationLevel('c1')).toBeGreaterThanOrEqual(1);
  });

  it('a run that has not finished gives nothing', () => {
    const g = open();
    g.startCorporationAction('c1');
    g.tick(500);
    expect(g.corporationXpIntoLevel('c1').toNumber()).toBeCloseTo(0);
  });

  it('does not change the run time and gives no sleeve XP', () => {
    const g = open();
    run(g, 5);
    g.startCorporationAction('c1');
    g.tick(999);
    expect(g.getState().corporation.actions['c1']!.running).toBe(true);
    expect(Object.values(g.getState().actions).every((a) => a.sleeveXp.toNumber() === 0)).toBe(true);
  });

  it('is saved and read back, and a save without XP reads as 0', () => {
    const g = open();
    run(g, 3);
    const back = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(back.corporation.actions['c1']!.xp.toNumber()).toBe(12);
    const raw = JSON.parse(serializeState(g.getState()));
    delete raw.corporation.actions.c1.xp;
    expect(deserializeState(JSON.stringify(raw), config, numberFactory)!.corporation.actions['c1']!.xp.toNumber()).toBe(0);
    raw.corporation.actions.c1.xp = 'garbage';
    expect(deserializeState(JSON.stringify(raw), config, numberFactory)!.corporation.actions['c1']!.xp.toNumber()).toBe(0);
  });

  it('XP per run defaults to 1 and must be > 0', () => {
    const plain = createConfig(config, { corporation: { actions: [{ id: 'c1', name: 'C1', baseDurationMs: 1000, effects: [] }] } });
    const g = createGame({ config: plain });
    (g.getState().purchased as Record<string, number>)['inc'] = 1;
    g.startCorporationAction('c1');
    g.tick(1000);
    expect(g.corporationXpIntoLevel('c1').toNumber()).toBe(1);
    const bad = createConfig(config, {
      corporation: { actions: [{ id: 'c1', name: 'C1', baseDurationMs: 1000, xpPerRun: 0, effects: [] }] },
    });
    expect(validateConfig(bad)).toEqual(expect.arrayContaining([expect.stringContaining('xpPerRun')]));
  });
});
