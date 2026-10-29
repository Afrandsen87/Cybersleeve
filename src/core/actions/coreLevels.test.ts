/**
 * LevelRule, speed and speedFactors.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import {
  LevelRule,
  createConfig,
  createSpeedModifiers,
  effectiveDurationMs,
  levelFactor,
  SPEED_FACTOR_IDS,
  speedFactors,
  speedMultiplier,
  type LevelRuleConfig,
} from '..';

const config = testConfig;
const rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('LevelRule (custom thresholds)', () => {
  it('first level costs 5 XP, doubling: levels 1,2,3,4 cost 5,10,20,40, so they are reached at 5,15,35,75 in total', () => {
    const r = rule({ firstLevelXp: 5, growthFactor: 2 });
    expect(r.levelForXp(num(4.99))).toBe(0);
    expect(r.levelForXp(num(5))).toBe(1);
    expect(r.levelForXp(num(14.99))).toBe(1);
    expect(r.levelForXp(num(15))).toBe(2);
    expect(r.levelForXp(num(35))).toBe(3);
    expect(r.levelForXp(num(75))).toBe(4);
    expect(r.xpForNextLevel(0).eq(num(5))).toBe(true);
    expect(r.xpForNextLevel(2).eq(num(35))).toBe(true);
  });

  it('is exact at every boundary even when the logarithm is inexact (growth 3, first 1)', () => {
    const r = rule({ firstLevelXp: 1, growthFactor: 3 });
    for (let level = 1; level <= 30; level++) {
      const at = r.xpForNextLevel(level - 1);
      expect(r.levelForXp(at)).toBe(level);
      expect(r.levelForXp(at.mul(num(0.999999)))).toBe(level - 1);
    }
  });

  it('a gentler growth factor levels up more often', () => {
    const slow = rule({ firstLevelXp: 10, growthFactor: 10 });
    const fast = rule({ firstLevelXp: 10, growthFactor: 2 });
    expect(fast.levelForXp(num(1000))).toBeGreaterThan(slow.levelForXp(num(1000)));
  });
});

describe('speed', () => {
  const modifiers = createSpeedModifiers(config);
  const ctx = (actionLevel: number, sleeveLevel: number, interfaceSpeed = 1) => ({
    actionId: 'a',
    actionLevel,
    sleeveLevel,
    interfaceSpeed,
  });

  it('default: multiplier = action level x sleeve level', () => {
    expect(speedMultiplier(modifiers, ctx(2, 1))).toBe(6); // (1 + 2) x (1 + 1)
  });

  it('interface speed multiplies the speed by its value (0.5 halves it)', () => {
    expect(speedMultiplier(modifiers, ctx(2, 1, 0.5))).toBe(3);
    expect(effectiveDurationMs(1_000, speedMultiplier(modifiers, ctx(0, 0, 0.5)), 0.001)).toBe(2_000);
  });

  it('empty modifier list gives 1', () => {
    expect(speedMultiplier([], ctx(9, 9))).toBe(1);
  });

  it('divides the base duration by the multiplier (worked example 10/6 s)', () => {
    expect(effectiveDurationMs(10_000, speedMultiplier(modifiers, ctx(2, 1)), 0.001)).toBeCloseTo(10_000 / 6);
  });

  it('linear scaling: perLevel 0.5 gives 1 + 0.5 per level, and level 0 is worth exactly 1', () => {
    expect(levelFactor({ kind: 'linear', perLevel: 0.5 }, 0)).toBe(1);
    expect(levelFactor({ kind: 'linear', perLevel: 0.5 }, 4)).toBe(3);
  });

  it('exponential scaling: base 2 doubles per level', () => {
    expect(levelFactor({ kind: 'exponential', base: 2 }, 0)).toBe(1);
    expect(levelFactor({ kind: 'exponential', base: 2 }, 3)).toBe(8);
  });

  it('config drives the modifiers (sleeve exponential, global x3)', () => {
    const custom = createConfig(config, {
      speed: { sleeveLevel: { kind: 'exponential', base: 2 } },
      global: { speedMultiplier: 3 },
    });
    expect(speedMultiplier(createSpeedModifiers(custom), ctx(1, 3))).toBe(2 * 8 * 3);
  });

  it('a per-action scaling override wins over the global one', () => {
    const custom = createConfig(config, {
      actions: [{ ...config.actions[0]!, speedScaling: { kind: 'linear', perLevel: 10 } }],
    });
    expect(speedMultiplier(createSpeedModifiers(custom), ctx(1, 0))).toBe(11);
  });
});

describe('speedFactors', () => {
  const mods = createSpeedModifiers(config);
  const context = { actionId: 'a', actionLevel: 3, sleeveLevel: 2, interfaceSpeed: 0.5 };

  it('lists one factor per modifier, named, in order', () => {
    const f = speedFactors(mods, context);
    expect(f.map((x) => x.id)).toEqual([
      SPEED_FACTOR_IDS.actionLevel,
      SPEED_FACTOR_IDS.sleeveLevel,
      SPEED_FACTOR_IDS.interfaceSpeed,
      SPEED_FACTOR_IDS.globalSpeed,
      SPEED_FACTOR_IDS.overclock,
      SPEED_FACTOR_IDS.focus,
    ]);
    expect(f.find((x) => x.id === SPEED_FACTOR_IDS.interfaceSpeed)!.factor).toBe(0.5);
  });

  it('the Overclock and Focus factors are 1 unless a bonus is given, and 1 + bonus when it is', () => {
    const factorOf = (c: object, id: string) => speedFactors(mods, { ...context, ...c }).find((x) => x.id === id)!.factor;
    expect(factorOf({}, SPEED_FACTOR_IDS.overclock)).toBe(1);
    expect(factorOf({}, SPEED_FACTOR_IDS.focus)).toBe(1);
    expect(factorOf({ overclockBonus: 0.5 }, SPEED_FACTOR_IDS.overclock)).toBe(1.5);
    expect(factorOf({ focusBonus: 0.25 }, SPEED_FACTOR_IDS.focus)).toBe(1.25);
  });

  it('multiplies to exactly the speed multiplier', () => {
    const product = speedFactors(mods, context).reduce((p, x) => p * x.factor, 1);
    expect(product).toBeCloseTo(speedMultiplier(mods, context), 12);
  });

  it('sanitises like the speed multiplier: NaN counts as 1, overflow saturates', () => {
    const odd = [
      { id: 'nan', factor: () => Number.NaN },
      { id: 'big', factor: () => Number.POSITIVE_INFINITY },
    ];
    expect(speedFactors(odd, context)).toEqual([
      { id: 'nan', factor: 1 },
      { id: 'big', factor: 1e308 },
    ]);
  });
});
