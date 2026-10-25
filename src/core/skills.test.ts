import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { seededRandom } from '../testing/random';
import { testConfig } from '../testing/testConfig';
import {
  coolHeat,
  coolHeatBoosted,
  createConfig,
  earnedSkillPoints,
  validateConfig,
  type BuyableDefinition,
  type GameConfig,
} from './index';

describe('earnedSkillPoints', () => {
  it.each([
    [[], 0],
    [[0], 0],
    [[0, 0, 0], 0],
    [[1], 1], // the first action level-up gives the first point
    [[9], 1],
    [[4, 5], 1], // a total of 9
    [[10], 2],
    [[5, 5], 2],
    [[99], 2],
    [[100], 3],
    [[60, 40], 3],
    [[999], 3],
    [[1000], 4],
    [[1e9], 10],
  ])('levels %j give %d points', (levels, points) => {
    expect(earnedSkillPoints(levels)).toBe(points);
  });

  it('ignores negative and non-finite levels', () => {
    expect(earnedSkillPoints([-5, Number.NaN, Number.POSITIVE_INFINITY])).toBe(0);
  });
});

/** A skill: one point, no action. */
const skill = (id: string, effect: BuyableDefinition['effect'], cost = 1): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  currency: 'skillPoints',
  cost: num(cost),
  effect,
});

/** An action that does nothing: its level 1 is how a test earns the first skill point without touching the other actions. */
const inert = { id: 'z', name: 'Z', baseDurationMs: 1_000, reward: num(0), xpPerRun: num(1) };

const withSkills = (skills: BuyableDefinition[], overrides: Parameters<typeof createConfig>[1] = {}): GameConfig =>
  createConfig(testConfig, { actions: [...testConfig.actions, inert], buyables: [...testConfig.buyables, ...skills], ...overrides });

type Loose = {
  credits: unknown;
  network: unknown;
  heat: number;
  moles: number;
  hackingProficiency: unknown;
  inventory: unknown;
  actions: Record<string, { xp: unknown; sleeveXp: unknown }>;
};
/** The state of a game, writable (tests only). */
const mutable = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

/** Earns the first skill point: the inert action reaches level 1. */
const grantPoint = (g: { getState(): unknown }): void => {
  mutable(g).actions['z']!.xp = num(10);
};
/** A game with the first skill point already earned (the inert action `z` must be in the config). */
const skillGame = (options: Parameters<typeof createGame>[0]): ReturnType<typeof createGame> => {
  const g = createGame(options);
  grantPoint(g);
  return g;
};

