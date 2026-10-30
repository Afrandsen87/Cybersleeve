/**
 * Sleeve XP starts only once the Sleeve levels unlock is owned: before it, runs earn action XP but neither sleeve XP nor progress towards it.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, type BuyableDefinition } from '..';

const levels: BuyableDefinition = {
  id: 'levels',
  name: 'Sleeve levels',
  description: '',
  cost: num(10),
  effect: { kind: 'unlockSleeveLevels' },
};

const withGate = () => createGame({ config: createConfig(testConfig, { buyables: [...testConfig.buyables, levels] }) });

/** Runs action `a` the given number of times (10 s each at level 0). */
const run = (g: ReturnType<typeof withGate>, times: number): void => {
  for (let i = 0; i < times; i++) {
    g.startAction('a');
    g.tick(10_000);
  }
};

describe('sleeve XP before the Sleeve levels unlock', () => {
  it('does not accrue, nor does the run counter towards it', () => {
    const g = withGate();
    run(g, 100); // 100 runs make 1 sleeve XP once the unlock is owned
    const a = g.getState().sleeve.actions['a']!;
    expect(a.xp.toNumber()).toBeGreaterThan(0);
    expect(a.sleeveXp.toNumber()).toBe(0);
    expect(a.runsTowardSleeveXp).toBe(0);
  });

  it('starts counting from zero once the unlock is bought (the earlier runs are not made up)', () => {
    const g = withGate();
    run(g, 60);
    setCredits(g, num(100));
    expect(g.buy('levels')).toBe('purchased');
    run(g, 100);
    const a = g.getState().sleeve.actions['a']!;
    expect(a.sleeveXp.toNumber()).toBe(1);
    expect(a.runsTowardSleeveXp).toBe(0);
  });

  it('a game without that buyable accrues sleeve XP from the start', () => {
    const g = createGame({ config: testConfig });
    run(g, 100);
    expect(g.getState().sleeve.actions['a']!.sleeveXp.toNumber()).toBe(1);
  });
});
