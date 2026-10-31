/**
 * @module ui
 *
 * The Sleeve stat groups and the heat gauge (`ui/view/sleeveGroups.ts`) as the view model builds them.
 *
 * @remarks
 * Called by: Vitest. Calls: `buildViewModel`, `SLEEVE_STAT_GROUPS`.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { flat } from '../testing/flatState';
import { game } from '../testing/gameKit';
import { setCredits } from '../testing/testConfig';
import { SLEEVE_STAT_GROUPS } from './view/sleeveGroups';
import { statRow } from './view/viewFormat';
import { buildViewModel } from './viewModel';

describe('the Sleeve stat groups', () => {
  it('give every sleeve stat row exactly one group, with Legend under DEFENSE', () => {
    const ids = buildViewModel(game()).sleeve.stats.map((r) => r.id);
    const grouped = SLEEVE_STAT_GROUPS.flatMap((g) => g.statIds);
    expect([...grouped].sort()).toEqual([...ids].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(SLEEVE_STAT_GROUPS.find((g) => g.statIds.includes('legend'))?.id).toBe('defense');
  });

  it('order the rows by group, and hide a group exactly when all its rows are hidden', () => {
    const vm = buildViewModel(game());
    expect(vm.sleeve.stats.map((r) => r.id)).toEqual(vm.sleeve.groups.flatMap((g) => g.statIds));
    for (const group of vm.sleeve.groups) {
      const rows = group.statIds.map((id) => statRow(vm.sleeve.stats, id));
      expect(group.hidden, group.id).toBe(rows.every((r) => r.hidden));
    }
    expect(vm.sleeve.groups.find((g) => g.id === 'access')?.hidden).toBe(false); // a fresh game shows its access level
  });
});

describe('the Legend decay bar', () => {
  it('is hidden while there is no Legend, and shown once there is', () => {
    const g = game();
    expect(statRow(buildViewModel(g).sleeve.stats, 'legend').bar?.hidden).toBe(true);
    flat<{ legend: number }>(g).legend = 2;
    expect(statRow(buildViewModel(g).sleeve.stats, 'legend').bar?.hidden).toBe(false);
  });
});

describe('the heat gauge', () => {
  it('is absent exactly while the heat row is hidden', () => {
    const g = game();
    const before = buildViewModel(g).sleeve;
    expect(statRow(before.stats, 'heat').hidden).toBe(true);
    expect(before.heatGauge).toBeNull();
    flat<{ heat: number }>(g).heat = 10;
    const after = buildViewModel(g).sleeve;
    expect(statRow(after.stats, 'heat').hidden).toBe(false);
    expect(after.heatGauge).not.toBeNull();
  });

  it('names the heat where every credit is taxed, and the strip starts its tax zone there', () => {
    const g = game();
    flat<{ heat: number }>(g).heat = 652.3491;
    const gauge = buildViewModel(g).sleeve.heatGauge;
    expect(gauge?.valueText).toBe('HEAT 652.3');
    expect(gauge?.legendText).toBe('all credits taxed ≥ 100');
    expect(gauge?.strip.taxStartPercent).not.toBeNull();
    expect(gauge?.strip.overflow).toBe(true);
  });

  it('names the cap instead when the tax stops short of taking everything, with no tax zone', () => {
    const g = game({
      buyables: [{ id: 'cap', name: 'Cap', description: '', cost: num(1), effect: { kind: 'heatTaxCap', maxShare: 0.8 } }],
    });
    setCredits(g, num(1));
    expect(g.buy('cap')).toBe('purchased');
    flat<{ heat: number }>(g).heat = 150;
    const gauge = buildViewModel(g).sleeve.heatGauge;
    expect(gauge?.legendText).toBe('tax capped at 80%');
    expect(gauge?.strip.taxStartPercent).toBeNull();
    for (const t of [gauge?.valueText, gauge?.zoneText, gauge?.legendText]) expect(t).not.toMatch(/NaN|undefined/);
  });
});
