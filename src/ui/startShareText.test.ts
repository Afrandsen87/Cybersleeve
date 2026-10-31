/**
 * The start-cost text of a share-of-balance action shows the live share (after Decommission protocol), not the base one.
 *
 * Called by: vitest. Calls: `createGame`, `buildViewModel`, the test config.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { percentKillAction, setCredits, testConfig } from '../testing/testConfig';
import { createConfig } from '../core';
import { buildViewModel } from './viewModel';

const config = createConfig(testConfig, {
  actions: [testConfig.actions[0]!, percentKillAction],
  buyables: [
    ...testConfig.buyables,
    { id: 'decom', name: 'decom', description: '', actionId: 'pkill', cost: num(1), effect: { kind: 'startCostReduction', perLevel: 0.1 } },
  ],
  progression: { actionLevels: { firstLevelXp: 10, growthFactor: 1e6 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
});

describe('start cost share text', () => {
  it('starts at the base share and changes once the action has levels', () => {
    const g = createGame({ config, random: () => 0.5 });
    setCredits(g, num(1e9));
    g.buy('decom');
    const text = () => buildViewModel(g).actions[1]!.startCostText;
    expect(text()).toMatch(/^1% of nodes/);
    expect(g.startShareOf('pkill')).toBeCloseTo(0.01);
    (g.getState().sleeve.actions['pkill']!.xp as unknown) = num(10);
    expect(g.actionLevel('pkill')).toBe(1);
    expect(g.startShareOf('pkill')).toBeCloseTo(0.009);
    expect(text()).toMatch(/^0\.9% of nodes/);
  });

  it('has no share for an action without a share-of-balance cost', () => {
    const g = createGame({ config, random: () => 0.5 });
    expect(g.startShareOf(testConfig.actions[0]!.id)).toBeNull();
  });
});