describe('skill points as a currency', () => {
  const two = [skill('s1', { kind: 'interfaceSpeedMultiplier', factor: 2 }), skill('s2', { kind: 'heatCooldownSpeed', factor: 2 })];

  it('a new game has no point; the first comes when an action reaches level 1, and a skill costs it', () => {
    const g = createGame({ config: withSkills(two) });
    expect(g.skillPoints()).toBe(0);
    expect(g.canBuy('s1')).toBe(false);
    mutable(g).actions['z']!.xp = num(9);
    expect(g.skillPoints()).toBe(0); // level 0 still
    grantPoint(g);
    expect(g.skillPoints()).toBe(1);
    expect(g.buy('s1')).toBe('purchased');
    expect(g.skillPoints()).toBe(0);
    expect(g.buy('s2')).toBe('cannot-afford');
  });

  it('buying a skill leaves credits and nodes alone', () => {
    const g = skillGame({ config: withSkills(two) });
    mutable(g).credits = num(50);
    mutable(g).network = num(50);
    g.buy('s1');
    expect(g.getState().credits.eq(num(50))).toBe(true);
    expect(g.getState().network.eq(num(50))).toBe(true);
  });

  it('a skill is bought once only', () => {
    const g = skillGame({ config: withSkills(two) });
    g.buy('s1');
    expect(g.buy('s1')).toBe('max-reached');
  });

  it('a new point arrives at a total of 10 action levels and can be spent', () => {
    const g = skillGame({ config: withSkills(two) });
    g.buy('s1');
    expect(g.skillPoints()).toBe(0);
    mutable(g).actions['a']!.xp = num(10); // action level 1 (testConfig: level 1 at 10 XP)
    expect(g.actionLevel('a')).toBe(1);
    expect(g.skillPoints()).toBe(0); // a total of 1: still the first order of magnitude
    mutable(g).actions['a']!.xp = num('1.1e11'); // a high level, total well past 10
    expect(g.actionLevel('a')).toBeGreaterThanOrEqual(10);
    expect(g.skillPoints()).toBeGreaterThanOrEqual(1);
    expect(g.buy('s2')).toBe('purchased');
  });

  it('points are counted over the levels of ALL actions, not sleeve levels', () => {
    const config = withSkills(two, {
      actions: [...testConfig.actions, { id: 'b', name: 'B', baseDurationMs: 1_000, reward: num(0), xpPerRun: num(1) }],
    });
    const g = createGame({ config });
    // Level 5 on each of two actions is a total of 10
    for (const id of ['a', 'b']) mutable(g).actions[id]!.xp = num(11_110); // level 4
    expect(g.actionLevel('a') + g.actionLevel('b')).toBe(8);
    expect(g.skillPoints()).toBe(1);
    mutable(g).actions['b']!.xp = num(111_110); // level 5: total 9
    mutable(g).actions['a']!.xp = num(111_110); // level 5: total 10
    expect(g.skillPoints()).toBe(2);
    // sleeve levels do not add points
    const h = createGame({ config });
    mutable(h).actions['a']!.sleeveXp = num('1e12');
    expect(h.sleeveLevel('a')).toBeGreaterThan(5);
    expect(h.skillPoints()).toBe(0);
  });

  it('re-sleeving resets the skills together with the levels', () => {
    const g = skillGame({ config: withSkills(two) });
    g.buy('s1');
    g.resleeve();
    expect(g.ownedCount('s1')).toBe(0);
    expect(g.skillPoints()).toBe(0); // the levels are gone, so is the first point
  });

  it('a skill that costs 2 points needs 2', () => {
    const g = skillGame({ config: withSkills([skill('big', { kind: 'heatCooldownSpeed', factor: 2 }, 2)]) });
    expect(g.canBuy('big')).toBe(false);
    mutable(g).actions['a']!.xp = num('1e12'); // level 11: a total of 11, so 2 points
    expect(g.skillPoints()).toBeGreaterThanOrEqual(2);
    expect(g.buy('big')).toBe('purchased');
  });

  it('is not part of the Sleeve widget purchases or a currency the credits can pay', () => {
    const g = skillGame({ config: withSkills(two) });
    mutable(g).credits = num('1e100');
    expect(g.currencyOf('s1')).toBe('skillPoints');
  });
});

describe('the eight skill effects', () => {
  it('interface speed x1.05 multiplies the speed of every action', () => {
    const g = skillGame({ config: withSkills([skill('s', { kind: 'interfaceSpeedMultiplier', factor: 1.05 })]) });
    const before = g.sleeveStats().interfaceSpeed;
    g.buy('s');
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(before * 1.05, 12);
    expect(g.currentSpeed('a')).toBeCloseTo(1.05, 12); // testConfig base interface speed 1, level 0
  });

  it('node payout +10% multiplies what each node produces', () => {
    const g = skillGame({ config: withSkills([skill('s', { kind: 'nodePayoutMultiplier', factor: 1.1 })]) });
    mutable(g).network = num(100);
    const before = g.passiveCreditsPerSecond().toNumber();
    g.buy('s');
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(before * 1.1, 10);
  });

  it('heat cools down 5% faster: a cycle takes 1/1.05 as long', () => {
    const plain = createGame({ config: testConfig });
    const fast = skillGame({ config: withSkills([skill('s', { kind: 'heatCooldownSpeed', factor: 1.05 })]) });
    fast.buy('s');
    for (const g of [plain, fast]) mutable(g).heat = 100;
    plain.tick(60_000);
    fast.tick(60_000);
    expect(plain.getState().heat).toBe(99);
    expect(fast.getState().heat).toBe(99); // one full cycle done in both
    expect(fast.getState().heatCooldownMs).toBeGreaterThan(plain.getState().heatCooldownMs); // but 5% further into the next
    expect(fast.getState().heatCooldownMs).toBeCloseTo(3_000, 6);
  });

  it('Hacking Proficiency +5% counts the stored proficiency 5% higher', () => {
    const g = skillGame({ config: withSkills([skill('s', { kind: 'hackingProficiencyMultiplier', factor: 1.05 })]) });
    mutable(g).hackingProficiency = num(100);
    const before = g.sleeveStats().hackingMultiplier;
    g.buy('s');
    expect(g.sleeveStats().hackingProficiencyFactor).toBeCloseTo(1.05, 12);
    // test config: straight line, so the multiplier is 1 + proficiency
    expect(before).toBeCloseTo(101, 8);
    expect(g.sleeveStats().hackingMultiplier).toBeCloseTo(1 + 105, 8);
    expect(g.getState().hackingProficiency.eq(num(100))).toBe(true); // the stored value is unchanged
  });

  it('1% less XP for action levels: level 1 comes at 9.9 XP instead of 10, and the sleeve levels stay', () => {
    const g = skillGame({ config: withSkills([skill('s', { kind: 'actionXpReduction', amount: 0.01 })]) });
    mutable(g).actions['a']!.xp = num(9.95);
    expect(g.actionLevel('a')).toBe(0);
    g.buy('s');
    expect(g.actionLevel('a')).toBe(1);
    expect(g.nextActionLevelXp('a').toNumber()).toBeCloseTo(110 * 0.99, 8);
    expect(g.actionXpForLevel('a').toNumber()).toBeCloseTo(100 * 0.99, 8);
    mutable(g).actions['a']!.sleeveXp = num(9.95);
    expect(g.sleeveLevel('a')).toBe(0); // sleeve levels need the normal 10
  });

  it('the action XP reduction never goes beyond the cap', () => {
    const g = skillGame({
      config: withSkills([skill('s', { kind: 'actionXpReduction', amount: 0.9 })], { progression: { maxSleeveXpReduction: 0.5 } }),
    });
    g.buy('s');
    expect(g.nextActionLevelXp('a').toNumber()).toBeCloseTo(10 * 0.5, 8);
  });

  it('batched runs still agree with one-by-one runs under the XP reduction', () => {
    const make = () => {
      const g = skillGame({ config: withSkills([skill('s', { kind: 'actionXpReduction', amount: 0.01 }), ...[]]) });
      g.buy('s');
      mutable(g).credits = num(100);
      g.buy('auto');
      return g;
    };
    const once = make();
    const stepped = make();
    once.tick(10_000 * 1_111 + 123);
    for (let i = 0; i < 1_111; i++) stepped.tick(10_000);
    stepped.tick(123);
    expect(once.actionLevel('a')).toBe(stepped.actionLevel('a'));
  });
});

