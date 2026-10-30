import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { seededRandom } from '../../testing/random';
import { setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, proficiencySteps, shiftWeights, shiftWeightsBySteps, validateConfig, wholeOrders, type BuyableDefinition, type GameConfig } from '..';

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

describe('proficiencySteps', () => {
  const steps = (value: string | number, base = 2) => proficiencySteps(num(value), base, numberFactory);

  it('is log of (1 + proficiency) in the step base, so low proficiency already counts', () => {
    expect(steps(0)).toBe(0);
    expect(steps(1)).toBeCloseTo(1, 10);
    expect(steps(3)).toBeCloseTo(2, 10);
    expect(steps(4)).toBeCloseTo(Math.log2(5), 10);
    expect(steps(99, 10)).toBeCloseTo(2, 10);
  });

  it('never decreases as proficiency grows', () => {
    let previous = 0;
    for (const value of [0, 0.5, 1, 2, 5, 10, 100, 1e6, 1e30, 1e300]) {
      const now = steps(value);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it('zero, negatives and NaN give 0; an infinite value is clamped to a finite cap', () => {
    for (const value of [0, -5, Number.NaN]) expect(steps(value)).toBe(0);
    expect(Number.isFinite(steps('1e1000'))).toBe(true);
    expect(Number.isFinite(steps(Number.POSITIVE_INFINITY))).toBe(true);
  });
});

describe('shiftWeightsBySteps', () => {
  const real = [90, 9, 1, 0, 0];

  it('whole steps equal shiftWeights', () => {
    expect(shiftWeightsBySteps(real, 2, 0.05)).toEqual(shiftWeights(real, 2, 0.05));
  });

  it('a fractional rest is one more shift of fraction x rest, so it lies between the whole steps', () => {
    const half = shiftWeightsBySteps(real, 1.5, 0.05);
    expect(half[0]!).toBeLessThan(shiftWeights(real, 1, 0.05)[0]!);
    expect(half[0]!).toBeGreaterThan(shiftWeights(real, 2, 0.05)[0]!);
    expect(sum(half)).toBeCloseTo(100, 10);
  });

  it('at proficiency 4 (base 2, 0.05) the common weight falls from 90 to about 80 and uncommon rises to about 19', () => {
    const shifted = shiftWeightsBySteps(real, Math.log2(5), 0.05);
    expect(shifted[0]!).toBeGreaterThan(79);
    expect(shifted[0]!).toBeLessThan(82);
    expect(shifted[1]!).toBeGreaterThan(17);
    expect(shifted[1]!).toBeLessThan(20);
  });

  it('the last rarity never shrinks as steps grow continuously', () => {
    let previous = 0;
    for (let s = 0; s <= 60; s += 0.37) {
      const last = shiftWeightsBySteps(real, s, 0.05)[4]!;
      expect(last).toBeGreaterThanOrEqual(previous);
      previous = last;
    }
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
  const refine = (fractionPerStep = 1, stepBase = 10): BuyableDefinition => ({
    id: 'refine',
    name: 'R',
    description: '',
    actionId: 'a',
    cost: num(1),
    requires: ['harvest'],
    effect: { kind: 'rarityShiftFromProficiency', fractionPerStep, stepBase },
  });
  const game = (proficiency: string, owned = true) => {
    const config: GameConfig = createConfig(testConfig, { buyables: [...testConfig.buyables, drop, refine()] });
    const g = createGame({ config, random: seededRandom(2) });
    setCredits(g, num(100));
    g.buy('harvest');
    if (owned) expect(g.buy('refine')).toBe('purchased');
    (g.getState() as unknown as { sleeve: { hackingProficiency: unknown } }).sleeve.hackingProficiency = num(proficiency);
    return g;
  };
  const held = (g: { getState(): unknown }, rarity: string): number =>
    (g.getState() as unknown as { wallet: { inventory: Record<string, Record<string, number>> } }).wallet.inventory['file']?.[rarity] ?? 0;

  it('is hidden until the harvest is owned', () => {
    const g = createGame({ config: createConfig(testConfig, { buyables: [...testConfig.buyables, drop, refine()] }) });
    setCredits(g, num(100));
    expect(g.isBuyableAvailable('refine')).toBe(false);
    expect(g.buy('refine')).toBe('locked');
  });

  it('with no Hacking Proficiency the ratios are untouched', () => {
    const g = game('0');
    for (let i = 0; i < 20; i++) g.dropTestItem();
    expect(held(g, 'common')).toBe(20);
  });

  it('at 9 (one step of base 10) the first shift applies, and the drops follow the shifted ratios', () => {
    const g = game('9');
    for (let i = 0; i < 20; i++) g.dropTestItem();
    expect(held(g, 'rare')).toBe(20);
    expect(held(g, 'common')).toBe(0);
  });

  it('without the buyable proficiency changes nothing', () => {
    const g = game('1e30', false);
    for (let i = 0; i < 20; i++) g.dropTestItem();
    expect(held(g, 'common')).toBe(20);
  });

  it('follows proficiency as it grows: the ratios move once a step is reached', () => {
    const g = game('0');
    g.dropTestItem();
    (g.getState() as unknown as { sleeve: { hackingProficiency: unknown } }).sleeve.hackingProficiency = num(9);
    g.dropTestItem();
    expect([held(g, 'common'), held(g, 'rare')]).toEqual([1, 1]);
  });

  it('is reset by re-sleeving together with the proficiency', () => {
    const g = game('1000');
    g.resleeve();
    expect(g.ownedCount('refine')).toBe(0);
    expect(g.getState().sleeve.hackingProficiency.isZero()).toBe(true);
  });

  it.each([0, -0.1, 1.5, Number.NaN])('a fractionPerStep of %d is rejected', (fraction) => {
    const config = createConfig(testConfig, { buyables: [...testConfig.buyables, drop, refine(fraction)] });
    expect(validateConfig(config).join()).toContain('fractionPerStep must be in (0, 1]');
  });

  it.each([1, 0.5, 0, Number.NaN])('a stepBase of %d is rejected', (base) => {
    const config = createConfig(testConfig, { buyables: [...testConfig.buyables, drop, refine(0.5, base)] });
    expect(validateConfig(config).join()).toContain('stepBase must be > 1');
  });
});
