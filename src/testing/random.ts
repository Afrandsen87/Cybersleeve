/**
 * @module testing
 *
 * A seeded random number generator, so property-style tests are reproducible. Not part of the shipped game.
 */

/** A source of numbers in [0, 1). */
export type Random = () => number;

/**
 * Creates a deterministic generator (mulberry32).
 *
 * @param seed any integer; the same seed always gives the same sequence
 */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [0, n). */
export function randomInt(random: Random, n: number): number {
  return Math.floor(random() * n);
}

/** One element of a non-empty list. */
export function pick<T>(random: Random, items: readonly T[]): T {
  return items[randomInt(random, items.length)]!;
}
