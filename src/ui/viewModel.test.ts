import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import {
  killAction,
  legendAction,
  malwareAction,
  networkAction,
  payoutAction,
  percentKillAction,
  setCredits,
  testConfig,
} from '../testing/testConfig';
import { buildViewModel, formatSeconds, statRow } from './viewModel';

const game = (overrides = {}) => createGame({ config: createConfig(testConfig, overrides) });

describe('view model - unlocks, start costs and toggles', () => {
  const unlock = { id: 'unlock', name: 'Unlock Legend', description: '', cost: num(1), effect: { kind: 'unlock' } } as const;
  const withNew = (buyables = [...testConfig.buyables, unlock]) =>
    game({ actions: [testConfig.actions[0]!, killAction, legendAction], buyables });

  it('names why an action is locked in a few words and shows its start cost', () => {
    const vm = buildViewModel(withNew());
    const [a, kill, legend] = vm.actions;
    expect(a!.lockedReason).toBeNull();
    expect(a!.startCostText).toBeNull();
    expect(kill!.lockedReason).toBe('Needs 1K nodes');
    expect(kill!.startCostText).toBe('50 nodes');
    expect(legend!.lockedReason).toBe('Needs Unlock Legend');
  });

  it('shows no reason once an action is unlocked', () => {
    const g = withNew();
    setCredits(g, num(1));
    g.buy('unlock');
    expect(buildViewModel(g).actions[2]!.lockedReason).toBeNull();
  });

  it('an owned auto-run is a clickable toggle that reports its state in the tip', () => {
    const g = withNew();
    setCredits(g, num(100));
    g.buy('auto');
    let auto = buildViewModel(g).actions[0]!.buyables.find((b) => b.id === 'auto')!;
    expect(auto.toggleable).toBe(true);
    expect(auto.maxed).toBe(true);
    expect(auto.clickable).toBe(true);
    expect(auto.enabled).toBe(true);
    expect(auto.tip).toContain('(on)');
    expect(auto.tip).toContain('Click to switch off');
    g.toggleAutoRun('auto');
    auto = buildViewModel(g).actions[0]!.buyables.find((b) => b.id === 'auto')!;
    expect(auto.enabled).toBe(false);
    expect(auto.clickable).toBe(true);
    expect(auto.tip).toContain('(off)');
    expect(auto.tip).toContain('Click to switch on');
  });

  it('other buyables are not toggles and are clickable only while affordable', () => {
    const g = withNew();
    const dual = buildViewModel(g).actions[0]!.buyables.find((b) => b.id === 'dual')!;
    expect(dual.toggleable).toBe(false);
    expect(dual.clickable).toBe(false);
    setCredits(g, num(100));
    expect(buildViewModel(g).actions[0]!.buyables.find((b) => b.id === 'dual')!.clickable).toBe(true);
  });

  it('shows ICE Rating, Infamy and the heat tax after ICE Rating, each with an explaining tip', () => {
    const g = withNew();
    const state = g.getState() as { heat: number; infamy: number; iceRating: unknown };
    state.heat = 150;
    state.infamy = 2;
    state.iceRating = num('1e100');
    const sleeve = buildViewModel(g).sleeve;
    expect(statRow(sleeve.stats, 'iceRating').text).toBe('1e100');
    expect(statRow(sleeve.stats, 'iceRating').tip).toContain('Heat Reduction = 50%');
    expect(statRow(sleeve.stats, 'heat').text).toBe('150');
    expect(statRow(sleeve.stats, 'heat').tip).toContain('Heat Reduction = 50% (from ICE Rating)');
    expect(statRow(sleeve.stats, 'heat').tip).toContain('Heat Tax = 75% of all credits earned from nodes');
    expect(statRow(sleeve.stats, 'heat').tip).toContain('Node credits stop at 200 heat');
    expect(statRow(sleeve.stats, 'infamy').text).toBe('2');
    expect(statRow(sleeve.stats, 'infamy').tip).toContain('Heat Cooldown Time = 72s'); // 60 s x (1 + 10% x 2 Infamy)
  });
});

