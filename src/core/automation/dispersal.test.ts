/** Automation context: equal allocation, allowed rarities and closed-form batch invariants. */
import { describe, expect, it } from 'vitest';
import { applied, dispersalGame, dispersalState } from '../../testing/dispersalKit';

/** Automation context: selects both available fixture actions. Called by: allocation tests. Calls: setDispersalTarget. */
function selectBoth(g: ReturnType<typeof dispersalGame>): void {
  expect(g.automation().setDispersalTarget('a', true)).toBe(true);
  expect(g.automation().setDispersalTarget('b', true)).toBe(true);
}
describe('augment dispersal allocation', () => {
  it('splits evenly with a configuration-order remainder and consumes no schematic twice', () => {
    const g = dispersalGame(2, { common: 5 });
    selectBoth(g);
    g.tick(1);
    expect([applied(g, 'a'), applied(g, 'b')]).toEqual([3, 2]);
    expect(dispersalState(g).wallet.inventory['schem']?.['common'] ?? 0).toBe(0);
  });
  it('one schematic per step balances between selected actions', () => {
    const g = dispersalGame();
    selectBoth(g);
    for (let i = 0; i < 10; i++) {
      dispersalState(g).wallet.inventory['schem'] = { common: 1 };
      g.tick(1);
    }
    expect([applied(g, 'a'), applied(g, 'b')]).toEqual([5, 5]);
  });
  it('leaves forbidden rarities held, including a lower rarity skipped between permitted ones', () => {
    const g = dispersalGame(2, { common: 2, uncommon: 3, rare: 4 });
    dispersalState(g).sleeve.purchased['skill-dispersal-6'] = 1;
    selectBoth(g);
    g.tick(1);
    expect(applied(g, 'a') + applied(g, 'b')).toBe(6);
    expect(dispersalState(g).wallet.inventory['schem']?.['uncommon']).toBe(3);
    expect(g.getState().sleeve.actions['a']!.augments).toEqual({ common: 2, rare: 1 });
    expect(g.getState().sleeve.actions['b']!.augments).toEqual({ rare: 3 });
  });
  it('applies allowed rarities most-common-first and keeps rarity identity', () => {
    const g = dispersalGame(8, { common: 2, uncommon: 1, rare: 1, legendary: 1, crisis: 3 });
    g.automation().setDispersalTarget('a', true);
    g.tick(1);
    expect(g.getState().sleeve.actions['a']!.augments).toEqual({ common: 2, uncommon: 1, rare: 1, legendary: 1 });
    expect(dispersalState(g).wallet.inventory['schem']?.['crisis']).toBe(3);
  });
  it('with zero held or no targets changes nothing', () => {
    const g = dispersalGame();
    selectBoth(g);
    g.tick(1);
    expect([applied(g, 'a'), applied(g, 'b')]).toEqual([0, 0]);
    g.automation().setDispersalTarget('a', false);
    g.automation().setDispersalTarget('b', false);
    dispersalState(g).wallet.inventory['schem'] = { common: 4 };
    g.tick(1);
    expect(dispersalState(g).wallet.inventory['schem']).toEqual({ common: 4 });
  });
  it('one long step and many short steps agree for a held batch', () => {
    const long = dispersalGame(8, { common: 5, rare: 4 });
    const short = dispersalGame(8, { common: 5, rare: 4 });
    selectBoth(long);
    selectBoth(short);
    long.tick(5000);
    for (let i = 0; i < 50; i++) short.tick(100);
    expect(short.getState().sleeve.actions['a']!.augments).toEqual(long.getState().sleeve.actions['a']!.augments);
    expect(short.getState().sleeve.actions['b']!.augments).toEqual(long.getState().sleeve.actions['b']!.augments);
    expect(short.getState().wallet.inventory).toEqual(long.getState().wallet.inventory);
  });
});
