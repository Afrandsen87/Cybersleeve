/**
 * The retention lane of the re-sleeve skills that carry things over a re-sleeve: Daemon Persistence, Residual Proficiency and Residual
 * Firewall, tested on a small configuration. (Reflex Archive has its own file.)
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../numbers';
import { automationLaneBuyables, laneSkillId } from '../testing/automationKit';
import { findInvariantViolations } from '../testing/invariants';
import { deserializeState, serializeState, validateConfig } from './index';
import { loose, newGame, plainBuyable, resleeveSkill, resleeveTimes, tryBuy, withBuyables } from './resleeveSkillsKit';

const core = plainBuyable('core', { kind: 'automationPoints', perCopy: 1 }, { costGrowth: 10, maxPurchases: Infinity });
const config = withBuyables(
  [
    core,
    ...automationLaneBuyables(),
    plainBuyable('boost', { kind: 'interfaceSpeed', amount: 0.05 }),
    resleeveSkill('daemon', { kind: 'keepsAutomation' }),
    resleeveSkill('prof', { kind: 'carriesProficiency', scale: 1 }),
    resleeveSkill('ice', { kind: 'carriesIceRating', share: 0.5 }),
  ],
  { automation: { autoBurnCeiling: 10 } },
);

describe('the retention effects are valid content', () => {
  it('passes validation, and rejects a scale or share out of range', () => {
    expect(validateConfig(config)).toEqual([]);
    const bad = (effect: Parameters<typeof resleeveSkill>[1]) => validateConfig(withBuyables([resleeveSkill('x', effect)])).join();
    expect(bad({ kind: 'carriesProficiency', scale: 0 })).toContain('scale must be > 0');
    expect(bad({ kind: 'carriesIceRating', share: 0 })).toContain('share must be in (0, 1]');
    expect(bad({ kind: 'carriesIceRating', share: 1.5 })).toContain('share must be in (0, 1]');
  });
});

describe('Daemon Persistence', () => {
  /** A game with two automation points bought, Auto Burn unlocked and set to a ceiling of 3. */
  function automated(withDaemon: boolean): ReturnType<typeof newGame> {
    const g = newGame(config);
    if (withDaemon) {
      resleeveTimes(g, 1);
      expect(tryBuy(g, 'daemon')).toBe('purchased');
    }
    for (let i = 0; i < 2; i++) expect(tryBuy(g, 'core')).toBe('purchased');
    expect(g.automation().unlock('autoBurn')).toBe(true);
    g.automation().setAutoBurnCeiling(3);
    g.automation().setAutoBurn(true);
    expect(tryBuy(g, 'boost')).toBe('purchased');
    return g;
  }

  it('wipes the Automation tab at a re-sleeve without the skill', () => {
    const g = automated(false);
    g.resleeve();
    expect(g.automation().pointsEarned()).toBe(0);
    expect(g.automation().isUnlocked('autoBurn')).toBe(false);
    expect(g.automation().autoBurnCeiling()).toBe(10);
  });

  it('keeps the automation core, the lane skills and the settings, so the points stay balanced, and wipes the rest', () => {
    const g = automated(true);
    const earned = g.automation().pointsEarned();
    const available = g.automation().pointsAvailable();
    expect(earned).toBe(2);
    expect(available).toBe(1);
    g.resleeve();
    expect(g.automation().pointsEarned(), 'no extra points, and none lost').toBe(earned);
    expect(g.automation().pointsAvailable()).toBe(available);
    expect(g.automation().isUnlocked('autoBurn')).toBe(true);
    expect(g.automation().isAutoBurnOn()).toBe(true);
    expect(g.automation().autoBurnCeiling()).toBe(3);
    expect(g.ownedCount(laneSkillId('autoBurn', 1))).toBe(1);
    expect(g.ownedCount('boost'), 'other purchases still reset').toBe(0);
    expect(findInvariantViolations(g.getState(), config)).toEqual([]);
  });

  it('does not let the carried copies be bought again for free: the next copy keeps its raised price', () => {
    const g = automated(true);
    g.resleeve();
    expect(g.ownedCount('core')).toBe(2);
    expect(tryBuy(g, 'core')).toBe('purchased');
    expect(g.automation().pointsEarned()).toBe(3);
  });
});

describe('Residual Proficiency', () => {
  it('starts a new life at log10(1 + the proficiency the last one ended with)', () => {
    const g = newGame(config);
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'prof')).toBe('purchased');
    loose(g).hackingProficiency = num(999);
    g.resleeve();
    expect(g.getState().hackingProficiency.toNumber()).toBeCloseTo(3, 9);
    g.resleeve();
    expect(g.getState().hackingProficiency.toNumber(), 'a log of a log: it keeps shrinking unless it is earned again').toBeCloseTo(
      Math.log10(4),
      9,
    );
  });

  it('gives nothing without the skill, and nothing from a proficiency of 0', () => {
    const g = newGame(config);
    loose(g).hackingProficiency = num(999);
    g.resleeve();
    expect(g.getState().hackingProficiency.toNumber()).toBe(0);
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'prof')).toBe('purchased');
    g.resleeve();
    expect(g.getState().hackingProficiency.toNumber()).toBe(0);
  });

  it('handles a huge proficiency without overflow', () => {
    const g = newGame(config);
    resleeveTimes(g, 1);
    tryBuy(g, 'prof');
    loose(g).hackingProficiency = num('1e300');
    g.resleeve();
    expect(g.getState().hackingProficiency.toNumber()).toBeCloseTo(300, 6);
  });
});

describe('Residual Firewall', () => {
  it('starts a new life at the last ICE Rating to the power of the share (half of its orders of magnitude)', () => {
    const g = newGame(config);
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'ice')).toBe('purchased');
    loose(g).iceRating = num('1e100');
    g.resleeve();
    expect(g.getState().iceRating.log10()).toBeCloseTo(50, 6);
  });

  it('never starts below the normal start, and does nothing without the skill', () => {
    const g = newGame(config);
    loose(g).iceRating = num('1e100');
    g.resleeve();
    expect(g.getState().iceRating.toNumber()).toBe(1);
    resleeveTimes(g, 1);
    tryBuy(g, 'ice');
    g.resleeve();
    expect(g.getState().iceRating.toNumber()).toBe(1);
  });

  it('survives a save and passes the invariants', () => {
    const g = newGame(config);
    resleeveTimes(g, 1);
    tryBuy(g, 'ice');
    loose(g).iceRating = num('1e100');
    g.resleeve();
    const loaded = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(loaded.iceRating.log10()).toBeCloseTo(50, 6);
    expect(findInvariantViolations(loaded, config)).toEqual([]);
  });
});
