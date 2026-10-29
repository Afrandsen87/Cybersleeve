import { describe, expect, it } from 'vitest';
import { euphoriaReduction } from './sleeveEuphoria';

/** The expected outcome, stated plainly so the maths can change later without regressions: 50% less at sleeve level 10, 75% less at 100. */
describe('Sleeve Euphoria reduction', () => {
  const reduction = (level: number): number => euphoriaReduction(level, 0.5, 0.999);

  it('takes about half off at sleeve level 10 and about three quarters off at level 100', () => {
    expect(reduction(10)).toBeCloseTo(0.5, 12);
    expect(reduction(100)).toBeCloseTo(0.75, 12);
    expect(reduction(1000)).toBeCloseTo(0.875, 12);
  });

  it.each([0, 1, -5, Number.NaN])('takes nothing off at sleeve level %d (the first level is worth nothing)', (level) => {
    expect(reduction(level)).toBe(0);
  });

  it('grows with every level but ever more slowly (concave), and never reaches 100%', () => {
    let previous = reduction(2);
    let previousStep = Number.POSITIVE_INFINITY;
    expect(previous).toBeGreaterThan(0);
    for (let level = 3; level <= 400; level++) {
      const now = reduction(level);
      const step = now - previous;
      expect(step, `level ${level} must add something`).toBeGreaterThan(0);
      expect(step, `level ${level} must add less than the level before`).toBeLessThan(previousStep);
      expect(now).toBeLessThan(1);
      previous = now;
      previousStep = step;
    }
  });

  it('is held under its ceiling however high the level, so the remaining requirement never reaches 0', () => {
    for (const level of [1e6, 1e50, 1e300, Number.POSITIVE_INFINITY]) {
      expect(reduction(level), `level ${level}`).toBeLessThanOrEqual(0.999);
      expect(reduction(level), `level ${level}`).toBeLessThan(1);
    }
    expect(euphoriaReduction(1e6, 0.5, 0.6)).toBe(0.6);
  });

  it('follows the share left per order of magnitude it is given', () => {
    expect(euphoriaReduction(10, 0.8, 0.999)).toBeCloseTo(0.2, 12);
    expect(euphoriaReduction(100, 0.8, 0.999)).toBeCloseTo(1 - 0.64, 12);
  });
});
