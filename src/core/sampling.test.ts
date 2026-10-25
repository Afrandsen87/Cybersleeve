import { describe, expect, it } from 'vitest';
import { seededRandom } from '../testing/random';
import { binomial, multinomial } from './sampling';

const average = (n: number, draw: () => number): number => {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += draw();
  return sum / n;
};

describe('binomial', () => {
  it('edge cases: no trials, no chance and certain chance', () => {
    const r = seededRandom(1);
    expect(binomial(0, 0.5, r)).toBe(0);
    expect(binomial(-5, 0.5, r)).toBe(0);
    expect(binomial(Number.NaN, 0.5, r)).toBe(0);
    expect(binomial(100, 0, r)).toBe(0);
    expect(binomial(100, Number.NaN, r)).toBe(0);
    expect(binomial(100, 1, r)).toBe(100);
    expect(binomial(100, 7, r)).toBe(100);
    expect(binomial(1e12, 1, r)).toBe(1e12);
  });

  it('a small batch is drawn trial by trial: a source that always rolls low hits every time, one that rolls high never does', () => {
    expect(binomial(500, 0.05, () => 0)).toBe(500);
    expect(binomial(500, 0.05, () => 0.99)).toBe(0);
  });

  it.each([
    [10, 0.3], // exact
    [100_000, 0.05], // normal approximation
    [100_000, 0.0001], // Poisson approximation
    [100_000, 0.97], // mirrored
  ])('the mean of %d trials at chance %d is trials x chance', (trials, chance) => {
    const r = seededRandom(7);
    const mean = average(400, () => binomial(trials, chance, r));
    const sd = Math.sqrt(trials * chance * (1 - chance));
    expect(Math.abs(mean - trials * chance)).toBeLessThan(Math.max(0.2, (5 * sd) / Math.sqrt(400)));
  });

  it('stays within 0..trials whatever the source returns', () => {
    for (const value of [0, 0.5, 0.999999]) {
      for (const [n, p] of [
        [5000, 0.5],
        [5000, 0.001],
        [1e15, 0.3],
      ] as const) {
        const hits = binomial(n, p, () => value);
        expect(hits).toBeGreaterThanOrEqual(0);
        expect(hits).toBeLessThanOrEqual(n);
        expect(Number.isInteger(hits)).toBe(true);
      }
    }
  });

  it('handles astronomically many trials without iterating', () => {
    const hits = binomial(Number.MAX_SAFE_INTEGER, 0.05, seededRandom(3));
    expect(hits / Number.MAX_SAFE_INTEGER).toBeCloseTo(0.05, 6);
  });
});

describe('multinomial', () => {
  it('the counts always add up to the total', () => {
    const r = seededRandom(11);
    for (const total of [1, 7, 1000, 123_456]) {
      const counts = multinomial(total, [90, 9, 1, 0, 0], r);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('a category with weight 0 gets nothing', () => {
    const counts = multinomial(100_000, [90, 9, 1, 0, 0], seededRandom(5));
    expect(counts[3]).toBe(0);
    expect(counts[4]).toBe(0);
  });

  it('follows the relative weights', () => {
    const counts = multinomial(1_000_000, [90, 9, 1], seededRandom(5));
    expect(counts[0]! / 1_000_000).toBeCloseTo(0.9, 2);
    expect(counts[1]! / 1_000_000).toBeCloseTo(0.09, 2);
    expect(counts[2]! / 1_000_000).toBeCloseTo(0.01, 2);
  });

  it('weights need not add up to 100 and bad weights count as 0', () => {
    const counts = multinomial(1000, [1, -5, Number.NaN, 1], () => 0);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(counts[1]).toBe(0);
    expect(counts[2]).toBe(0);
  });

  it('places nothing when there is nothing to place or no weight', () => {
    expect(multinomial(0, [1, 1], seededRandom(1))).toEqual([0, 0]);
    expect(multinomial(10, [0, 0], seededRandom(1))).toEqual([0, 0]);
    expect(multinomial(10, [], seededRandom(1))).toEqual([]);
  });

  it('still adds up when the weights leave floating-point residue in the running sum (shifted ratios)', () => {
    const weights = [89.1, 9.81, 1.08, 0.01, 0];
    const r = seededRandom(3);
    for (let i = 0; i < 200; i++) expect(multinomial(1 + i * 37, weights, r).reduce((a, b) => a + b, 0)).toBe(1 + i * 37);
  });

  it('a single weighted category takes everything', () => {
    expect(multinomial(77, [0, 3, 0], seededRandom(1))).toEqual([0, 77, 0]);
  });
});
