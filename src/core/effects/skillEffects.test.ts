/**
 * The skill effects and item skills.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { seededRandom } from '../../testing/random';
import { testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig, type BuyableDefinition } from '..';
import { skill, inert, withSkills, mutable, skillGame } from '../../testing/skillsKit';

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
    expect(plain.getState().sleeve.heat).toBe(99);
    expect(fast.getState().sleeve.heat).toBe(99); // one full cycle done in both
    expect(fast.getState().sleeve.heatCooldownMs).toBeGreaterThan(plain.getState().sleeve.heatCooldownMs); // but 5% further into the next
    expect(fast.getState().sleeve.heatCooldownMs).toBeCloseTo(3_000, 6);
  });

  describe('a heat cooldown cycle that removes more heat per sleeve level of an action', () => {
    const purge = skill('purge', { kind: 'heatCooldownAmountFromSleeveLevel', sourceActionId: 'a', perLevel: 1 });
    /** A game that owns the skill and whose action `a` has a sleeve level above 0. */
    const purged = (): ReturnType<typeof createGame> => {
      const g = skillGame({ config: withSkills([purge]) });
      g.buy('purge');
      mutable(g).actions['a']!.sleeveXp = num(1_000_000);
      return g;
    };

    it('without the skill a cycle removes the base amount; with it, one more for every sleeve level', () => {
      const plain = createGame({ config: testConfig });
      const g = purged();
      const level = g.sleeveLevel('a');
      expect(level).toBeGreaterThanOrEqual(2); // the test needs a level that makes a visible difference
      expect(plain.sleeveStats().heatCooldownAmount).toBe(testConfig.sleeve.heatCooldownAmount);
      expect(g.sleeveStats().heatCooldownAmount).toBe(testConfig.sleeve.heatCooldownAmount + level);
    });

    it('one completed cycle takes that many points of heat, no faster than before', () => {
      const g = purged();
      const amount = g.sleeveStats().heatCooldownAmount;
      mutable(g).heat = 100;
      g.tick(testConfig.sleeve.heatCooldownMs - 1);
      expect(g.getState().sleeve.heat).toBe(100); // the cooldown is still in discrete steps: nothing until the cycle completes
      g.tick(1);
      expect(g.getState().sleeve.heat).toBe(100 - amount);
    });

    it('comes online at once: the bigger step applies from the first cycle after the skill is bought', () => {
      const g = skillGame({ config: withSkills([purge]) });
      mutable(g).actions['a']!.sleeveXp = num(1_000_000);
      mutable(g).heat = 100;
      g.tick(testConfig.sleeve.heatCooldownMs / 2); // half a cycle in without the skill
      g.buy('purge');
      g.tick(testConfig.sleeve.heatCooldownMs / 2);
      expect(g.getState().sleeve.heat).toBe(100 - g.sleeveStats().heatCooldownAmount);
    });

    it('the last cycle takes only the whole points that are left, so a big step never strands heat', () => {
      const g = purged();
      const amount = g.sleeveStats().heatCooldownAmount;
      mutable(g).heat = amount - 0.5; // less than one full step, and a fraction on top
      g.tick(testConfig.sleeve.heatCooldownMs);
      expect(g.getState().sleeve.heat).toBe(0.5); // every whole point went; only the fraction stays, as before
    });

    it('a step of any size gives the same result in one long tick and many short ones', () => {
      const long = purged();
      const short = purged();
      for (const g of [long, short]) mutable(g).heat = 1_000;
      long.tick(5 * testConfig.sleeve.heatCooldownMs + 7_000);
      for (let i = 0; i < 5 * 60 + 7; i++) short.tick(1_000);
      expect(short.getState().sleeve.heat).toBe(long.getState().sleeve.heat);
      expect(short.getState().sleeve.heatCooldownMs).toBeCloseTo(long.getState().sleeve.heatCooldownMs, 6);
    });

    it('rejects a rate that is not positive and an unknown action', () => {
      const bad = (effect: BuyableDefinition['effect']): string => validateConfig(withSkills([skill('x', effect)])).join('|');
      expect(bad({ kind: 'heatCooldownAmountFromSleeveLevel', sourceActionId: 'a', perLevel: 0 })).toContain('must be > 0');
      expect(bad({ kind: 'heatCooldownAmountFromSleeveLevel', sourceActionId: 'ghost', perLevel: 1 })).toContain('unknown action "ghost"');
    });
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
    expect(g.getState().sleeve.hackingProficiency.eq(num(100))).toBe(true); // the stored value is unchanged
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
    return (g.getState().wallet.inventory['file']?.['common'] ?? 0) / g.getState().sleeve.actions['a']!.xp.toNumber();
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
