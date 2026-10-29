import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { networkAction, setCredits, testConfig } from '../../testing/testConfig';
import { type BuyableDefinition, createConfig, type GameConfig, type ItemDropRule } from '..';

const drop = (
  id: string,
  actionId: string,
  rule: Partial<ItemDropRule> & { rarityWeights?: ItemDropRule['rarityWeights'] },
): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  actionId,
  cost: num(1),
  effect: { kind: 'itemDrop', drop: { itemId: 'file', chance: 0.2, ...rule } },
});

/** Test items: `file` (common and rare) and `tool`, an item without rarity. Actions: `a` and `net`. */
function configWith(extra: BuyableDefinition[]): GameConfig {
  return createConfig(testConfig, {
    actions: [testConfig.actions[0]!, networkAction],
    buyables: [...testConfig.buyables, ...extra],
    items: {
      ...testConfig.items,
      definitions: [...testConfig.items.definitions, { id: 'tool', name: 'Tool', hasRarity: false }],
    },
  });
}

function game(extra: BuyableDefinition[], own: string[] = extra.map((b) => b.id)) {
  const g = createGame({ config: configWith(extra) });
  setCredits(g, num(1e6));
  for (const id of own) expect(g.buy(id)).toBe('purchased');
  return g;
}

describe('DerivedStats.dropSources', () => {
  it('is empty while nothing that drops the item is owned', () => {
    const g = game([drop('d', 'a', { rarityWeights: { common: 1 } })], []);
    expect(g.dropSources('file', 'common')).toEqual([]);
  });

  it('is the drop chance times the share of the rarity in the ratios', () => {
    const g = game([drop('d', 'a', { chance: 0.2, rarityWeights: { common: 3, rare: 1 } })]);
    expect(g.dropSources('file', 'common')).toEqual([{ actionId: 'a', chance: expect.closeTo(0.15, 12) }]);
    expect(g.dropSources('file', 'rare')).toEqual([{ actionId: 'a', chance: expect.closeTo(0.05, 12) }]);
  });

  it('leaves out a rarity with no share, and an item that is not dropped', () => {
    const g = game([drop('d', 'a', { rarityWeights: { common: 1 } })]);
    expect(g.dropSources('file', 'rare')).toEqual([]);
    expect(g.dropSources('tool', 'common')).toEqual([]);
  });

  it('lists every action that can drop the stack, in configuration order, each with its own chance', () => {
    const g = game([
      drop('d-net', 'net', { chance: 0.5, rarityWeights: { common: 1 } }),
      drop('d-a', 'a', { chance: 0.1, rarityWeights: { common: 1 } }),
    ]);
    expect(g.dropSources('file', 'common')).toEqual([
      { actionId: 'a', chance: 0.1 },
      { actionId: 'net', chance: 0.5 },
    ]);
  });

  it('two rules of one action for the same stack add up', () => {
    const g = game([
      drop('d1', 'a', { chance: 0.1, rarityWeights: { common: 1 } }),
      drop('d2', 'a', { chance: 0.25, rarityWeights: { common: 1 } }),
    ]);
    expect(g.dropSources('file', 'common')).toEqual([{ actionId: 'a', chance: expect.closeTo(0.35, 12) }]);
  });

  it('an item without rarity is one stack: its whole chance, under the first rarity only', () => {
    const g = game([drop('t', 'a', { itemId: 'tool', chance: 0.05, rarityWeights: undefined })]);
    expect(g.dropSources('tool', 'common')).toEqual([{ actionId: 'a', chance: 0.05 }]);
    expect(g.dropSources('tool', 'rare')).toEqual([]);
  });

  it('follows the buyables that change the chance: a multiplier doubles it, never above 1', () => {
    const multiplier: BuyableDefinition = {
      id: 'nose',
      name: 'Nose',
      description: '',
      cost: num(1),
      maxPurchases: 5,
      effect: { kind: 'itemDropChanceMultiplier', itemId: 'file', factor: 2 },
    };
    const g = game([drop('d', 'a', { chance: 0.3, rarityWeights: { common: 1 } }), multiplier], ['d', 'nose']);
    expect(g.dropSources('file', 'common')).toEqual([{ actionId: 'a', chance: 0.6 }]);
    g.buy('nose');
    expect(g.dropSources('file', 'common')).toEqual([{ actionId: 'a', chance: 1 }]);
  });

  it('follows Hacking Proficiency through a rarity shift: a share moves from the common to the rare stack', () => {
    const shift: BuyableDefinition = {
      id: 'shift',
      name: 'Shift',
      description: '',
      actionId: 'a',
      cost: num(1),
      effect: { kind: 'rarityShiftFromProficiency', fractionPerOrder: 0.5 },
    };
    const g = game([drop('d', 'a', { chance: 1, rarityWeights: { common: 1 } }), shift]);
    expect(g.dropSources('file', 'rare')).toEqual([]);
    (g.getState() as unknown as { sleeve: { hackingProficiency: unknown } }).sleeve.hackingProficiency = num(10); // one order of magnitude: one shift
    expect(g.dropSources('file', 'common')).toEqual([{ actionId: 'a', chance: 0.5 }]);
    expect(g.dropSources('file', 'rare')).toEqual([{ actionId: 'a', chance: 0.5 }]);
  });

  it('the chances of all the stacks of one rule add up to the chance of the rule', () => {
    const g = game([drop('d', 'a', { chance: 0.2, rarityWeights: { common: 7, rare: 3 } })]);
    const total = ['common', 'rare'].reduce((sum, r) => sum + (g.dropSources('file', r)[0]?.chance ?? 0), 0);
    expect(total).toBeCloseTo(0.2, 12);
  });
});
