// @vitest-environment happy-dom

/**
 * The two lines under an action card's title: gains (what a run pays) and costs (heat, start cost, Overclock costs).
 *
 * Called by: vitest. Calls: `buildViewModel`, `mountTestUi`, the Overclock kit.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { killAction, malwareAction, testConfig } from '../testing/testConfig';
import { mountTestUi } from '../testing/domMountKit';
import { buildViewModel } from './viewModel';
import { config, own } from './modesKit';

describe('action card costs line (view model)', () => {
  it('lists the heat chance and amount of a run, and keeps them out of the gains line', () => {
    const chancy = { ...malwareAction, heatChance: 0.4, requiredAccessLevel: undefined };
    const g = createGame({ config: createConfig(testConfig, { actions: [chancy], buyables: [] }) });
    const card = buildViewModel(g).actions[0]!;
    expect(card.costItems).toEqual(['40% chance of +1 heat']);
    expect(card.costLine).toBe('40% chance of +1 heat');
    expect(card.rewardLine).not.toContain('heat');
  });

  it('lists the start cost', () => {
    const g = createGame({ config: createConfig(testConfig, { actions: [killAction], buyables: [] }) });
    expect(buildViewModel(g).actions[0]!.costItems).toContain('costs 50 nodes');
  });

  it('an action with no costs has an empty costs line', () => {
    const g = createGame({ config: testConfig });
    const card = buildViewModel(g).actions[0]!;
    expect(card.costItems).toEqual([]);
    expect(card.costLine).toBe('');
  });

  it('lists the Overclock costs only while Overclock is on', () => {
    const rule = { rewardBonus: 2, heatPerMinute: 3, completionEffects: [{ kind: 'removeNodes', amount: 5 }] } as const;
    const base = createConfig(config, { actions: config.actions.map((a) => (a.id === 'a' ? { ...a, overclock: rule } : a)) });
    const g = createGame({ config: base });
    own(g, 'oc-a');
    expect(buildViewModel(g).actions[0]!.costItems).toEqual([]);
    g.toggleOverclock('a');
    expect(buildViewModel(g).actions[0]!.costItems).toEqual(['+3 heat/min (Overclock)', '5 nodes per run (Overclock)']);
  });

  it('lists that an Overclock holds heat in place, from the rule, only while it is on', () => {
    const rule = { rewardBonus: 1, stopsHeatCooling: true } as const;
    const base = createConfig(config, { actions: config.actions.map((a) => (a.id === 'a' ? { ...a, overclock: rule } : a)) });
    const g = createGame({ config: base });
    own(g, 'oc-a');
    expect(buildViewModel(g).actions[0]!.costItems).toEqual([]);
    g.toggleOverclock('a');
    expect(buildViewModel(g).actions[0]!.costItems).toEqual(['holds heat in place (Overclock)']);
  });

  it('shows the heat chance the run uses, Overclock factor included', () => {
    const rule = { heatChanceFactor: 2 } as const;
    const chancy = { ...config.actions[0]!, heatPerRun: 1, heatChance: 0.25, overclock: rule };
    const base = createConfig(config, { actions: [chancy, config.actions[1]!] });
    const g = createGame({ config: base });
    own(g, 'oc-a');
    expect(buildViewModel(g).actions[0]!.costLine).toBe('25% chance of +1 heat');
    g.toggleOverclock('a');
    expect(buildViewModel(g).actions[0]!.costLine).toContain('50% chance of +1 heat');
  });
});

describe('action card costs line (screen)', () => {
  it('every card draws both lines, and a cost-free action still has an empty costs line', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const cfg = createConfig(testConfig, { actions: [testConfig.actions[0]!, killAction, { ...malwareAction, reward: num(1) }] });
    mountTestUi(root, createGame({ config: cfg }));
    const cards = [...root.querySelectorAll<HTMLElement>('.action')].filter((c) => c.querySelector('.action-reward') !== null);
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.querySelectorAll('.action-reward > .action-gains')).toHaveLength(1);
      expect(card.querySelectorAll('.action-reward > .action-costs')).toHaveLength(1);
    }
    expect(cards[0]!.querySelector('.action-costs')!.textContent).toBe('');
    expect(cards[1]!.querySelector('.action-costs')!.textContent).toContain('costs 50 nodes');
    expect(cards[2]!.querySelector('.action-costs')!.textContent).toContain('heat');
  });
});