describe('item skills', () => {
  const dropRule = { itemId: 'file', chance: 0.4, rarityWeights: { common: 1 } };
  const harvest: BuyableDefinition = {
    id: 'harvest',
    name: 'H',
    description: '',
    actionId: 'a',
    cost: num(1),
    effect: { kind: 'itemDrop', drop: dropRule },
  };

  const dropsPerRun = (extra: BuyableDefinition[]): number => {
    const config = createConfig(testConfig, {
      actions: [...testConfig.actions, inert],
      buyables: [...testConfig.buyables, harvest, ...extra],
    });
    const g = skillGame({ config, random: seededRandom(3) });
    mutable(g).credits = num(100);
    g.buy('harvest');
    for (const s of extra) g.buy(s.id);
    g.buy('auto');
    g.startAction('a');
    g.tick(10_000 * 20_000);
    return (g.getState().inventory['file']?.['common'] ?? 0) / g.getState().actions['a']!.xp.toNumber();
  };

  it('Double Kompromat base drop chance doubles the chance of a drop', () => {
    expect(dropsPerRun([])).toBeCloseTo(0.4, 1);
    expect(dropsPerRun([skill('s', { kind: 'itemDropChanceMultiplier', itemId: 'file', factor: 2 })])).toBeCloseTo(0.8, 1);
  });

  it('the chance never goes above 100%', () => {
    expect(dropsPerRun([skill('s', { kind: 'itemDropChanceMultiplier', itemId: 'file', factor: 10 })])).toBeCloseTo(1, 5);
  });

  it('Exploit Kompromat: each uncommon file held adds 1% to the node payout', () => {
    const g = skillGame({
      config: createConfig(testConfig, {
        actions: [...testConfig.actions, inert],
        items: {
          rarities: [
            { id: 'common', name: 'C', sellValue: num(1) },
            { id: 'uncommon', name: 'U', sellValue: num(2) },
          ],
          definitions: [{ id: 'file', name: 'F' }],
        },
        buyables: [
          ...testConfig.buyables,
          skill('s', { kind: 'nodePayoutFromItems', itemId: 'file', rarityId: 'uncommon', perItem: 0.01 }),
        ],
      }),
    });
    g.buy('s');
    expect(g.sleeveStats().nodePayoutMultiplier).toBe(1);
    mutable(g).inventory = { file: { uncommon: 25, common: 1000 } };
    expect(g.sleeveStats().nodePayoutMultiplier).toBeCloseTo(1.25, 12); // only the uncommon ones count
    mutable(g).network = num(100);
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.05 * 1.25, 10);
    g.sellItems('file', 'uncommon', 25);
    expect(g.sleeveStats().nodePayoutMultiplier).toBe(1);
  });
});

