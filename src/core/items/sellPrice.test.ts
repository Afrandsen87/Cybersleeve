import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { flat } from '../../testing/flatState';
import { testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig, type GameConfig } from '..';

/** Test content: common floors at 10 credits and asks for 2 s of peak income, rare floors at 100 and asks for 10 s. */
const config: GameConfig = createConfig(testConfig, {
  items: {
    rarities: [
      { id: 'common', name: 'Common', sellValue: num(10), sellSeconds: 2 },
      { id: 'rare', name: 'Rare', sellValue: num(100), sellSeconds: 10 },
    ],
    definitions: [{ id: 'file', name: 'File' }],
  },
});

const stocked = (peak: unknown) => {
  const g = createGame({ config });
  const state = flat<{ peakNetworkIncome: unknown; inventory: unknown }>(g);
  state.peakNetworkIncome = peak;
  state.inventory = { file: { common: 3, rare: 2 } };
  return g;
};

describe('Kompromat sale price follows peak income (Inventory.sellValue)', () => {
  it('the floor applies while the life peak is low', () => {
    const g = stocked(num(1));
    expect(g.sellValue('common').eq(num(10))).toBe(true); // 2 s x 1 = 2 < 10
    expect(g.sellValue('rare').eq(num(100))).toBe(true);
  });

  it('seconds x peak applies once it is larger than the floor', () => {
    const g = stocked(num(1000));
    expect(g.sellValue('common').eq(num(2000))).toBe(true);
    expect(g.sellValue('rare').eq(num(10_000))).toBe(true);
  });

  it('selling pays exactly the price the owner shows', () => {
    const g = stocked(num(1000));
    const shown = g.sellValue('common');
    g.sellItems('file', 'common', 3);
    expect(g.getState().wallet.credits.eq(shown.mul(num(3)))).toBe(true);
  });

  it('a rarer rarity never sells for less than a more common one', () => {
    for (const peak of [0, 1, 7, 1e3, 1e9, 1e300]) {
      const g = stocked(num(peak));
      expect(g.sellValue('rare').gte(g.sellValue('common'))).toBe(true);
    }
  });

  it('a NaN, negative or zero peak counts as no income: the floor applies', () => {
    for (const peak of [Number.NaN, -50, 0]) expect(stocked(num(peak)).sellValue('common').eq(num(10))).toBe(true);
  });

  it('an infinite or huge peak is clamped at Infinity (1e308) instead of corrupting the price', () => {
    const clamped = stocked(num(1e308)).sellValue('common');
    expect(stocked(num(Number.POSITIVE_INFINITY)).sellValue('common').eq(clamped)).toBe(true);
    expect(stocked(num('1e1000')).sellValue('common').eq(clamped)).toBe(true);
    expect(clamped.isFinite()).toBe(true);
  });

  it('an unknown rarity is worth nothing', () => {
    expect(stocked(num(1000)).sellValue('nope').isZero()).toBe(true);
  });

  it('a negative or NaN sellSeconds is rejected', () => {
    for (const sellSeconds of [-1, Number.NaN]) {
      const bad = createConfig(config, {
        items: { ...config.items, rarities: [{ id: 'common', name: 'C', sellValue: num(1), sellSeconds }] },
      });
      expect(validateConfig(bad).join()).toContain('sellSeconds must be >= 0');
    }
  });
});
