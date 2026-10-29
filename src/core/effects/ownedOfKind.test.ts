import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { buy } from '../../testing/cyberneticsKit';
import { effectsOfKind, ownedEffects, ownsKind } from './ownedOfKind';

const buyables = [
  buy({ id: 'a', effect: { kind: 'autoRepurchase' } }),
  buy({ id: 'b', effect: { kind: 'unlocksCorporation' }, cost: num(5) }),
];

describe('ownsKind', () => {
  it('is false when nothing is owned', () => {
    expect(ownsKind(buyables, {}, 'autoRepurchase')).toBe(false);
  });

  it('is true only for the kind of an owned buyable', () => {
    expect(ownsKind(buyables, { a: 1 }, 'autoRepurchase')).toBe(true);
    expect(ownsKind(buyables, { a: 1 }, 'unlocksCorporation')).toBe(false);
  });

  it('treats a count of 0 or a negative count as not owned', () => {
    expect(ownsKind(buyables, { a: 0, b: -1 }, 'autoRepurchase')).toBe(false);
    expect(ownsKind(buyables, { b: -1 }, 'unlocksCorporation')).toBe(false);
  });

  it('is false for a kind no buyable has', () => {
    expect(ownsKind([], { a: 1 }, 'autoRepurchase')).toBe(false);
  });
});

describe('effectsOfKind / ownedEffects', () => {
  const rank = (id: string, amount: number) => buy({ id, effect: { kind: 'corporateRank', amount } });
  const ranks = [rank('r1', 1), buyables[0]!, rank('r2', 2)];

  it('effectsOfKind lists every buyable of the kind in configuration order, narrowed, with nothing owned', () => {
    const found = effectsOfKind(ranks, 'corporateRank');
    expect(found.map((k) => [k.buyable.id, k.effect.amount, k.owned])).toEqual([
      ['r1', 1, 0],
      ['r2', 2, 0],
    ]);
  });

  it('ownedEffects keeps only owned copies and carries the count', () => {
    expect(ownedEffects(ranks, { r2: 3, a: 1 }, 'corporateRank').map((k) => [k.buyable.id, k.owned])).toEqual([['r2', 3]]);
  });

  it('ownedEffects ignores zero and negative counts and kinds nobody has', () => {
    expect(ownedEffects(ranks, { r1: 0, r2: -2 }, 'corporateRank')).toEqual([]);
    expect(ownedEffects([], { r1: 1 }, 'corporateRank')).toEqual([]);
    expect(effectsOfKind(ranks, 'unlocksCorporation')).toEqual([]);
  });
});
