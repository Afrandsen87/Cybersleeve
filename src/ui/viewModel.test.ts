import { game } from '../testing/gameKit';
import { describe, expect, it } from 'vitest';
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
import { buildViewModel, statRow } from './viewModel';
import type { ActionView } from './viewModel';

/** The texts of a card's extra lines, joined (what the RISK and COST rows show). */
const costTexts = (card: ActionView): string => card.costItems.map((i) => i.text).join(' | ');

describe('view model - unlocks, start costs and toggles', () => {
  const unlock = {
    id: 'unlock',
    name: 'Unlock Legend',
    description: '',
    cost: num(1),
    effect: { kind: 'accessLevel', amount: 1 },
  } as const;
  const withNew = (buyables = [...testConfig.buyables, unlock]) =>
    game({ actions: [testConfig.actions[0]!, killAction, legendAction], buyables });

  it('names why an action is locked in a few words and shows its start cost', () => {
    const vm = buildViewModel(withNew());
    const [a, kill, legend] = vm.actions;
    expect(a!.lockedReason).toBeNull();
    expect(a!.startCostText).toBeNull();
    expect(kill!.lockedReason).toBeNull();
    expect(kill!.startCostText).toBe('50 nodes');
    expect(kill!.startable).toBe(false); // no nodes to pay the start cost with
    expect(legend!.lockedReason).toBe('Requires Access Level 2');
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

  it('shows ICE Rating, Legend and the heat tax after ICE Rating, each with an explaining tip', () => {
    const g = withNew();
    const state = g.getState().sleeve as { heat: number; legend: number; iceRating: unknown };
    state.heat = 150;
    state.legend = 2;
    state.iceRating = num('1e100');
    const sleeve = buildViewModel(g).sleeve;
    expect(statRow(sleeve.stats, 'iceRating').text).toBe('1e100');
    expect(statRow(sleeve.stats, 'iceRating').tip).toContain('Heat Reduction = 50%');
    expect(statRow(sleeve.stats, 'heat').text).toBe('150');
    expect(statRow(sleeve.stats, 'heat').tip).toContain('Heat Reduction = 50% (from ICE Rating)');
    expect(statRow(sleeve.stats, 'heat').tip).toContain('Heat Tax = 75% of all credits earned from nodes');
    expect(statRow(sleeve.stats, 'heat').tip).toContain('Node credits stop at 200 heat');
    expect(statRow(sleeve.stats, 'legend').text).toBe('2');
    expect(statRow(sleeve.stats, 'legend').tip).toContain('Heat Cooldown Time = 50s'); // 60 s / (1 + 10% x 2 Legend)
  });
});

describe('view model - sleeve sections, light-up and the newer texts', () => {
  const buy = (id: string, extra = {}) =>
    ({ id, name: id, description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 1 }, ...extra }) as const;
  const sections = (buyables: object[]) =>
    buildViewModel(game({ buyables })).sleeve.sections.map((s) => [s.title, s.buyables.map((b) => b.id)]);

  it('splits the Sleeve purchases into currency rows, each sorted by base price', () => {
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
      ['SLEEVE', ['one-small', 're-small', 're-big', 'one-big']],
      ['NETWORK', ['nodes-once', 'nodes']],
    ]);
  });

  it('leaves out empty sections and action buyables, and keeps the flat list in base-price order', () => {
    const vm = buildViewModel(game({ buyables: [buy('b', { cost: num(9) }), buy('a', { cost: num(2) }), buy('mine', { actionId: 'a' })] }));
    expect(vm.sleeve.sections.map((s) => s.title)).toEqual(['SLEEVE']);
    expect(vm.sleeve.sections[0]!.buyables.map((b) => b.id)).toEqual(['a', 'b']);
    expect(vm.sleeve.buyables.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it("shows the start cost of a share-of-balance action with today's amount", () => {
    const g = game({ actions: [testConfig.actions[0]!, percentKillAction] });
    const text = () => buildViewModel(g).actions[1]!.startCostText;
    expect(text()).toBe('1% of nodes (0)');
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(250);
    expect(text()).toBe('1% of nodes (2)');
  });

  it('shows the Legend cycle as a bar that is paused at 0 Legend', () => {
    const g = game();
    const s = g.getState().sleeve as { legend: number; legendCooldownMs: number };
    expect(statRow(buildViewModel(g).sleeve.stats, 'legend').bar!.running).toBe(false);
    s.legend = 2;
    s.legendCooldownMs = 300_000;
    const sleeve = buildViewModel(g).sleeve;
    expect(statRow(sleeve.stats, 'legend').bar!.running).toBe(true);
    expect(statRow(sleeve.stats, 'legend').bar!.percent).toBeCloseTo(50, 8);
  });

  it('shows what one node really pays per second, with a tip that shows the calculation, and names the Push malware reward unit', () => {
    const g = game({ actions: [testConfig.actions[0]!, payoutAction] });
    (g.getState() as unknown as { sleeve: { nodePayoutBonus: ReturnType<typeof num> } }).sleeve.nodePayoutBonus = num(0.5);
    (g.getState() as unknown as { sleeve: { network: ReturnType<typeof num> } }).sleeve.network = num(100);
    const vm = buildViewModel(g);
    // test config: base 0.05 credits per node per second plus an action bonus of 0.5, no purchases, no heat: 0.55 per node, 55 for 100 nodes
    expect(statRow(vm.network.stats, 'payout').text).toBe('0.55/s');
    const tip = statRow(vm.network.stats, 'payout').tip ?? '';
    expect(tip).toContain('Base = 0.05 credits/s');
    expect(tip).not.toContain('Purchases');
    expect(tip).toContain('Payout per Node = (Base + Action Bonus)\n');
    expect(tip).toContain('Action Bonus = 0.5 credits/s');
    expect(tip).toContain('Payout per Node = 0.55 credits/s');
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
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 250;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').text).toBe('250');
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).toContain('Heat Tax = 100% of all credits earned from nodes');
  });
});

describe('view model - heat cooldown bar', () => {
  it('shows how far the 60 s cooldown cycle has progressed, and whether it is running', () => {
    const g = game();
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').bar!.running).toBe(false);
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 3;
    g.tick(15_000);
    const sleeve = buildViewModel(g).sleeve;
    expect(statRow(sleeve.stats, 'heat').bar!.running).toBe(true);
    expect(statRow(sleeve.stats, 'heat').bar!.percent).toBeCloseTo(25, 6);
  });
});

describe('view model - locked actions and heat', () => {
  const three = () => game({ actions: [testConfig.actions[0]!, networkAction, malwareAction] });

  it('shows heat that accrues per second on the card, in place of a per-run heat', () => {
    const g = game({ actions: [testConfig.actions[0]!, legendAction], buyables: [] });
    const card = buildViewModel(g).actions.find((a) => a.id === 'legend')!;
    expect(costTexts(card)).toContain('+5 heat/s');
    expect(costTexts(card)).not.toContain('+50 heat');
    expect(card.rewardLine).not.toContain('heat');
  });

  it('an action needing access level 2 is locked until the access upgrade is bought', () => {
    const g = three();
    let mal = buildViewModel(g).actions.find((a) => a.id === 'mal')!;
    expect(mal.unlocked).toBe(false);
    expect(mal.requiredAccessLevel).toBe(2);
    expect(mal.heatPerRun).toBe(1);
    expect(costTexts(mal)).toContain('+1 heat');
    expect(mal.rewardLine).not.toContain('heat');
    setCredits(g, num(1000));
    g.buy('access');
    mal = buildViewModel(g).actions.find((a) => a.id === 'mal')!;
    expect(mal.unlocked).toBe(true);
  });

  it('shows heat and its tax in the sleeve widget; the run payout stays in full', () => {
    const g = three();
    setCredits(g, num(1000));
    g.buy('access');
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(10);
    expect(buildViewModel(g).actions.find((a) => a.id === 'mal')!.rewardText).toBe('10');
    g.startAction('mal');
    g.tick(6_000);
    const vm = buildViewModel(g);
    expect(statRow(vm.sleeve.stats, 'heat').text).toBe('1');
    expect(statRow(vm.sleeve.stats, 'heat').tip).toContain('Heat Tax = 1% of all credits earned from nodes');
    expect(vm.actions.find((a) => a.id === 'mal')!.rewardText).toBe('10');
  });
});