describe('view model - sleeve sections, light-up and the newer texts', () => {
  const buy = (id: string, extra = {}) =>
    ({ id, name: id, description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 1 }, ...extra }) as const;
  const sections = (buyables: object[]) =>
    buildViewModel(game({ buyables })).sleeve.sections.map((s) => [s.title, s.buyables.map((b) => b.id)]);

  it('splits the Sleeve purchases into rebuyable, one-time and paid in nodes, each sorted by base price', () => {
    expect(
      sections([
        buy('one-big', { cost: num(1000) }),
        buy('re-big', { cost: num(100), maxPurchases: Infinity }),
        buy('nodes', { cost: num(100), currency: 'networkNodes', maxPurchases: Infinity }),
        buy('one-small', { cost: num(1) }),
        buy('re-small', { cost: num(50), maxPurchases: Infinity }),
        buy('nodes-once', { cost: num(5), currency: 'networkNodes' }),
      ]),
    ).toEqual([
      ['Rebuyable', ['re-small', 're-big']],
      ['One-time', ['one-small', 'one-big']],
      ['Paid in nodes', ['nodes-once', 'nodes']],
    ]);
  });

  it('leaves out empty sections and action buyables, and keeps the flat list in configuration order', () => {
    const vm = buildViewModel(game({ buyables: [buy('b', { cost: num(9) }), buy('a', { cost: num(2) }), buy('mine', { actionId: 'a' })] }));
    expect(vm.sleeve.sections.map((s) => s.title)).toEqual(['One-time']);
    expect(vm.sleeve.sections[0]!.buyables.map((b) => b.id)).toEqual(['a', 'b']);
    expect(vm.sleeve.buyables.map((b) => b.id)).toEqual(['b', 'a']);
  });

  it('a rebuyable lights up only after it was bought once and the next copy is affordable', () => {
    const g = game({ buyables: [buy('re', { cost: num(10), costGrowth: 10, maxPurchases: Infinity }), buy('once', { cost: num(1) })] });
    const ready = (id: string) => buildViewModel(g).sleeve.buyables.find((b) => b.id === id)!.ready;
    setCredits(g, num(10));
    expect(ready('re')).toBe(false); // affordable, but never bought
    g.buy('re');
    setCredits(g, num(99));
    expect(ready('re')).toBe(false); // next copy costs 100
    setCredits(g, num(100));
    expect(ready('re')).toBe(true);
    g.buy('once');
    expect(ready('once')).toBe(false); // not a rebuyable
  });

  it("shows the start cost of a share-of-balance action with today's amount", () => {
    const g = game({ actions: [testConfig.actions[0]!, percentKillAction] });
    const text = () => buildViewModel(g).actions[1]!.startCostText;
    expect(text()).toBe('1% of nodes (0)');
    (g.getState() as { network: unknown }).network = num(250);
    expect(text()).toBe('1% of nodes (2)');
  });

  it('shows the Infamy cycle as a bar that is paused at 0 Infamy', () => {
    const g = game();
    const s = g.getState() as { infamy: number; infamyCooldownMs: number };
    expect(statRow(buildViewModel(g).sleeve.stats, 'infamy').bar!.running).toBe(false);
    s.infamy = 2;
    s.infamyCooldownMs = 300_000;
    const sleeve = buildViewModel(g).sleeve;
    expect(statRow(sleeve.stats, 'infamy').bar!.running).toBe(true);
    expect(statRow(sleeve.stats, 'infamy').bar!.percent).toBeCloseTo(50, 8);
  });

  it('shows what one node really pays per second, with a tip that shows the calculation, and names the Push malware reward unit', () => {
    const g = game({ actions: [testConfig.actions[0]!, payoutAction] });
    (g.getState() as { nodePayoutBonus: ReturnType<typeof num> }).nodePayoutBonus = num(0.5);
    (g.getState() as { network: ReturnType<typeof num> }).network = num(100);
    const vm = buildViewModel(g);
    // test config: base 0.05 credits per node per second plus an action bonus of 0.5, no purchases, no heat: 0.55 per node, 55 for 100 nodes
    expect(statRow(vm.network.stats, 'payout').text).toBe('0.55/s');
    const tip = statRow(vm.network.stats, 'payout').tip ?? '';
    expect(tip).toContain('Base = 0.05 credits/s');
    expect(tip).toContain('Purchases = 1');
    expect(tip).toContain('Payout per Node = (Base + Action Bonus) x Purchases');
    expect(tip).toContain('Action Bonus = 0.5 credits/s');
    expect(tip).toContain('Payout per Node = 0.55 credits/s');
    expect(tip).toContain('Network Payout = 100 x 0.55 = 55 credits/s');
    expect(tip).not.toContain('Credit Lever');
    expect(tip).not.toContain('Heat Tax Kept');
    expect(vm.actions[1]!.rewardUnit).toBe('node payout');
    expect(vm.actions[1]!.rewardText).toBe('0.001');
  });
});

