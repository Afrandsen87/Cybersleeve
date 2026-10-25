import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { setCredits, testConfig } from '../testing/testConfig';
import { createConfig, deserializeState, LevelRule, serializeState, type GameConfig } from './index';

/**
 * The Skill shard `sh` delays the XP scaling by 1 level. Actions `a` and `b` are unlocked from the start, `c` needs access level 2.
 * Level rule: 10 XP for the first level, then x10 per level (costs 10, 100, 1000, ...).
 */
function configWith(levelsDelayed = 1): GameConfig {
  return createConfig(testConfig, {
    items: {
      rarities: testConfig.items.rarities,
      definitions: [...testConfig.items.definitions, { id: 'sh', name: 'Skill shard', sellable: false, hasRarity: false }],
      skillShard: { itemId: 'sh', levelsDelayed },
    },
    actions: [
      testConfig.actions[0]!,
      { id: 'b', name: 'B', baseDurationMs: 10_000, reward: num(0.5), xpPerRun: num(1) },
      { id: 'c', name: 'C', baseDurationMs: 10_000, reward: num(0.5), xpPerRun: num(1), requiredAccessLevel: 2 },
    ],
  });
}

function game(random: () => number = () => 0, config = configWith()) {
  const g = createGame({ config, random });
  setCredits(g, num(1_000_000));
  return g;
}
type Game = ReturnType<typeof game>;

const give = (g: Game, n: number): void => {
  (g.getState() as { inventory: Record<string, Record<string, number>> }).inventory['sh'] = { common: n };
};
const held = (g: Game): number => g.getState().inventory['sh']?.['common'] ?? 0;
const shards = (g: Game, id: string): number => g.getState().actions[id]!.skillShards;
const setXp = (g: Game, id: string, xp: number): void => {
  (g.getState().actions[id]!.xp as unknown) = num(xp);
};

describe('LevelRule with a delay', () => {
  const rule = new LevelRule({ firstLevelXp: 10, growthFactor: 10 }, numberFactory);
  const level = (xp: number, delay: number): number => rule.levelForXp(num(xp), delay);

  it('without a delay it is the plain rule', () => {
    expect([level(0, 0), level(9, 0), level(10, 0), level(109, 0), level(110, 0), level(1110, 0)]).toEqual([0, 0, 1, 1, 2, 3]);
    expect(rule.xpCostOfLevel(2, 0).toNumber()).toBe(1000);
  });

  it('a delay of 1 repeats the first cost once: levels cost 10, 10, 100, 1000', () => {
    expect([0, 1, 2, 3].map((l) => rule.xpCostOfLevel(l, 1).toNumber())).toEqual([10, 10, 100, 1000]);
    expect([level(9, 1), level(10, 1), level(19, 1), level(20, 1), level(119, 1), level(120, 1), level(1119, 1), level(1120, 1)]).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4,
    ]);
  });

  it('a delay of 3 keeps four levels at the first cost before the growth starts', () => {
    expect([0, 1, 2, 3, 4, 5].map((l) => rule.xpCostOfLevel(l, 3).toNumber())).toEqual([10, 10, 10, 10, 100, 1000]);
    expect([level(39, 3), level(40, 3), level(139, 3), level(140, 3)]).toEqual([3, 4, 4, 5]);
  });

  it('the thresholds, the XP into a level and the progress agree with the costs', () => {
    expect(rule.xpForNextLevel(0, 1).toNumber()).toBe(10);
    expect(rule.xpForNextLevel(1, 1).toNumber()).toBe(20);
    expect(rule.xpForNextLevel(2, 1).toNumber()).toBe(120);
    expect(rule.xpIntoLevel(num(15), 1).toNumber()).toBe(5);
    expect(rule.progressFraction(num(15), 1)).toBeCloseTo(0.5, 9);
    expect(rule.xpIntoLevel(num(70), 1).toNumber()).toBe(50);
    expect(rule.progressFraction(num(70), 1)).toBeCloseTo(0.5, 9);
  });

  it('a delay never makes a level cost more, and the totals are never below the plain ones', () => {
    for (let l = 0; l < 12; l++) {
      expect(rule.xpCostOfLevel(l, 2).toNumber()).toBeLessThanOrEqual(rule.xpCostOfLevel(l, 0).toNumber());
      expect(rule.xpForNextLevel(l, 2).toNumber()).toBeLessThanOrEqual(rule.xpForNextLevel(l, 0).toNumber());
    }
  });

  it('is exact on every boundary of the first levels', () => {
    for (const delay of [1, 2, 5]) {
      for (let l = 0; l < 10; l++) {
        const threshold = rule.xpForNextLevel(l, delay);
        expect(rule.levelForXp(threshold, delay)).toBe(l + 1);
        expect(rule.levelForXp(threshold.sub(num(0.5)), delay)).toBe(l);
      }
    }
  });
});

