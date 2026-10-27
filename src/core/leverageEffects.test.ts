import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { createConfig, validateConfig } from './index';
import { resolveBackChannel, resolveRarityWeightBonus } from './leverageEffects';
import { inert, mutable, skill, skillGame, withSkills } from './skillsKit';

const RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'crisis'];
const channel = skill('ch', { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 2 }, 0);
const scaling = skill('sc', { kind: 'backChannelRarityScaling', itemId: 'file' }, 0);
const double = skill('dbl', { kind: 'backChannelMultiplier', itemId: 'file', factor: 2 }, 0);
const owned = (...skills: { id: string }[]) => Object.fromEntries(skills.map((s) => [s.id, 1]));

describe('resolveBackChannel', () => {
  it('is null without a back channel, even with the other channel skills', () => {
    expect(resolveBackChannel([channel, scaling, double], { purchased: owned(scaling, double) }, RARITIES)).toBeNull();
  });

  it('opens only its own rarity at molesPerItem', () => {
    const rule = resolveBackChannel([channel], { purchased: owned(channel) }, RARITIES)!;
    expect(rule.molesByRarity).toEqual({ common: 5 });
    expect(rule.cooldownBoost).toBe(2);
  });

  it('with rarity scaling every rarity is open and worth molesPerItem times its position: common x1, uncommon x2, rare x3', () => {
    const rule = resolveBackChannel([channel, scaling], { purchased: owned(channel, scaling) }, RARITIES)!;
    expect(rule.molesByRarity).toEqual({ common: 5, uncommon: 10, rare: 15, legendary: 20, crisis: 25 });
  });

  it('the multiplier doubles whatever each rarity pays, with or without scaling', () => {
    const plain = resolveBackChannel([channel, double], { purchased: owned(channel, double) }, RARITIES)!;
    expect(plain.molesByRarity).toEqual({ common: 10 });
    const both = resolveBackChannel([channel, scaling, double], { purchased: owned(channel, scaling, double) }, RARITIES)!;
    expect(both.molesByRarity).toEqual({ common: 10, uncommon: 20, rare: 30, legendary: 40, crisis: 50 });
  });

  it('ignores skills for another item', () => {
    const other = skill('o', { kind: 'backChannelMultiplier', itemId: 'other', factor: 2 }, 0);
    expect(resolveBackChannel([channel, other], { purchased: owned(channel, other) }, RARITIES)!.molesByRarity).toEqual({ common: 5 });
  });
});

describe('resolveRarityWeightBonus', () => {
  it('adds the amount of every owned copy for the item, and nothing for another item', () => {
    const bonus = skill('b', { kind: 'rarityWeightBonus', itemId: 'file', amount: 0.01 });
    expect(resolveRarityWeightBonus([bonus], { purchased: {} }, 'file')).toBe(0);
    expect(resolveRarityWeightBonus([bonus], { purchased: { b: 1 } }, 'file')).toBeCloseTo(0.01, 12);
    expect(resolveRarityWeightBonus([bonus], { purchased: { b: 1 } }, 'other')).toBe(0);
  });
});

describe('the leverage skills in a game', () => {
  const items = {
    rarities: RARITIES.map((id, i) => ({ id, name: id, sellValue: num(i + 1) })),
    definitions: [{ id: 'file', name: 'F' }],
  };
  const drop = {
    id: 'drop',
    name: 'Drop',
    description: '',
    currency: 'credits' as const,
    cost: num(0),
    actionId: 'a',
    effect: {
      kind: 'itemDrop' as const,
      drop: { itemId: 'file', chance: 0.5, rarityWeights: { common: 90, uncommon: 9, rare: 1, legendary: 0, crisis: 0 } },
    },
  };
  const game = (...skills: ReturnType<typeof skill>[]) => {
    const g = skillGame({
      config: createConfig(testConfig, {
        actions: [...testConfig.actions, inert],
        items,
        buyables: [...testConfig.buyables, drop, ...skills],
      }),
    });
    (g.getState().purchased as Record<string, number>)['drop'] = 1;
    return g;
  };

  it('a flat bonus lets the rarities that weigh 0 drop, and leaves the chance of a drop at all alone', () => {
    const g = game(skill('b', { kind: 'rarityWeightBonus', itemId: 'file', amount: 0.01 }));
    expect(g.dropSources('file', 'crisis')).toEqual([]);
    g.buy('b');
    const [crisis] = g.dropSources('file', 'crisis');
    expect(crisis!.chance).toBeCloseTo((0.5 * 0.01) / 100.05, 12);
    const [common] = g.dropSources('file', 'common');
    expect(common!.chance).toBeCloseTo((0.5 * 90.01) / 100.05, 12);
  });

  it('giving up files pays the Moles of the rarity, and only for rarities the channel is open to', () => {
    const g = game(channel, scaling, double);
    mutable(g).inventory = { file: { common: 2, rare: 1 } };
    g.buy('ch');
    expect(g.giveUpForMoles('file', 'rare', 1)).toBe(0); // not open yet
    g.buy('sc');
    g.buy('dbl');
    expect(g.giveUpForMoles('file', 'rare', 1)).toBe(1);
    expect(g.getState().moles).toBe(30); // 5 x 3 (rare) x 2
    expect(g.giveUpForMoles('file', 'common', 'all')).toBe(2);
    expect(g.getState().moles).toBe(50); // + 2 x 5 x 1 x 2
  });

  it('validates its numbers and items', () => {
    const bad = withSkills([
      skill('x', { kind: 'rarityWeightBonus', itemId: 'nope', amount: 0 }),
      skill('y', { kind: 'backChannelMultiplier', itemId: 'file', factor: 0.5 }),
      skill('z', { kind: 'backChannelRarityScaling', itemId: 'nope' }),
    ]);
    expect(validateConfig(bad).length).toBeGreaterThanOrEqual(4);
  });
});
