import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { LevelRule, type LevelRuleConfig } from '..';

const _config = testConfig;
const rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('LevelRule (default 10 / 10): every level costs its full amount on its own', () => {
  const r = rule({ firstLevelXp: 10, growthFactor: 10 });

  // Levels start at 0. Level 1 costs 10, level 2 a further 100, level 3 a further 1000, ... so the totals are 10, 110, 1110, 11110.
  it.each([
    [0, 0],
    [1, 0],
    [9, 0],
    [9.99, 0],
    [10, 1],
    [99, 1],
    [100, 1],
    [109, 1],
    [110, 2],
    [1_109, 2],
    [1_110, 3],
    [10_000, 3],
    [11_110, 4],
  ])('xp %s -> level %s', (xp, level) => {
    expect(r.levelForXp(num(xp))).toBe(level);
  });

  it('keeps working at astronomical scale', () => {
    // Total XP of n levels is 10 * (10^n - 1) / 9, about 1.1 * 10^n.
    expect(r.levelForXp(num('1e300'))).toBe(299);
    expect(r.levelForXp(num('1.12e300'))).toBe(300);
    expect(r.levelForXp(num('1e1000'))).toBe(999);
  });

  it('maps non-finite xp to the maximum level instead of crashing', () => {
    expect(r.levelForXp(num(Infinity))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('the total at which the next level is reached adds up every level before it', () => {
    expect(r.xpForNextLevel(0).eq(num(10))).toBe(true);
    expect(r.xpForNextLevel(1).eq(num(110))).toBe(true);
    expect(r.xpForNextLevel(2).eq(num(1110))).toBe(true);
  });

  it('a level costs its full amount, whatever came before', () => {
    expect(r.xpCostOfLevel(0).eq(num(10))).toBe(true);
    expect(r.xpCostOfLevel(1).eq(num(100))).toBe(true);
    expect(r.xpCostOfLevel(2).eq(num(1000))).toBe(true);
    // Going from level 2 to 3 takes a full thousand, not 900.
    expect(r.xpForNextLevel(2).sub(r.xpForNextLevel(1)).eq(num(1000))).toBe(true);
  });

  it.each([
    [0, 0],
    [5, 5],
    [10, 0],
    [55, 45],
    [109, 99],
    [110, 0],
    [660, 550],
  ])('xp %s leaves %s inside the current level (the count starts again at each level-up)', (xp, into) => {
    expect(r.xpIntoLevel(num(xp)).toNumber()).toBeCloseTo(into, 9);
  });

  it.each([
    [0, 0],
    [5, 0.5],
    [10, 0],
    [60, 0.5],
    [100, 0.9],
    [110, 0],
    [610, 0.5],
  ])('progress fraction at xp %s is %s (position within the current level)', (xp, fraction) => {
    expect(r.progressFraction(num(xp))).toBeCloseTo(fraction, 9);
  });

  it('progress fraction is 1 for non-finite xp and stays within [0, 1] at huge scale', () => {
    expect(r.progressFraction(num(Infinity))).toBe(1);
    const p = r.progressFraction(num('5e300'));
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});