describe('Back Channel Deals and Moles', () => {
  const channel = skill('bc', { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 });
  const game = () => {
    const g = skillGame({ config: withSkills([channel]) });
    mutable(g).inventory = { file: { common: 3, rare: 2 } };
    return g;
  };

  it('does nothing before the skill is owned', () => {
    const g = game();
    expect(g.giveUpForMoles('file', 'common', 1)).toBe(0);
    expect(g.getState().moles).toBe(0);
    expect(g.getState().inventory['file']!['common']).toBe(3);
  });

  it('each common file given up gives 5 Moles', () => {
    const g = game();
    g.buy('bc');
    expect(g.giveUpForMoles('file', 'common', 1)).toBe(1);
    expect(g.getState().moles).toBe(5);
    expect(g.getState().inventory['file']!['common']).toBe(2);
    expect(g.giveUpForMoles('file', 'common', 'all')).toBe(2);
    expect(g.getState().moles).toBe(15);
  });

  it('only the named rarity can be given up, and an empty stack gives nothing', () => {
    const g = game();
    g.buy('bc');
    expect(g.giveUpForMoles('file', 'rare', 1)).toBe(0);
    expect(g.giveUpForMoles('ghost', 'common', 1)).toBe(0);
    g.giveUpForMoles('file', 'common', 'all');
    expect(g.giveUpForMoles('file', 'common', 1)).toBe(0);
    expect(g.getState().moles).toBe(15);
    expect(g.giveUpForMoles('file', 'common', -3)).toBe(0);
    expect(g.giveUpForMoles('file', 'common', Number.NaN)).toBe(0);
  });

  it('heat cools 50% faster while Moles remain, and each point cooled uses one Mole', () => {
    const g = game();
    g.buy('bc');
    mutable(g).heat = 20;
    mutable(g).moles = 5;
    g.tick(40_000); // boosted cycles last 40 s: one point per 40 s
    expect(g.getState().heat).toBe(19);
    expect(g.getState().moles).toBe(4);
  });

  it('the boost ends exactly when the Moles run out: 5 Moles cool 5 points in 200 s, then the normal pace', () => {
    const g = game();
    g.buy('bc');
    mutable(g).heat = 20;
    mutable(g).moles = 5;
    g.tick(200_000);
    expect(g.getState().heat).toBe(15);
    expect(g.getState().moles).toBe(0);
    g.tick(60_000); // normal pace now: one point per minute
    expect(g.getState().heat).toBe(14);
  });

  it('one long tick and many short ones give the same heat and Moles', () => {
    const run = (slice: number) => {
      const g = game();
      g.buy('bc');
      mutable(g).heat = 30;
      mutable(g).moles = 8;
      for (let t = 0; t < 600_000; t += slice) g.tick(slice);
      return [g.getState().heat, g.getState().moles, Math.round(g.getState().heatCooldownMs)];
    };
    expect(run(600_000)).toEqual(run(1_000));
    expect(run(600_000)).toEqual(run(50));
  });

  it('Moles do nothing while there is no heat, and are kept for later', () => {
    const g = game();
    g.buy('bc');
    mutable(g).moles = 5;
    g.tick(600_000);
    expect(g.getState().moles).toBe(5);
    expect(g.getState().heat).toBe(0);
  });

  it('Moles left over when the heat is gone are not spent on more than the heat they covered', () => {
    const g = game();
    g.buy('bc');
    mutable(g).heat = 2;
    mutable(g).moles = 10;
    g.tick(1_000_000);
    expect(g.getState().heat).toBe(0);
    expect(g.getState().moles).toBe(8);
  });

  it('Moles are reset by re-sleeving', () => {
    const g = game();
    g.buy('bc');
    g.giveUpForMoles('file', 'common', 'all');
    g.resleeve();
    expect(g.getState().moles).toBe(0);
  });
});

