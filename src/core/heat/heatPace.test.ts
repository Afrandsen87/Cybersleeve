import { describe, expect, it } from 'vitest';
import { coolingPace, heatTaxFactor, type CoolingPaceInputs } from '..';

const base: CoolingPaceInputs = { speed: 1, boost: 0, moles: 0, idle: false, idleFactor: 1, moleAggregation: null };

describe('coolingPace', () => {
  it('without Quiet Hours or Deep Cover the speed and the Mole boost pass through unchanged', () => {
    expect(coolingPace({ ...base, speed: 1.05, boost: 2, moles: 40 })).toEqual({ speed: 1.05, boost: 2 });
  });

  it('idle cooling multiplies the skill speed only while idle', () => {
    expect(coolingPace({ ...base, speed: 2, idle: true, idleFactor: 5 }).speed).toBe(10);
    expect(coolingPace({ ...base, speed: 2, idle: false, idleFactor: 5 }).speed).toBe(2);
  });

  it('with Deep Cover the Mole boost is dropped and each order of magnitude of Moles adds its bonus, multiplicatively', () => {
    const deep = { ...base, boost: 2, moleAggregation: 0.05 };
    expect(coolingPace({ ...deep, moles: 10 })).toEqual({ speed: 1.05, boost: 0 });
    expect(coolingPace({ ...deep, moles: 100 }).speed).toBeCloseTo(1.05 ** 2, 12);
    expect(coolingPace({ ...deep, moles: 1000 }).speed).toBeCloseTo(1.05 ** 3, 12);
  });

  it('with Deep Cover, one Mole or fewer is worth nothing (no negative or NaN orders)', () => {
    for (const moles of [0, 0.5, 1]) expect(coolingPace({ ...base, moleAggregation: 0.05, moles }).speed).toBe(1);
  });

  it('with Deep Cover the bonus stacks with idle cooling and the skill speed', () => {
    const pace = coolingPace({ ...base, speed: 2, idle: true, idleFactor: 5, moleAggregation: 0.05, moles: 100 });
    expect(pace.speed).toBeCloseTo(10 * 1.05 ** 2, 12);
  });
});

describe('heatTaxFactor with a cap', () => {
  it('without a cap the tax can take everything; with a cap of one half it always leaves half', () => {
    expect(heatTaxFactor(500, 0, 0.01)).toBe(0);
    expect(heatTaxFactor(500, 0, 0.01, 0.5)).toBe(0.5);
    expect(heatTaxFactor(Number.POSITIVE_INFINITY, 0, 0.01, 0.5)).toBe(0.5);
  });

  it('a cap changes nothing while the tax is below it', () => {
    expect(heatTaxFactor(20, 0, 0.01, 0.5)).toBeCloseTo(0.8, 12);
    expect(heatTaxFactor(0, 0, 0.01, 0.5)).toBe(1);
    expect(heatTaxFactor(Number.NaN, 0, 0.01, 0.5)).toBe(1);
  });
});
