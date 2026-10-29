import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { buildViewModel } from '../../ui/viewModel';
import { createConfig, LevelRule } from '..';

describe('every level costs its full amount (the XP count starts again at each level-up)', () => {
  const play = (runs: number) => {
    const g = createGame({ config: createConfig(testConfig, { speed: { actionLevel: { kind: 'linear', perLevel: 1e-12 } } }) });
    // 1 s runs would take 10 s each in the test content; give each run its own click and a full duration.
    for (let i = 0; i < runs; i++) {
      g.startAction('a');
      g.tick(10_001);
    }
    return g;
  };

  it('the screen counts the XP inside the current level against that level full cost', () => {
    const at = (runs: number) => buildViewModel(play(runs)).actions[0]!;
    expect(at(0)).toMatchObject({ level: 0, xpText: '0', nextLevelXpText: '10' });
    expect(at(9)).toMatchObject({ level: 0, xpText: '9', nextLevelXpText: '10' });
    expect(at(10)).toMatchObject({ level: 1, xpText: '0', nextLevelXpText: '100' });
    expect(at(60)).toMatchObject({ level: 1, xpText: '50', nextLevelXpText: '100' });
    expect(at(109)).toMatchObject({ level: 1, xpText: '99', nextLevelXpText: '100' });
    expect(at(110)).toMatchObject({ level: 2, xpText: '0', nextLevelXpText: '1K' });
  });

  it('the progress bar restarts at each level-up', () => {
    expect(play(109).actionLevelProgress('a')).toBeCloseTo(0.99, 9);
    expect(play(110).actionLevelProgress('a')).toBe(0);
    expect(play(110 + 500).actionLevelProgress('a')).toBeCloseTo(0.5, 9);
  });

  it('a long batched stretch of runs lands on the same level as running them one by one', () => {
    const fast = createGame({ config: testConfig });
    (fast.getState() as unknown as { credits: unknown }).credits = num(1e6);
    fast.buy('auto');
    fast.tick(10_000 * 1_110); // 1110 auto-runs in one go
    const slow = createGame({ config: testConfig });
    (slow.getState() as unknown as { credits: unknown }).credits = num(1e6);
    slow.buy('auto');
    for (let i = 0; i < 1_110; i++) slow.tick(10_000);
    expect(fast.actionLevel('a')).toBe(slow.actionLevel('a'));
    expect(fast.getState().actions['a']!.xp.eq(slow.getState().actions['a']!.xp)).toBe(true);
    expect(fast.actionLevel('a')).toBe(3); // 10 + 100 + 1000 = 1110 XP
  });
});

describe('LevelRule is consistent at every boundary', () => {
  const rules: [number, number][] = [
    [10, 10],
    [5, 2],
    [1, 3],
    [100, 1.5],
    [0.5, 1.1],
    [7, 1.01],
  ];

  it.each(rules)('first %s, growth %s: reaching a total gives exactly the next level, and a hair less does not', (first, growth) => {
    const rule = new LevelRule({ firstLevelXp: first, growthFactor: growth }, numberFactory);
    let previous = num(0);
    for (let level = 0; level <= 200; level++) {
      const total = rule.xpForNextLevel(level);
      expect(total.gt(previous), `level ${level}`).toBe(true);
      expect(rule.levelForXp(total), `at the total for level ${level + 1}`).toBe(level + 1);
      expect(rule.levelForXp(total.mul(num(0.999999))), `just below the total for level ${level + 1}`).toBe(level);
      // the cost of a level is the difference between consecutive totals
      const cost = rule.xpCostOfLevel(level).toNumber();
      expect(Math.abs(total.sub(previous).toNumber() - cost) / cost, `cost of level ${level}`).toBeLessThan(1e-9);
      previous = total;
    }
  });

  it('XP inside a level is always between 0 and the full cost of that level', () => {
    const rule = new LevelRule({ firstLevelXp: 10, growthFactor: 10 }, numberFactory);
    for (const xp of [0, 3, 10, 55, 109.999, 110, 5_000, 1e9, 1.2345e40, 7.7e300]) {
      const into = rule.xpIntoLevel(num(xp));
      const cost = rule.xpCostOfLevel(rule.levelForXp(num(xp)));
      expect(into.isNegative(), `${xp}`).toBe(false);
      expect(into.lt(cost.mul(num(1.000001))), `${xp}`).toBe(true);
    }
  });
});
