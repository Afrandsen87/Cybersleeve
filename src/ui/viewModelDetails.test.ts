import { game } from '../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { seededRandom } from '../testing/random';
import { num } from '../numbers';
import { networkAction, setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel, formatSeconds, statRow } from './viewModel';

describe('view model', () => {
  it("lists each action's own buyables inside the action and names the reward unit", () => {
    const g = game({ actions: [testConfig.actions[0]!, networkAction] });
    const vm = buildViewModel(g);
    const earn = vm.actions.find((a) => a.id === 'a')!;
    const net = vm.actions.find((a) => a.id === 'net')!;
    expect(earn.buyables.map((b) => b.id)).toEqual(['auto', 'dual', 'dup']);
    expect(net.buyables).toEqual([]);
    expect(earn.rewardUnit).toBe('credits');
    expect(net.rewardUnit).toBe('nodes');
    expect(statRow(vm.network.stats, 'nodes').text).toBe('0');
    expect(statRow(vm.network.stats, 'income').text).toBe('+0');
  });

  it('uses the configured symbol of a buyable', () => {
    const buyables = [{ ...testConfig.buyables[0]!, symbol: '↻' }];
    expect(buildViewModel(game({ buyables })).actions[0]!.buyables[0]!.symbol).toBe('↻');
  });

  it('shows the network size and its passive income', () => {
    const g = game();
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(40);
    const vm = buildViewModel(g);
    expect(statRow(vm.network.stats, 'nodes').text).toBe('40');
    expect(statRow(vm.network.stats, 'income').text).toBe('+2');
  });

  it("falls back to the name's initials when a buyable has no symbol", () => {
    expect(buildViewModel(game()).actions[0]!.buyables.map((b) => b.symbol)).toEqual(['A', 'D', 'D']);
  });

  it('shows initial values', () => {
    const vm = buildViewModel(game());
    expect(vm.creditsText).toBe('0');
    const a = vm.actions[0]!;
    expect(a.sleeve.level).toBe(0);
    expect(a.sleeve.runsToNextXp).toBe(100);
    expect(a.sleeve.progressPercent).toBe(0);
    expect(a.levelProgressPercent).toBe(0);
    expect(a.level).toBe(0);
    expect(a.durationText).toBe('10s');
    expect(a.rewardText).toBe('0.5');
    expect(a.rewardMultiplierText).toBe('1');
    expect(a.progressPercent).toBe(0);
    expect(vm.actions[0]!.buyables.map((b) => [b.id, b.available, b.affordable])).toEqual([
      ['auto', true, false],
      ['dual', true, false],
      ['dup', false, false],
    ]);
  });

  it('shows progress, affordability and owned state', () => {
    const g = game();
    g.startAction('a');
    g.tick(5_000);
    expect(buildViewModel(g).actions[0]!.progressPercent).toBe(50);
    setCredits(g, num(10));
    expect(buildViewModel(g).actions[0]!.buyables[0]!.affordable).toBe(true);
    g.buy('auto');
    const vm = buildViewModel(g);
    expect(vm.actions[0]!.buyables[0]!.owned).toBe(1);
    expect(vm.actions[0]!.buyables[0]!.maxed).toBe(true);
    expect(vm.actions[0]!.auto).toBe(true);
  });

  it('reveals duplicate processors after dual and shows the rising price and owned count', () => {
    const g = game();
    setCredits(g, num(15 + 150 + 1500));
    g.buy('dual');
    let dup = buildViewModel(g).actions[0]!.buyables.find((b) => b.id === 'dup')!;
    expect(dup.available).toBe(true);
    expect(dup.repeatable).toBe(true);
    expect(dup.costText).toBe('150');
    expect(dup.affordable).toBe(true);
    g.buy('dup');
    dup = buildViewModel(g).actions[0]!.buyables.find((b) => b.id === 'dup')!;
    expect(dup.owned).toBe(1);
    expect(dup.maxed).toBe(false);
    expect(dup.costText).toBe('1.5K');
    expect(buildViewModel(g).actions[0]!.rewardText).toBe('2'); // 0.5 x (2 x 2)
    expect(buildViewModel(g).actions[0]!.rewardMultiplierText).toBe('4');
  });

  it('shows the cost with the global cost lever applied', () => {
    const vm = buildViewModel(game({ global: { costMultiplier: 3 } }));
    expect(vm.actions[0]!.buyables[0]!.costText).toBe('30');
  });

  it('formats durations', () => {
    expect(formatSeconds(10_000)).toBe('10s');
    expect(formatSeconds(3333.33)).toBe('3.33s');
  });
});

describe('view model - what one node pays', () => {
  const withNodes = (overrides = {}) => {
    const g = game(overrides);
    (g.getState() as unknown as { sleeve: { network: ReturnType<typeof num> } }).sleeve.network = num(100);
    return g;
  };
  const payout = (g: ReturnType<typeof game>) => statRow(buildViewModel(g).network.stats, 'payout');

  it('equals the network income divided by the nodes (one source of truth)', () => {
    const g = withNodes({ network: { creditsPerNodePerSecond: 0.2 } });
    const income = Number(statRow(buildViewModel(g).network.stats, 'income').text.replace('+', ''));
    expect(payout(g).text).toBe(`${income / 100}/s`);
  });

  it('is not taxed by heat: the tax is taken from the credits per second instead, and that tip says how much is kept', () => {
    const g = withNodes();
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 20; // 20 points x 1% = 20% tax in the test config
    expect(payout(g).text).toBe('0.05/s');
    expect(payout(g).tip).not.toContain('Heat Tax');
    const income = statRow(buildViewModel(g).network.stats, 'income');
    expect(income.text).toBe('+4'); // 100 nodes x 0.05 x 80%
    expect(income.tip).toContain('Credits per Second = Nodes x Payout per Node x Heat Tax Kept');
    expect(income.tip).toContain('Heat Tax Kept = 80%');
    expect(income.tip).toContain('Before the Heat Tax = 5 credits/s');
    expect(income.tip).toContain('Credits per Second = 4');
  });

  it('names the credit lever in the tip only when it is not 1', () => {
    const g = withNodes({ global: { creditMultiplier: 2 } });
    expect(payout(g).text).toBe('0.1/s');
    expect(payout(g).tip).toContain('Credit Lever = 2');
  });

  it('keeps small amounts readable: 0.01 credits per node is not rounded away', () => {
    expect(payout(withNodes({ network: { creditsPerNodePerSecond: 0.01 } })).text).toBe('0.01/s');
  });
});

describe('view model - critical success highlight', () => {
  const crit = {
    id: 'crit',
    name: 'Crit',
    description: '',
    cost: num(1),
    maxPurchases: Infinity,
    effect: { kind: 'criticalChance', chance: 1 },
  } as const;
  const config = createConfig(testConfig, { buyables: [...testConfig.buyables, crit], network: { creditsPerNodePerSecond: 0 } });
  const textOf = (g: ReturnType<typeof createGame>) => buildViewModel(g).actions[0]!.critText;

  it('is off without a critical success, a mark for one in the last second, and an average per second for several', () => {
    const g = createGame({ config, random: seededRandom(1) });
    setCredits(g, num(100));
    g.buy('crit');
    g.buy('auto');
    expect(textOf(g)).toBeNull();
    g.startAction('a');
    g.tick(10_000 + 1);
    expect(textOf(g)).toBe('CRITICAL!');
    g.tick(10_000 * 500); // a long tick completes many runs in the last slices: several critical successes inside one second
    expect(textOf(g)).toMatch(/^\d+ crits\/s$/);
  });
});
