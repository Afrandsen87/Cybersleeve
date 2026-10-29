import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { dropShare } from './drops';
import { Inventory } from './inventory';
import { createInitialState } from '../save/state';
import type { ItemDropRule } from '../types';

const inventory = (rarities = testConfig.items.rarities) => {
  const state = createInitialState(testConfig, numberFactory);
  return { state, inv: new Inventory({ items: { ...testConfig.items, rarities } }, state, numberFactory) };
};

describe('Inventory first-stack helpers', () => {
  it('addFirst / heldFirst / takeFirst work on the stack under the first rarity', () => {
    const { state, inv } = inventory();
    const first = testConfig.items.rarities[0]!.id;
    const item = testConfig.items.definitions[0]!.id;
    inv.addFirst(item, 5);
    expect(inv.heldFirst(item)).toBe(5);
    expect(state.wallet.inventory[item]?.[first]).toBe(5);
    expect(inv.takeFirst(item, 2)).toBe(2);
    expect(inv.takeFirst(item, 'all')).toBe(3);
    expect(inv.takeFirst(item, 1)).toBe(0);
  });

  it('ignores bad counts and unknown items, and does nothing when there are no rarities', () => {
    const { inv } = inventory();
    inv.addFirst('ghost', 5);
    inv.addFirst(testConfig.items.definitions[0]!.id, -3);
    expect(inv.heldFirst('ghost')).toBe(0);
    const empty = inventory([]);
    empty.inv.addFirst(testConfig.items.definitions[0]!.id, 5);
    expect(empty.inv.heldFirst(testConfig.items.definitions[0]!.id)).toBe(0);
    expect(empty.inv.takeFirst(testConfig.items.definitions[0]!.id, 'all')).toBe(0);
  });

  it('createGame still builds (the helpers are wired into the engine)', () => {
    expect(createGame({ config: testConfig }).getState().wallet.inventory).toBeDefined();
  });
});

describe('dropShare', () => {
  const rule = (chance: number, rarityWeights?: Record<string, number>): ItemDropRule => ({ itemId: 'x', chance, rarityWeights });

  it('splits the chance by the normalised weights', () => {
    expect(dropShare(rule(0.5, { a: 3, b: 1 }), 'a', 'a')).toBeCloseTo(0.375, 12);
    expect(dropShare(rule(0.5, { a: 3, b: 1 }), 'b', 'a')).toBeCloseTo(0.125, 12);
  });

  it('is 0 for a rarity without weight, for all-zero weights, and for NaN-free input only', () => {
    expect(dropShare(rule(0.5, { a: 1 }), 'z', 'a')).toBe(0);
    expect(dropShare(rule(0.5, { a: 0, b: 0 }), 'a', 'a')).toBe(0);
  });

  it('an item without rarity is all in the first rarity', () => {
    expect(dropShare(rule(0.2), 'a', 'a')).toBe(0.2);
    expect(dropShare(rule(0.2), 'b', 'a')).toBe(0);
  });
});
