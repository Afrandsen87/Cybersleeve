/**
 * Heat tax, sleeve stats and effect resolution.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../numbers';
import { testConfig } from '../testing/testConfig';
import {
  LevelRule,
  createConfig,
  createInitialState,
  heatTaxFactor,
  resolveEffects,
  resolveSleeveStats,
  type LevelRuleConfig,
} from './index';

const config = testConfig;
const _rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('heatTaxFactor', () => {
  it.each([
    [0, 1],
    [13, 0.87],
    [50, 0.5],
    [100, 0],
    [250, 0],
    [-5, 1],
    [NaN, 1],
  ])('heat %s keeps %s of earned credits', (heat, kept) => {
    expect(heatTaxFactor(heat, 0, 0.01)).toBeCloseTo(kept, 10);
  });
});

describe('resolveSleeveStats', () => {
  it('reports the current heat from the state', () => {
    const stats = resolveSleeveStats(
      config.buyables,
      {
        purchased: {},
        heat: 4,
        hackingProficiency: num(0),
        network: num(0),
        iceRating: num(1),
        legend: 0,
        nodePayoutBonus: num(0),
        inventory: {},
      },
      config.sleeve,
      numberFactory,
    );
    expect(stats.heat).toBe(4);
  });

  it('multiplies the interface speed by 1 + the bonus earned by actions (0.5 * 1.25 = 0.625)', () => {
    const stats = resolveSleeveStats(
      [],
      {
        purchased: {},
        heat: 0,
        hackingProficiency: num(0.25),
        network: num(0),
        iceRating: num(1),
        legend: 0,
        nodePayoutBonus: num(0),
        inventory: {},
      },
      { ...config.sleeve, baseInterfaceSpeed: 0.5 },
      numberFactory,
    );
    expect(stats.interfaceSpeed).toBeCloseTo(0.625, 10);
  });

  it('a new game starts with the configured base heat', () => {
    const s = createInitialState(createConfig(config, { sleeve: { baseHeat: 6 } }), numberFactory);
    expect(s.heat).toBe(6);
    expect(s.heatCooldownMs).toBe(0);
  });
});

describe('resolveEffects', () => {
  const effects = (purchased: Record<string, number>, actionId = 'a') =>
    resolveEffects(config.buyables, { purchased }, actionId, numberFactory);

  it('has no effects when nothing is owned', () => {
    const e = effects({});
    expect(e.autoRun).toBe(false);
    expect(e.rewardMultiplier.eq(num(1))).toBe(true);
  });

  it('combines owned effects', () => {
    const e = effects({ auto: 1, dual: 1 });
    expect(e.autoRun).toBe(true);
    expect(e.rewardMultiplier.eq(num(2))).toBe(true);
  });

  it('applies a repeated effect once per copy (dual x1, dup x3 -> 2^4)', () => {
    expect(effects({ dual: 1, dup: 3 }).rewardMultiplier.eq(num(16))).toBe(true);
  });

  it('does not overflow for very many copies', () => {
    const e = effects({ dual: 1, dup: 2000 });
    expect(e.rewardMultiplier.isFinite()).toBe(true);
    expect(e.rewardMultiplier.floorLog10()).toBe(Math.floor(2001 * Math.log10(2)));
  });

  it('ignores effects targeting other actions', () => {
    const e = effects({ auto: 1 }, 'other');
    expect(e.autoRun).toBe(false);
  });
});
