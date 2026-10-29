/**
 * Behaviour of the `runsPerSleeveXpReduction` buyable: every copy lowers how many completed runs a batch of sleeve XP takes,
 * down to a floor.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { setCredits, testConfig } from '../../testing/testConfig';
import { type BuyableDefinition, createConfig, validateConfig } from '..';

const conditioning = (minRuns = 90): BuyableDefinition => ({
  id: 'cond',
  name: 'Conditioning',
  description: '',
  cost: num(1),
  costGrowth: 1,
  maxPurchases: Infinity,
  effect: { kind: 'runsPerSleeveXpReduction', perCopy: 1, minRuns },
});
const gameWith = (minRuns?: number) => createGame({ config: createConfig(testConfig, { buyables: [conditioning(minRuns)] }) });
const buyCopies = (g: ReturnType<typeof gameWith>, n: number) => {
  for (let i = 0; i < n; i++) {
    setCredits(g, num(10));
    g.buy('cond');
  }
};

describe('fewer runs per batch of sleeve XP', () => {
  it('is the base amount (100) until bought', () => {
    expect(gameWith().runsPerSleeveXp()).toBe(100);
  });

  it('each copy takes 1 run off: 3 copies need 97 runs', () => {
    const g = gameWith();
    buyCopies(g, 3);
    expect(g.runsPerSleeveXp()).toBe(97);
  });

  it('never goes below the floor, however many copies are owned', () => {
    const g = gameWith(95);
    buyCopies(g, 20);
    expect(g.runsPerSleeveXp()).toBe(95);
  });

  it('a batch of sleeve XP is granted after the reduced number of runs, not the base number', () => {
    const g = gameWith();
    buyCopies(g, 10); // 90 runs per batch
    const action = g.getState().actions['a']!;
    (action as { runsTowardSleeveXp: number }).runsTowardSleeveXp = 89;
    g.startAction('a');
    g.tick(10_000); // one run of 'a' completes: 90 runs counted
    expect(action.sleeveXp.toNumber()).toBe(1);
    expect(action.runsTowardSleeveXp).toBe(0);
  });

  it('a counter already above the new requirement pays out on the next run and keeps the remainder valid', () => {
    const g = gameWith();
    const action = g.getState().actions['a']!;
    (action as { runsTowardSleeveXp: number }).runsTowardSleeveXp = 95;
    buyCopies(g, 10); // 90 runs per batch: the counter is now past it
    g.startAction('a');
    g.tick(10_000);
    expect(action.sleeveXp.toNumber()).toBe(1);
    expect(action.runsTowardSleeveXp).toBe(6); // 96 - 90
  });
});

describe('runsPerSleeveXpReduction validation', () => {
  const invalid = (perCopy: number, minRuns: number) =>
    validateConfig(
      createConfig(testConfig, {
        buyables: [{ ...conditioning(), effect: { kind: 'runsPerSleeveXpReduction', perCopy, minRuns } }],
      }),
    );

  it('accepts whole numbers >= 1', () => {
    expect(invalid(1, 10)).toEqual([]);
  });

  it('rejects a zero or fractional reduction and a floor below 1', () => {
    expect(invalid(0, 10).length).toBeGreaterThan(0);
    expect(invalid(1.5, 10).length).toBeGreaterThan(0);
    expect(invalid(1, 0).length).toBeGreaterThan(0);
  });
});