describe('Skill shards: using one', () => {
  it('cannot be used with none held', () => {
    const g = game();
    expect(g.canUseSkillShard()).toBe(false);
    expect(g.useSkillShard()).toBeNull();
  });

  it('uses the shard up and lands it on an unlocked action, drawn at random', () => {
    const first = game(() => 0);
    give(first, 2);
    expect(first.useSkillShard()).toBe('a');
    expect(held(first)).toBe(1);
    expect(shards(first, 'a')).toBe(1);

    const last = game(() => 0.999);
    give(last, 1);
    expect(last.useSkillShard()).toBe('b');
    expect(shards(last, 'b')).toBe(1);
  });

  it('never lands on a locked action', () => {
    for (const draw of [0, 0.34, 0.5, 0.67, 0.99]) {
      const g = game(() => draw);
      give(g, 1);
      expect(g.useSkillShard()).not.toBe('c');
      expect(shards(g, 'c')).toBe(0);
    }
  });

  it('lands on a newly unlocked action once the access level allows it', () => {
    const g = game(() => 0.999);
    give(g, 1);
    g.buy('access');
    expect(g.useSkillShard()).toBe('c');
  });

  it('shards stack on the same action', () => {
    const g = game(() => 0);
    give(g, 3);
    g.useSkillShard();
    g.useSkillShard();
    expect(shards(g, 'a')).toBe(2);
  });
});

describe('Skill shards: what they do to the levels', () => {
  it('delay the XP scaling of the action they landed on, by 1 level each', () => {
    const g = game(() => 0);
    give(g, 2);
    setXp(g, 'a', 20);
    expect(g.actionLevel('a')).toBe(1); // plain rule: 10 for level 1, 110 for level 2
    g.useSkillShard();
    expect(g.actionLevel('a')).toBe(2); // costs 10, 10, ...: level 2 at 20 XP
    expect(g.actionXpForLevel('a').toNumber()).toBe(100); // leaving level 2 now costs the first growth step
    g.useSkillShard();
    setXp(g, 'a', 30);
    expect(g.actionLevel('a')).toBe(3);
  });

  it('leave the other actions and the sleeve levels alone', () => {
    const g = game(() => 0);
    give(g, 1);
    setXp(g, 'b', 20);
    (g.getState().actions['a']!.sleeveXp as unknown) = num(20);
    g.useSkillShard();
    expect(g.actionLevel('b')).toBe(1);
    expect(g.sleeveLevel('a')).toBe(1);
  });

  it('change the thresholds the runs are batched against (a long tick levels up the same as many short ones)', () => {
    const long = game(() => 0);
    const short = game(() => 0);
    for (const g of [long, short]) {
      give(g, 2);
      g.useSkillShard();
      g.useSkillShard();
      g.buy('auto');
      g.startAction('a');
    }
    long.tick(400_000 + 1);
    for (let i = 0; i < 400; i++) short.tick(1_000);
    short.tick(1);
    expect(long.actionLevel('a')).toBe(short.actionLevel('a'));
    expect(long.getState().actions['a']!.xp.toNumber()).toBe(short.getState().actions['a']!.xp.toNumber());
  });

  it('are reset by re-sleeving', () => {
    const g = game(() => 0);
    give(g, 1);
    g.useSkillShard();
    g.resleeve();
    expect(shards(g, 'a')).toBe(0);
  });
});

describe('Skill shards: saving and the state', () => {
  it('the shard count of each action round-trips', () => {
    const config = configWith();
    const g = game(() => 0, config);
    give(g, 2);
    g.useSkillShard();
    g.useSkillShard();
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.actions['a']!.skillShards).toBe(2);
    expect(restored.actions['b']!.skillShards).toBe(0);
  });

  it('a bad saved count becomes 0', () => {
    const config = configWith();
    const json = JSON.parse(serializeState(game(() => 0, config).getState()));
    json.actions.a.skillShards = -4;
    json.actions.b.skillShards = 'x';
    const restored = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect(restored.actions['a']!.skillShards).toBe(0);
    expect(restored.actions['b']!.skillShards).toBe(0);
  });

  it('flags a fractional shard count as a broken state', () => {
    const g = game();
    (g.getState().actions['a'] as { skillShards: number }).skillShards = 1.5;
    expect(findInvariantViolations(g.getState(), configWith()).join('\n')).toContain('a.skillShards is invalid');
  });
});
