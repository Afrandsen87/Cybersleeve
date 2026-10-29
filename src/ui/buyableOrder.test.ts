/**
 * Purchases are listed by BASE price, cheapest first, in every widget; changing a price in the content re-sorts them.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type BuyableDefinition, createConfig } from '../core';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { sortByBasePrice } from './view/buyableViews';
import { buildViewModel } from './viewModel';

const item = (id: string, cost: number, extra: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  cost: num(cost),
  effect: { kind: 'accessLevel', amount: 1 },
  ...extra,
});

describe('sortByBasePrice', () => {
  it('orders by price and keeps the configured order between equal prices', () => {
    const sorted = sortByBasePrice([item('c', 5), item('a', 1), item('b', 5), item('d', 1)]);
    expect(sorted.map((b) => b.id)).toEqual(['a', 'd', 'c', 'b']);
  });

  it('does not change the list it is given', () => {
    const list = [item('x', 9), item('y', 1)];
    sortByBasePrice(list);
    expect(list.map((b) => b.id)).toEqual(['x', 'y']);
  });
});

describe('the order on screen follows the base price in the content', () => {
  const cardOrder = (prices: [number, number, number]) => {
    const [a, b, c] = prices;
    const config = createConfig(testConfig, {
      buyables: [item('one', a, { actionId: 'a' }), item('two', b, { actionId: 'a' }), item('three', c, { actionId: 'a' })],
    });
    return buildViewModel(createGame({ config })).actions[0]!.buyables.map((v) => v.id);
  };

  it('puts the cheapest first, and re-sorts when a price is edited', () => {
    expect(cardOrder([30, 10, 20])).toEqual(['two', 'three', 'one']);
    expect(cardOrder([10, 20, 30])).toEqual(['one', 'two', 'three']);
  });

  it('sorts by the base price, not by what the next copy costs (cost growth does not reorder)', () => {
    const config = createConfig(testConfig, {
      buyables: [item('cheap', 1, { actionId: 'a', costGrowth: 1_000, maxPurchases: 5 }), item('dear', 5, { actionId: 'a' })],
    });
    const g = createGame({ config });
    (g.getState() as unknown as { wallet: { credits: unknown } }).wallet.credits = num(1e9);
    g.buy('cheap');
    g.buy('cheap');
    expect(buildViewModel(g).actions[0]!.buyables.map((v) => v.id)).toEqual(['cheap', 'dear']);
  });
});
