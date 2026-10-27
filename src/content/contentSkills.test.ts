/**
 * Guards for the REAL content: levels, skills and automation. Invariants only, never tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { SPEED_FACTOR_IDS } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import {
  AUTOMATION_CORE,
  SKILL_OBFUSCATION,
  gameConfig,
  KOMPROMAT_HARVEST,
  overclockUnlockId,
  PRACTICE_HACKING,
  PUSH_MALWARE,
  SKILL_BACK_CHANNEL,
  SKILL_EXPLOIT_KOMPROMAT,
  SKILL_NOSE_FOR_SECRETS,
} from './gameConfig';

describe('levels start at 0 (real content)', () => {
  it('a new game has every action level and sleeve level at 0, and level 0 is worth exactly 1 of speed', () => {
    const g = createGame();
    for (const a of gameConfig.actions) {
      expect(g.actionLevel(a.id), a.id).toBe(0);
      expect(g.sleeveLevel(a.id), a.id).toBe(0);
      const factors = g.speedFactors(a.id);
      expect(factors.find((f) => f.id === SPEED_FACTOR_IDS.actionLevel)?.factor, a.id).toBe(1);
      expect(factors.find((f) => f.id === SPEED_FACTOR_IDS.sleeveLevel)?.factor, a.id).toBe(1);
    }
  });

  it('each level is worth +5% of the base speed: level 1 is 1.05, level 2 is 1.1', () => {
    const g = createGame();
    const id = gameConfig.actions[0]!.id;
    const setXp = (xp: number) => ((g.getState().actions[id] as { xp: unknown }).xp = num(xp));
    const actionFactor = () => g.speedFactors(id).find((f) => f.id === SPEED_FACTOR_IDS.actionLevel)!.factor;
    setXp(10); // the first level-up
    expect(g.actionLevel(id)).toBe(1);
    expect(actionFactor()).toBeCloseTo(1.05, 10);
    const { firstLevelXp, growthFactor } = gameConfig.progression.actionLevels;
    setXp(firstLevelXp * (1 + growthFactor)); // the second level-up, whatever the growth
    expect(g.actionLevel(id)).toBe(2);
    expect(actionFactor()).toBeCloseTo(1.1, 10);
  });
});

describe('skills are offered by their unlocking purchase (real content)', () => {
  const needs = (id: string): readonly string[] => gameConfig.buyables.find((b) => b.id === id)?.requires ?? [];

  it('the Kompromat skills need Kompromat harvest, and Obfuscation needs the Push malware Overclock', () => {
    for (const id of [SKILL_NOSE_FOR_SECRETS, SKILL_EXPLOIT_KOMPROMAT, SKILL_BACK_CHANNEL])
      expect(needs(id), id).toEqual([KOMPROMAT_HARVEST]);
    expect(needs(SKILL_OBFUSCATION)).toEqual([overclockUnlockId(PUSH_MALWARE)]);
  });

  it('a Kompromat skill is hidden until the harvest is owned, then shows', () => {
    const g = createGame();
    expect(g.isBuyableAvailable(SKILL_NOSE_FOR_SECRETS)).toBe(false);
    (g.getState() as { credits: unknown }).credits = num(1_000);
    (g.getState() as { actions: Record<string, { xp: unknown }> }).actions[PRACTICE_HACKING]!.xp = num(100);
    expect(g.buy(KOMPROMAT_HARVEST)).toBe('purchased');
    expect(g.isBuyableAvailable(SKILL_NOSE_FOR_SECRETS)).toBe(true);
  });
});

describe('automation (real content)', () => {
  it('automation points come from a sleeve buyable: 1,000,000 credits, 100x more per copy, unlimited, one point per copy', () => {
    const core = gameConfig.buyables.find((b) => b.id === AUTOMATION_CORE)!;
    expect(core.actionId).toBeUndefined();
    expect(core.cost.toNumber()).toBe(1_000_000);
    expect(core.costGrowth).toBe(100);
    expect(core.maxPurchases).toBe(Infinity);
    expect(core.effect).toEqual({ kind: 'automationPoints', perCopy: 1 });
    expect(gameConfig.automation).toBeDefined();
  });

  it('there are three features and the first point is spent on one of them, here Auto Burn', () => {
    const g = createGame();
    setCredits(g, num(1_000_000));
    expect(g.automation().pointsEarned()).toBe(0);
    expect(g.buy(AUTOMATION_CORE)).toBe('purchased');
    expect(g.automation().pointsAvailable()).toBe(1);
    expect(g.automation().unlock('autoBurn')).toBe(true);
    expect(g.automation().pointsAvailable()).toBe(0);
  });
});
