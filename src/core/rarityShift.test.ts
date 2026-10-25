import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { seededRandom } from '../testing/random';
import { setCredits, testConfig } from '../testing/testConfig';
import { createConfig, shiftWeights, validateConfig, wholeOrders, type BuyableDefinition, type GameConfig } from './index';

const sum = (w: readonly number[]): number => w.reduce((a, b) => a + b, 0);

describe('shiftWeights', () => {
  const real = [90, 9, 1, 0, 0];

  it('with no steps nothing moves', () => {
    expect(shiftWeights(real, 0, 0.01)).toEqual(real);
  });

  it('one step moves 1% of each weight to the next, all worked out up front: legendary gains from rare, crisis gains nothing', () => {
    const [common, uncommon, rare, legendary, crisis] = shiftWeights(real, 1, 0.01);
    expect(common).toBeCloseTo(89.1, 10); // 90 - 0.9
    expect(uncommon).toBeCloseTo(9.81, 10); // 9 - 0.09 + 0.9
    expect(rare).toBeCloseTo(1.08, 10); // 1 - 0.01 + 0.09
    expect(legendary).toBeCloseTo(0.01, 10); // 0 - 0 + 0.01
    expect(crisis).toBe(0); // legendary was 0 when the amounts were worked out, so it passed nothing on
  });

  it('only the second step lets the last rarity receive anything', () => {
    expect(shiftWeights(real, 1, 0.01)[4]).toBe(0);
    expect(shiftWeights(real, 2, 0.01)[4]).toBeCloseTo(0.0001, 12); // 1% of legendary's 0.01
  });

  it('the total never changes, and no weight goes negative', () => {
    for (const steps of [1, 2, 5, 50, 500, 100_000]) {
      const shifted = shiftWeights(real, steps, 0.01);
      expect(sum(shifted)).toBeCloseTo(100, 8);
      for (const w of shifted) expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it('every step moves weight towards the rarer rarities: the last rarity only ever grows', () => {
    let previous = 0;
    for (let steps = 1; steps <= 300; steps++) {
      const last = shiftWeights(real, steps, 0.01)[4]!;
      expect(last).toBeGreaterThanOrEqual(previous);
      previous = last;
    }
  });

  it('with enough steps nearly everything ends in the last rarity', () => {
    expect(shiftWeights(real, 5_000, 0.01)[4]! / 100).toBeGreaterThan(0.999);
  });

  it('a fraction of 1 moves everything on one rarity per step', () => {
    expect(shiftWeights([1, 0, 0], 1, 1)).toEqual([0, 1, 0]);
    expect(shiftWeights([1, 0, 0], 2, 1)).toEqual([0, 0, 1]);
    expect(shiftWeights([1, 0, 0], 3, 1)).toEqual([0, 0, 1]); // the last keeps what it has
  });

  it('a single rarity, or all-zero weights, stay as they are', () => {
    expect(shiftWeights([5], 10, 0.5)).toEqual([5]);
    expect(shiftWeights([0, 0], 10, 0.5)).toEqual([0, 0]);
    expect(shiftWeights([], 10, 0.5)).toEqual([]);
  });

  it('an absurd number of steps costs a bounded amount of work', () => {
    expect(sum(shiftWeights(real, Number.MAX_SAFE_INTEGER, 0.01))).toBeCloseTo(100, 8);
  });
});

describe('wholeOrders', () => {
  it.each([
    ['0', 0],
    ['0.262', 0],
    ['1', 0],
    ['9.99', 0],
    ['10', 1],
    ['99', 1],
    ['100', 2],
    ['1e50', 50],
    ['1e1000', 1000],
  ])('%s has %d whole orders', (value, orders) => {
    expect(wholeOrders(num(value))).toBe(orders);
  });

  it('negative and NaN values have none', () => {
    expect(wholeOrders(num(-500))).toBe(0);
    expect(wholeOrders(num(Number.NaN))).toBe(0);
  });
});

describe('rarity refinement buyable', () => {
  const drop: BuyableDefinition = {
    id: 'harvest',
    name: 'H',
    description: '',
    actionId: 'a',
    cost: num(1),
    effect: { kind: 'itemDrop', drop: { itemId: 'file', chance: 1, rarityWeights: { common: 1, rare: 0 } } },
  };
  /** Moves ALL weight one rarity on per order, so the effect is easy to see in the drops. */
  const refine = (fractionPerOrder = 1): BuyableDefinition => ({
    id: 'refine',
    name: 'R',
    description: '',
    actionId: 'a',
    cost: num(1),
    requires: ['harvest'],
    effect: { kind: 'rarityShiftFromProficiency', fractionPerOrder },
  });
  const game = (proficiency: string, owned = true) => {
    const config: GameConfig = createConfig(testConfig, { buyables: [...testConfig.buyables, drop, refine()] });
    const g = createGame({ config, random: seededRandom(2) });
    setCredits(g, num(100));
    g.buy('harvest');
    if (owned) expect(g.buy('refine')).toBe('purchased');
    (g.getState() as { hackingProficiency: unknown }).hackingProficiency = num(proficiency);
    return g;
  };
  const held = (g: { getState(): unknown }, rarity: string): number =>
    (g.getState() as { inventory: Record<string, Record<string, number>> }).inventory['file']?.[rarity] ?? 0;

  it('is hidden until the harvest is owned', () => {
    const g = createGame({ config: createConfig(testConfig, { buyables: [...testConfig.buyables, drop, refine()] }) });
    setCredits(g, num(100));
    expect(g.isBuyableAvailable('refine')).toBe(false);
    expect(g.buy('refine')).toBe('locked');
  });

  it('below 10 Hacking Proficiency the ratios are untouched', () => {
    const g = game('9.9');
    for (let i = 0; i < 20; i++) g.dropTestItem();
    expect(held(g, 'common')).toBe(20);
  });

  it('at 10 the first shift applies, and the drops follow the shifted ratios', () => {
    const g = game('10');
    for (let i = 0; i < 20; i++) g.dropTestItem();
    expect(held(g, 'rare')).toBe(20);
    expect(held(g, 'common')).toBe(0);
  });

  it('without the buyable proficiency changes nothing', () => {
    const g = game('1e30', false);
    for (let i = 0; i < 20; i++) g.dropTestItem();
    expect(held(g, 'common')).toBe(20);
  });

  it('follows proficiency as it grows: the ratios move when a new order of magnitude is reached', () => {
    const g = game('9');
    g.dropTestItem();
    (g.getState() as { hackingProficiency: unknown }).hackingProficiency = num(10);
    g.dropTestItem();
    expect([held(g, 'common'), held(g, 'rare')]).toEqual([1, 1]);
  });

  it('is reset by re-sleeving together with the proficiency', () => {
    const g = game('1000');
    g.resleeve();
    expect(g.ownedCount('refine')).toBe(0);
    expect(g.getState().hackingProficiency.isZero()).toBe(true);
  });

  it.each([0, -0.1, 1.5, Number.NaN])('a fractionPerOrder of %d is rejected', (fraction) => {
    const config = createConfig(testConfig, { buyables: [...testConfig.buyables, drop, refine(fraction)] });
    expect(validateConfig(config).join()).toContain('fractionPerOrder must be in (0, 1]');
  });
});
