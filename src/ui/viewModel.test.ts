import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { malwareAction, networkAction, setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel, formatSeconds } from './viewModel';

const game = (overrides = {}) => createGame({ config: createConfig(testConfig, overrides) });

describe('view model - sleeve widget', () => {
  it('shows the starting stats and only the global buyables', () => {
    const vm = buildViewModel(game());
    expect(vm.sleeve.accessLevelText).toBe('1');
    expect(vm.sleeve.interfaceSpeedText).toBe('100%');
    expect(vm.sleeve.heatText).toBe('0 (0% tax)');
    expect(vm.sleeve.buyables.map((b) => b.id)).toEqual(['speed', 'access']);
    expect(vm.actions[0]!.buyables.map((b) => b.id)).toEqual(['auto', 'dual', 'dup']);
  });

  it('updates the stats after buying the global buyables (100% + 5 = 105%, access level 2)', () => {
    const g = game();
    setCredits(g, num(1100));
    expect(g.buy('speed')).toBe('purchased');
    expect(g.buy('access')).toBe('purchased');
    const vm = buildViewModel(g);
    expect(vm.sleeve.interfaceSpeedText).toBe('105%');
    expect(vm.sleeve.accessLevelText).toBe('2');
    expect(vm.sleeve.buyables.map((b) => b.maxed)).toEqual([true, true]);
  });

  it('never shows a tax above 100% even when heat is higher', () => {
    const g = game();
    (g.getState() as { heat: number }).heat = 250;
    expect(buildViewModel(g).sleeve.heatText).toBe('250 (100% tax)');
  });
});

describe('view model - heat cooldown bar', () => {
  it('shows how far the 60 s cooldown cycle has progressed, and whether it is running', () => {
    const g = game();
    expect(buildViewModel(g).sleeve.heatCooling).toBe(false);
    (g.getState() as { heat: number }).heat = 3;
    g.tick(15_000);
    const sleeve = buildViewModel(g).sleeve;
    expect(sleeve.heatCooling).toBe(true);
    expect(sleeve.heatCooldownPercent).toBeCloseTo(25, 6);
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

  it('shows heat and its tax in the sleeve widget, and the payout after tax', () => {
    const g = three();
    setCredits(g, num(1000));
    g.buy('access');
    (g.getState() as { network: unknown }).network = num(10);
    expect(buildViewModel(g).actions.find((a) => a.id === 'mal')!.rewardText).toBe('10');
    g.startAction('mal');
    g.tick(6_000);
    const vm = buildViewModel(g);
    expect(vm.sleeve.heatText).toBe('1 (1% tax)');
    expect(vm.actions.find((a) => a.id === 'mal')!.rewardText).toBe('9.9');
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
    expect(net.rewardUnit).toBe('network nodes');
    expect(vm.networkText).toBe('0');
    expect(vm.passiveIncomeText).toBe('0');
  });

  it('uses the configured symbol of a buyable', () => {
    const buyables = [{ ...testConfig.buyables[0]!, symbol: '↻' }];
    expect(buildViewModel(game({ buyables })).actions[0]!.buyables[0]!.symbol).toBe('↻');
  });

  it('shows the network size and its passive income', () => {
    const g = game();
    (g.getState() as { network: unknown }).network = num(40);
    const vm = buildViewModel(g);
    expect(vm.networkText).toBe('40');
    expect(vm.passiveIncomeText).toBe('2');
  });

  it("falls back to the name's initials when a buyable has no symbol", () => {
    expect(buildViewModel(game()).actions[0]!.buyables.map((b) => b.symbol)).toEqual(['A', 'D', 'D']);
  });

  it('shows initial values', () => {
    const vm = buildViewModel(game());
    expect(vm.creditsText).toBe('0');
    const a = vm.actions[0]!;
    expect(a.sleeve.level).toBe(1);
    expect(a.sleeve.runsToNextXp).toBe(100);
    expect(a.sleeve.progressPercent).toBe(0);
    expect(a.levelProgressPercent).toBe(0);
    expect(a.level).toBe(1);
    expect(a.durationText).toBe('10s');
    expect(a.rewardText).toBe('0.5');
    expect(a.outputMultiplierText).toBe('1');
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
    expect(buildViewModel(g).actions[0]!.outputMultiplierText).toBe('4');
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