describe('view model - sleeve widget', () => {
  it('shows the starting stats and only the global buyables', () => {
    const vm = buildViewModel(game());
    expect(statRow(vm.sleeve.stats, 'access').text).toBe('1');
    expect(statRow(vm.sleeve.stats, 'interfaceSpeed').text).toBe('1');
    expect(statRow(vm.sleeve.stats, 'heat').text).toBe('0');
    expect(vm.sleeve.buyables.map((b) => b.id)).toEqual(['speed', 'access']);
    expect(vm.actions[0]!.buyables.map((b) => b.id)).toEqual(['auto', 'dual', 'dup']);
  });

  it('updates the stats after buying the global buyables (1 + 0.05 = 1.05, access level 2)', () => {
    const g = game();
    setCredits(g, num(1100));
    expect(g.buy('speed')).toBe('purchased');
    expect(g.buy('access')).toBe('purchased');
    const vm = buildViewModel(g);
    expect(statRow(vm.sleeve.stats, 'interfaceSpeed').text).toBe('1.05');
    expect(statRow(vm.sleeve.stats, 'access').text).toBe('2');
    expect(vm.sleeve.buyables.map((b) => b.maxed)).toEqual([true, true]);
  });

  it('never shows a tax above 100% even when heat is higher', () => {
    const g = game();
    (g.getState() as { heat: number }).heat = 250;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').text).toBe('250');
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).toContain('Heat Tax = 100% of all credits earned from nodes');
  });
});

describe('view model - heat cooldown bar', () => {
  it('shows how far the 60 s cooldown cycle has progressed, and whether it is running', () => {
    const g = game();
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').bar!.running).toBe(false);
    (g.getState() as { heat: number }).heat = 3;
    g.tick(15_000);
    const sleeve = buildViewModel(g).sleeve;
    expect(statRow(sleeve.stats, 'heat').bar!.running).toBe(true);
    expect(statRow(sleeve.stats, 'heat').bar!.percent).toBeCloseTo(25, 6);
  });
});

describe('view model - locked actions and heat', () => {
  const three = () => game({ actions: [testConfig.actions[0]!, networkAction, malwareAction] });

  it('an action needing access level 2 is locked until the access upgrade is bought', () => {
    const g = three();
    let mal = buildViewModel(g).actions.find((a) => a.id === 'mal')!;
    expect(mal.unlocked).toBe(false);
    expect(mal.requiredAccessLevel).toBe(2);
    expect(mal.heatPerRun).toBe(1);
    setCredits(g, num(1000));
    g.buy('access');
    mal = buildViewModel(g).actions.find((a) => a.id === 'mal')!;
    expect(mal.unlocked).toBe(true);
  });

  it('shows heat and its tax in the sleeve widget; the run payout stays in full', () => {
    const g = three();
    setCredits(g, num(1000));
    g.buy('access');
    (g.getState() as { network: unknown }).network = num(10);
    expect(buildViewModel(g).actions.find((a) => a.id === 'mal')!.rewardText).toBe('10');
    g.startAction('mal');
    g.tick(6_000);
    const vm = buildViewModel(g);
    expect(statRow(vm.sleeve.stats, 'heat').text).toBe('1');
    expect(statRow(vm.sleeve.stats, 'heat').tip).toContain('Heat Tax = 1% of all credits earned from nodes');
    expect(vm.actions.find((a) => a.id === 'mal')!.rewardText).toBe('10');
  });
});

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
    (g.getState() as { network: unknown }).network = num(40);
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
    (g.getState() as { network: ReturnType<typeof num> }).network = num(100);
    return g;
  };
  const payout = (g: ReturnType<typeof game>) => statRow(buildViewModel(g).network.stats, 'payout');

  it('equals the network income divided by the nodes (one source of truth)', () => {
    const g = withNodes({ network: { creditsPerNodePerSecond: 0.2 } });
    const income = Number(statRow(buildViewModel(g).network.stats, 'income').text.replace('+', ''));
    expect(payout(g).text).toBe(`${income / 100}/s`);
  });

  it('is taxed by heat, and the tip says how much is kept', () => {
    const g = withNodes();
    (g.getState() as { heat: number }).heat = 20; // 20 points x 1% = 20% tax in the test config
    expect(payout(g).text).toBe('0.04/s');
    expect(payout(g).tip).toContain('Heat Tax Kept = 80%');
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
