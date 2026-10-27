import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { earnedSkillPoints } from './index';
import { skill, withSkills, mutable, grantPoint, skillGame } from './skillsKit';

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
