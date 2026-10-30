/**
 * The seen-items set (`wallet.seenItems`): every way an item enters the inventory records it, a re-sleeve keeps it, a save round-trips it.
 *
 * Called by: vitest. Calls: `Inventory`, `ZeroDays`, `applyCorporationEffect`, `resetForResleeve`, the save functions, the test config.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { seededGame } from '../../testing/gameKit';
import { findInvariantViolations } from '../../testing/invariants';
import { seededRandom } from '../../testing/random';
import { testConfig } from '../../testing/testConfig';
import { applyCorporationEffect, createConfig, deserializeState, serializeState } from '..';
import { ZeroDays } from '../crits/zeroDays';
import { createInitialState, resetForResleeve } from '../save/state';
import { Inventory, hasSeenItem } from './inventory';

const config = createConfig(testConfig, {
  items: {
    rarities: [...testConfig.items.rarities, { id: 'epic', name: 'Epic', sellValue: num(1000) }],
    definitions: [
      { id: 'file', name: 'File' },
      { id: 'ak', name: 'Admin key', sellable: false, hasRarity: false },
      { id: 'sh', name: 'Skill shard', sellable: false, hasRarity: false },
    ],
    adminKey: { itemId: 'ak', actionId: 'a', shard: { itemId: 'sh', chance: 1 } },
    skillShard: { itemId: 'sh', levelsDelayed: 1 },
  },
});

const fresh = () => {
  const state = createInitialState(config, numberFactory);
  return { state, inv: new Inventory(config, state, numberFactory) };
};

describe('seen items: the one writer', () => {
  it('a new game has seen nothing', () => {
    const { state } = fresh();
    expect(state.wallet.seenItems).toEqual({});
    expect(hasSeenItem(state, 'file', 'common')).toBe(false);
  });

  it('adding marks exactly that item and rarity as seen, and it stays seen when the stack is used up', () => {
    const { state, inv } = fresh();
    inv.add('file', 'rare', 2);
    expect(hasSeenItem(state, 'file', 'rare')).toBe(true);
    expect(hasSeenItem(state, 'file', 'common')).toBe(false);
    inv.take('file', 'rare', 'all');
    expect(hasSeenItem(state, 'file', 'rare')).toBe(true);
  });

  it('an item without rarity is seen under the first rarity (addFirst wraps add)', () => {
    const { state, inv } = fresh();
    inv.addFirst('ak', 1);
    expect(hasSeenItem(state, 'ak', 'common')).toBe(true);
  });

  it('adding nothing, a negative or NaN count, or an unknown item or rarity marks nothing', () => {
    const { state, inv } = fresh();
    for (const count of [0, -3, Number.NaN]) inv.add('file', 'common', count);
    inv.add('ghost', 'common', 1);
    inv.add('file', 'ghost', 1);
    expect(state.wallet.seenItems).toEqual({});
  });
});

describe('seen items: every way an item enters', () => {
  it('a drop from a run', () => {
    const drop = {
      id: 'dr',
      name: 'Dr',
      description: '',
      actionId: 'a',
      cost: num(1),
      effect: { kind: 'itemDrop', drop: { itemId: 'file', chance: 1, rarityWeights: { rare: 1 } } },
    } as const;
    const g = seededGame(createConfig(config, { buyables: [...config.buyables, drop] }), 1, ['auto', 'dr']);
    expect(hasSeenItem(g.getState(), 'file', 'rare')).toBe(false);
    g.startAction('a');
    g.tick(10_001);
    expect(g.getState().wallet.inventory['file']?.['rare']).toBeGreaterThan(0);
    expect(hasSeenItem(g.getState(), 'file', 'rare')).toBe(true);
    expect(findInvariantViolations(g.getState(), g.getConfig())).toEqual([]);
  });

  it('the bonus Skill shard of an Admin key', () => {
    const { state, inv } = fresh();
    inv.addFirst('ak', 1);
    const keys = new ZeroDays(config, state, inv, 'adminKey', seededRandom(1));
    expect(hasSeenItem(state, 'sh', 'common')).toBe(false);
    keys.toggle();
    expect(keys.claim('a', 1)).toBe(1);
    expect(hasSeenItem(state, 'sh', 'common')).toBe(true);
  });

  it('a Corporation rarity upgrade marks the higher rarity', () => {
    const { state, inv } = fresh();
    inv.add('file', 'common', 1);
    applyCorporationEffect({ kind: 'upgradeRandomItem', itemId: 'file', chance: 1 }, 1, {
      state,
      inventory: inv,
      random: seededRandom(1),
      rarityIds: ['common', 'rare', 'epic'],
    });
    expect(state.wallet.inventory['file']?.['rare']).toBe(1);
    expect(hasSeenItem(state, 'file', 'rare')).toBe(true);
  });
});

describe('seen items: re-sleeve and save', () => {
  it('a re-sleeve empties the inventory but keeps what was seen', () => {
    const { state, inv } = fresh();
    inv.add('file', 'epic', 3);
    resetForResleeve(state, config, numberFactory);
    expect(state.wallet.inventory).toEqual({});
    expect(hasSeenItem(state, 'file', 'epic')).toBe(true);
  });

  it('a save round trip keeps the set, and writes only true flags of known items and rarities', () => {
    const { state, inv } = fresh();
    inv.add('file', 'rare', 1);
    inv.addFirst('sh', 1);
    const back = deserializeState(serializeState(state), config, numberFactory)!;
    expect(back.wallet.seenItems).toEqual({ file: { rare: true }, sh: { common: true } });
    expect(serializeState(back)).toBe(serializeState(state));
  });

  it('a save without the field loads as empty, and malformed entries are dropped', () => {
    const { state, inv } = fresh();
    inv.add('file', 'rare', 1);
    const data = JSON.parse(serializeState(state)) as { wallet: Record<string, unknown> };
    delete data.wallet['seenItems'];
    const load = (): unknown => deserializeState(JSON.stringify(data), config, numberFactory)!.wallet.seenItems;
    expect(load()).toEqual({});
    data.wallet['seenItems'] = { file: { rare: 'yes', ghost: true, common: true }, ghost: { common: true } };
    expect(load()).toEqual({ file: { common: true } });
    data.wallet['seenItems'] = 5;
    expect(load()).toEqual({});
  });
});