describe('coolHeatBoosted', () => {
  const none = { heat: 10, cooldownMs: 0, moles: 0 };

  it('with speed 1 and no Moles it equals coolHeat', () => {
    for (const delta of [0, 1, 59_999, 60_000, 250_000, 1e7]) {
      const a = coolHeat({ heat: 10, cooldownMs: 12_345 }, delta, 60_000, 1);
      const b = coolHeatBoosted({ ...none, cooldownMs: 12_345 }, delta, 60_000, 1, 1, 0);
      expect([b.heat, b.cooldownMs]).toEqual([a.heat, a.cooldownMs]);
    }
  });

  it('a speed of 2 does the same in half the time', () => {
    const slow = coolHeatBoosted(none, 120_000, 60_000, 1, 1, 0);
    const fast = coolHeatBoosted(none, 60_000, 60_000, 1, 2, 0);
    expect([fast.heat, fast.cooldownMs]).toEqual([slow.heat, slow.cooldownMs]);
  });

  it('keeps the heat and Moles of a step in which there is no heat', () => {
    expect(coolHeatBoosted({ heat: 0, cooldownMs: 0, moles: 7 }, 1e6, 60_000, 1, 1, 0.5)).toEqual({ heat: 0, cooldownMs: 0, moles: 7 });
  });

  it('a fraction of a point of heat uses only that much of a Mole', () => {
    const r = coolHeatBoosted({ heat: 0.5, cooldownMs: 0, moles: 3 }, 1e6, 60_000, 1, 1, 0.5);
    expect(r.heat).toBe(0);
    expect(r.moles).toBeCloseTo(2.5, 12);
  });

  it('never produces negative heat or Moles, whatever the step', () => {
    for (const delta of [0, 1, 1e3, 1e5, 1e9, 1e15]) {
      for (const moles of [0, 0.5, 1, 7, 1e6]) {
        const r = coolHeatBoosted({ heat: 12.5, cooldownMs: 30_000, moles }, delta, 60_000, 1, 1.05, 0.5);
        expect(r.heat).toBeGreaterThanOrEqual(0);
        expect(r.moles).toBeGreaterThanOrEqual(0);
        expect(r.moles).toBeLessThanOrEqual(moles);
        expect(Number.isFinite(r.cooldownMs)).toBe(true);
      }
    }
  });
});

describe('validation of the skill effects', () => {
  const invalid = (effect: BuyableDefinition['effect']) => validateConfig(withSkills([skill('x', effect)])).join('|');

  it.each([
    [{ kind: 'interfaceSpeedMultiplier', factor: 0.9 }, 'factor must be >= 1'],
    [{ kind: 'heatCooldownSpeed', factor: 0 }, 'factor must be >= 1'],
    [{ kind: 'hackingProficiencyMultiplier', factor: -1 }, 'factor must be >= 1'],
    [{ kind: 'actionXpReduction', amount: 0 }, 'actionXpReduction amount must be in (0, 1)'],
    [{ kind: 'actionXpReduction', amount: 1 }, 'actionXpReduction amount must be in (0, 1)'],
    [{ kind: 'itemDropChanceMultiplier', itemId: 'ghost', factor: 2 }, 'unknown item "ghost"'],
    [{ kind: 'itemDropChanceMultiplier', itemId: 'file', factor: 0.5 }, 'factor must be >= 1'],
    [{ kind: 'nodePayoutFromItems', itemId: 'file', rarityId: 'ghost', perItem: 0.01 }, 'unknown rarity "ghost"'],
    [{ kind: 'nodePayoutFromItems', itemId: 'file', rarityId: 'common', perItem: -1 }, 'perItem must be >= 0'],
    [{ kind: 'backChannel', itemId: 'ghost', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 }, 'unknown item "ghost"'],
    [{ kind: 'backChannel', itemId: 'file', rarityId: 'ghost', molesPerItem: 5, cooldownBoost: 0.5 }, 'unknown rarity "ghost"'],
    [{ kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 0, cooldownBoost: 0.5 }, 'molesPerItem must be > 0'],
    [{ kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: -1 }, 'cooldownBoost must be >= 0'],
  ] as const)('%j is rejected', (effect, message) => {
    expect(invalid(effect as BuyableDefinition['effect'])).toContain(message);
  });

  it('valid skills pass', () => {
    expect(invalid({ kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 })).toBe('');
  });
});

it('save and load keeps the skills, the Moles and the points they leave', async () => {
  const { serializeState, deserializeState } = await import('./index');
  const config = withSkills([skill('s1', { kind: 'heatCooldownSpeed', factor: 2 })]);
  const g = skillGame({ config });
  g.buy('s1');
  mutable(g).moles = 12;
  const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
  expect(restored.purchased['s1']).toBe(1);
  expect(restored.moles).toBe(12);
});
