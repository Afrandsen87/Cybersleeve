import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { seededRandom } from '../../testing/random';
import { setCredits, setSleeveXp, testConfig } from '../../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig } from '..';
import { asSave, flatSave } from '../../testing/saveKit';

/** Test content: the corporation is open; a purchase of action `c1` gives its runs a 100% (or `chance`) chance to acquire a stock. */
const contentWith = (chance: number) =>
  createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      { id: 'levels', name: 'Levels', description: '', cost: num(1), effect: { kind: 'unlockSleeveLevels' } },
      { id: 'inc', name: 'Inc', description: '', cost: num(1), effect: { kind: 'unlocksCorporation' } },
      {
        id: 'stock',
        name: 'Stock',
        description: '',
        corporationActionId: 'c1',
        cost: num(10),
        effect: { kind: 'addsCorporationEffect', effect: { kind: 'acquireStock', chance } },
      },
    ],
    corporation: {
      actions: [
        { id: 'c1', name: 'C1', baseDurationMs: 1000, effects: [] },
        { id: 'c2', name: 'C2', baseDurationMs: 1000, effects: [] },
      ],
    },
  });

const open = (chance = 1) => {
  const g = createGame({ config: contentWith(chance), random: seededRandom(1) });
  (g.getState().sleeve.purchased as Record<string, number>)['inc'] = 1;
  return g;
};

const runOnce = (g: ReturnType<typeof open>, id = 'c1'): void => {
  g.startCorporationAction(id);
  g.tick(1000);
};

describe('the stock a corporation run can acquire', () => {
  it('nothing is acquired before the purchase is owned', () => {
    const g = open();
    runOnce(g);
    expect(g.corporationStocks()).toBe(0);
  });

  it('once owned, a completed run of its action acquires a stock (chance 1), and a run of another action does not', () => {
    const g = open();
    setCredits(g, num(10));
    expect(g.buy('stock')).toBe('purchased');
    runOnce(g);
    runOnce(g);
    expect(g.corporationStocks()).toBe(2);
    runOnce(g, 'c2');
    expect(g.corporationStocks()).toBe(2);
  });

  it('a run that has not finished acquires nothing', () => {
    const g = open();
    setCredits(g, num(10));
    g.buy('stock');
    g.startCorporationAction('c1');
    g.tick(500);
    expect(g.corporationStocks()).toBe(0);
  });

  it('the chance is a chance: over many runs about that share acquires a stock', () => {
    const g = open(0.5);
    setCredits(g, num(10));
    g.buy('stock');
    for (let i = 0; i < 400; i++) runOnce(g);
    expect(g.corporationStocks()).toBeGreaterThan(150);
    expect(g.corporationStocks()).toBeLessThan(250);
  });

  it('the stocks and the purchase are kept through re-sleeving, and the stocks are saved', () => {
    const g = open();
    setSleeveXp(g, num(1e6));
    setCredits(g, num(12));
    g.buy('levels');
    g.buy('stock');
    runOnce(g);
    g.tick(10_000);
    expect(g.resleeve()).toBe(true);
    expect(g.ownedCount('stock')).toBe(1);
    expect(g.corporationStocks()).toBe(1);
    const back = deserializeState(serializeState(g.getState()), contentWith(1), numberFactory)!;
    expect(back.wallet.corporation.stocks).toBe(1);
  });

  it('a save without stocks, or with a bad count, reads as 0', () => {
    const g = open();
    const raw = flatSave(serializeState(g.getState()));
    for (const bad of [undefined, -3, 1.5, 'x', null]) {
      raw.corporation.stocks = bad;
      expect(deserializeState(asSave(raw), contentWith(1), numberFactory)!.wallet.corporation.stocks).toBe(0);
    }
  });

  it('is validated: a chance in (0, 1], a known corporation action, and not both kinds of action', () => {
    const base = contentWith(1);
    const stock = base.buyables.find((b) => b.id === 'stock')!;
    const check = (patch: object) =>
      validateConfig(createConfig(base, { buyables: [...base.buyables.filter((b) => b.id !== 'stock'), { ...stock, ...patch }] }));
    expect(check({})).toEqual([]);
    expect(check({ effect: { kind: 'addsCorporationEffect', effect: { kind: 'acquireStock', chance: 0 } } })).toEqual(
      expect.arrayContaining([expect.stringContaining('acquireStock chance')]),
    );
    expect(check({ corporationActionId: 'nope' })).toEqual(expect.arrayContaining([expect.stringContaining('unknown corporation action')]));
    expect(check({ corporationActionId: undefined })).toEqual(
      expect.arrayContaining([expect.stringContaining('needs a corporationActionId')]),
    );
    expect(check({ actionId: 'a' })).toEqual(expect.arrayContaining([expect.stringContaining('both a character action')]));
  });
});
