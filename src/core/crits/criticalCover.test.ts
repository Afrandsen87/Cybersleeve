import { describe, expect, it } from 'vitest';
import { criticalCover } from './criticalCover';
import { CriticalSuccesses } from './critical';

const items = { zeroDay: { itemId: 'zd', actionId: 'mal' }, adminKey: { itemId: 'ak', actionId: 'kill' } } as never;
const state = (keyToggles: Record<string, boolean> = {}, bankedCriticals: Record<string, number> = {}) => ({
  wallet: {},
  sleeve: { keyToggles, bankedCriticals },
});
const off = state();

describe('criticalCover', () => {
  it('is false with nothing switched on or banked', () => {
    expect(criticalCover(off, items, 'mal')).toBe(false);
  });

  it('a Zero-day covers only its own action, and only while on', () => {
    expect(criticalCover(state({ zeroDay: true }), items, 'mal')).toBe(true);
    expect(criticalCover(state({ zeroDay: true }), items, 'kill')).toBe(false);
  });

  it('an Admin key covers only its own action, and only while on', () => {
    expect(criticalCover(state({ adminKey: true }), items, 'kill')).toBe(true);
    expect(criticalCover(state({ adminKey: true }), items, 'mal')).toBe(false);
  });

  it('a banked success covers its action; a zero count does not', () => {
    expect(criticalCover(state({}, { net: 1 }), items, 'net')).toBe(true);
    expect(criticalCover(state({}, { net: 0 }), items, 'net')).toBe(false);
  });

  it('copes with a game that has no Zero-day or Admin key', () => {
    expect(criticalCover(state({ zeroDay: true, adminKey: true }), {} as never, 'mal')).toBe(false);
  });
});

describe('CriticalSuccesses.maxPerRun', () => {
  it('is 0 with no chance and no cover', () => {
    expect(CriticalSuccesses.maxPerRun(0, 0, false)).toBe(0);
  });

  it('counts the whole part, one more for a fraction, one more for cover', () => {
    expect(CriticalSuccesses.maxPerRun(0.3, 0, false)).toBe(1);
    expect(CriticalSuccesses.maxPerRun(1, 0, false)).toBe(1);
    expect(CriticalSuccesses.maxPerRun(2.4, 0, false)).toBe(3);
    expect(CriticalSuccesses.maxPerRun(2.4, 0, true)).toBe(4);
    expect(CriticalSuccesses.maxPerRun(0, 0, true)).toBe(1);
  });

  it('doubles while an extra chance exists', () => {
    expect(CriticalSuccesses.maxPerRun(2.4, 0.1, true)).toBe(8);
  });

  it('is never below what settle can give for one run (seeded draws stay within it)', () => {
    let state = 7;
    const random = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };
    for (const [chance, extra, covered] of [
      [0.4, 0, 0],
      [1.5, 0.5, 1],
      [3.2, 0.9, 0],
    ] as const) {
      const unit = new CriticalSuccesses({ criticalChance: () => chance, criticalExtraChance: () => extra }, random);
      const max = CriticalSuccesses.maxPerRun(chance, extra, covered > 0);
      for (let i = 0; i < 200; i++) expect(unit.settle(1, covered).crits).toBeLessThanOrEqual(max);
    }
  });
});
