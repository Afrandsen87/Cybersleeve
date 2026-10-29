import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { formatPlain } from '../../numbers';
import { buildViewModel, statRow } from '../../ui/viewModel';
import { testConfig } from '../../testing/testConfig';
import { cycleMs, coolsNow, heatStopPoint, heatTaxShare, moleSpeedFactor } from './heatModel';
import { heatTaxFactor } from './heat';

const EDGES = [0, -3, 0.5, 1, 2, 100, 1e6, 1e300, Number.NaN, Number.POSITIVE_INFINITY];

describe('cycleMs', () => {
  it('is the base cycle without Legend and shrinks as Legend grows', () => {
    const sleeve = { heatCooldownMs: 1000, legendHeatSpeedup: 0.1 };
    expect(cycleMs(sleeve, 0)).toBe(1000);
    expect(cycleMs(sleeve, 10)).toBe(500);
  });
});

describe('coolsNow', () => {
  it('waits until there is a whole amount of heat to remove', () => {
    expect(coolsNow(0, 1)).toBe(false);
    expect(coolsNow(0.99, 1)).toBe(false);
    expect(coolsNow(1, 1)).toBe(true);
    expect(coolsNow(Number.NaN, 1)).toBe(false);
  });
});

describe('heatTaxShare / heatStopPoint', () => {
  it('equals what the tax factor takes away until the cap, and follows the heat past the stop point', () => {
    for (const heat of [0, 1, 50, 99, 100, 250]) {
      const share = heatTaxShare(heat, 0.2, 0.01, 1);
      expect(Math.max(0, 1 - share)).toBeCloseTo(heatTaxFactor(heat, 0.2, 0.01), 12);
    }
  });

  it('never takes more than the cap', () => {
    expect(heatTaxShare(500, 0, 0.01, 0.5)).toBe(0.5);
    expect(heatTaxShare(10, 0, 0.01, 0.5)).toBeCloseTo(0.1, 12);
  });

  it('stops everything at 1 / perPoint / keep, and never with a cap, no tax or full reduction', () => {
    expect(heatStopPoint(0, 0.01, 1)).toBeCloseTo(100, 12);
    expect(heatStopPoint(0.5, 0.01, 1)).toBeCloseTo(200, 12);
    expect(heatStopPoint(0, 0.01, 0.5)).toBeNull();
    expect(heatStopPoint(0, 0, 1)).toBeNull();
    expect(heatStopPoint(1, 0.01, 1)).toBeNull();
  });
});

describe('moleSpeedFactor', () => {
  it('equals the old inline form for every edge input', () => {
    for (const moles of EDGES) {
      const old = 1.05 ** (moles > 1 ? Math.log10(moles) : 0);
      expect(moleSpeedFactor(0.05, moles)).toBe(old);
    }
  });

  it('is 1 for 1 Mole or fewer, 1.05 at 10 Moles, 1.05^2 at 100', () => {
    expect(moleSpeedFactor(0.05, 1)).toBe(1);
    expect(moleSpeedFactor(0.05, 0)).toBe(1);
    expect(moleSpeedFactor(0.05, 10)).toBeCloseTo(1.05, 12);
    expect(moleSpeedFactor(0.05, 100)).toBeCloseTo(1.1025, 12);
  });
});

describe('the heat tip shows the model values', () => {
  it('the cycle seconds and tax percent in the tip equal the model', () => {
    const g = createGame({ config: testConfig });
    const state = g.getState() as { heat: number; legend: number };
    state.heat = 40;
    state.legend = 3;
    const stats = g.sleeveStats();
    const tip = statRow(buildViewModel(g).sleeve.stats, 'heat').tip;
    const seconds = formatPlain(cycleMs(testConfig.sleeve, state.legend) / stats.heatCooldownSpeed / 1000);
    const tax = formatPlain(heatTaxShare(state.heat, stats.heatReduction, testConfig.sleeve.heatTaxPerPoint, stats.heatTaxCap) * 100);
    expect(tip).toContain(seconds);
    expect(tip).toContain(`${tax}%`);
  });
});
