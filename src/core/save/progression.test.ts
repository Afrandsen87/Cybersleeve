/**
 * Progression: levels, XP and thresholds.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { LevelRule, Progression, createConfig, createInitialState, type LevelRuleConfig } from '..';

const config = testConfig;
const _rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('Progression', () => {
  const progression = new Progression(config, numberFactory);
  const record = (s: ReturnType<typeof createInitialState>, xp: number, runs: number | string) =>
    progression.recordRuns(s, 'a', num(xp), num(runs));

  it('adds action xp and counts runs', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 1, 1);
    expect(s.sleeve.actions['a']!.xp.eq(num(1))).toBe(true);
    expect(s.sleeve.actions['a']!.runsTowardSleeveXp).toBe(1);
  });

  it('grants 1 sleeve xp per 100 runs and keeps the remainder', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 99, 99);
    expect(s.sleeve.actions['a']!.sleeveXp.isZero()).toBe(true);
    record(s, 1, 1);
    expect(s.sleeve.actions['a']!.sleeveXp.eq(num(1))).toBe(true);
    expect(s.sleeve.actions['a']!.runsTowardSleeveXp).toBe(0);
    record(s, 250, 250);
    expect(s.sleeve.actions['a']!.sleeveXp.eq(num(3))).toBe(true);
    expect(s.sleeve.actions['a']!.runsTowardSleeveXp).toBe(50);
  });

  it('handles huge run counts without breaking (remainder dropped)', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 1, '1e40');
    expect(s.sleeve.actions['a']!.sleeveXp.floorLog10()).toBe(38);
    expect(s.sleeve.actions['a']!.runsTowardSleeveXp).toBe(0);
  });

  it('sleeveXpPerGrant and runsPerSleeveXp come from the config', () => {
    const custom = createConfig(config, { progression: { runsPerSleeveXp: 10, sleeveXpPerGrant: 5 } });
    const p = new Progression(custom, numberFactory);
    const s = createInitialState(custom, numberFactory);
    p.recordRuns(s, 'a', num(25), num(25));
    expect(s.sleeve.actions['a']!.sleeveXp.eq(num(10))).toBe(true);
    expect(s.sleeve.actions['a']!.runsTowardSleeveXp).toBe(5);
  });

  it('action level 1 at exactly 10 xp (10 runs)', () => {
    const s = createInitialState(config, numberFactory);
    for (let i = 0; i < 9; i++) record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(0);
    record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(1);
    expect(progression.nextActionLevelXp(s, 'a').eq(num(110))).toBe(true); // 10 for level 1, a further 100 for level 2
    expect(progression.actionXpIntoLevel(s, 'a').isZero()).toBe(true); // the count starts again
    expect(progression.actionXpForLevel(s, 'a').eq(num(100))).toBe(true);
  });

  it('the XP counted inside a level starts again at each level-up, and the next level needs the full amount', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 109, 109);
    expect(progression.actionLevel(s, 'a')).toBe(1);
    expect(progression.actionXpIntoLevel(s, 'a').toNumber()).toBe(99);
    record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(2);
    expect(progression.actionXpIntoLevel(s, 'a').toNumber()).toBe(0);
    expect(progression.actionXpForLevel(s, 'a').toNumber()).toBe(1000);
    record(s, 999, 999);
    expect(progression.actionLevel(s, 'a')).toBe(2);
    record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(3);
  });

  it('every level starts at 0', () => {
    const s = createInitialState(config, numberFactory);
    expect(progression.actionLevel(s, 'a')).toBe(0);
    expect(progression.sleeveLevel(s, 'a')).toBe(0);
  });

  it('a per-action level rule overrides the default', () => {
    const custom = createConfig(config, {
      actions: [{ ...config.actions[0]!, levels: { firstLevelXp: 2, growthFactor: 2 } }],
    });
    const p = new Progression(custom, numberFactory);
    const s = createInitialState(custom, numberFactory);
    p.recordRuns(s, 'a', num(5), num(5));
    expect(p.actionLevel(s, 'a')).toBe(1); // level 1 costs 2, level 2 a further 4: 5 XP is not enough for level 2
    p.recordRuns(s, 'a', num(1), num(1));
    expect(p.actionLevel(s, 'a')).toBe(2);
  });

  it('rejects unknown actions', () => {
    const s = createInitialState(config, numberFactory);
    expect(() => progression.recordRuns(s, 'nope', num(1), num(1))).toThrow();
    expect(() => progression.actionLevel(s, 'nope')).toThrow();
  });
});
