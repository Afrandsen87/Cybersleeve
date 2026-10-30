/**
 * Auto Burn, the toggle and the lead use: skill 1 (the Inventory toggle, one lead a second), "hold" (skill 2), the reserve (skill 10) and
 * the thresholds (skill 9). The switching of Overclocks and Auto-runs is in `autoBurnSwitches.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { burnGame, burnState } from '../../testing/autoBurnKit';
import { findInvariantViolations } from '../../testing/invariants';
import { burnConfig } from '../../testing/autoBurnKit';

const leadsOf = (g: ReturnType<typeof burnGame>): number => burnState(g).inventory['lead']?.['common'] ?? 0;

describe('the Burn lead toggle (skill 1)', () => {
  it('before the first skill the lead is a click that uses one lead, and there is no toggle', () => {
    const g = burnGame(0, 10, 100);
    expect(g.burnLeadToggle()).toBeNull();
    expect(g.automation().autoBurn().toggle()).toBe(false);
    expect(g.useBurnLead('common')).toBe(true);
    expect(leadsOf(g)).toBe(9);
  });

  it('with the first skill it is a toggle that starts off, and nothing is used while it is off', () => {
    const g = burnGame(1, 10, 100);
    expect(g.burnLeadToggle()).toEqual({ on: false, hold: false, lower: 10, reserve: 0 });
    g.tick(5_000);
    expect(leadsOf(g)).toBe(10);
    expect(g.toggleBurnLead()).toBe(true);
    expect(g.burnLeadToggle()?.on).toBe(true);
    expect(g.toggleBurnLead()).toBe(false);
  });

  it('while on, one lead is used every second while there is heat', () => {
    const g = burnGame(1, 100, 100);
    g.toggleBurnLead();
    g.tick(10_000);
    expect(leadsOf(g)).toBe(90);
    expect(burnState(g).heat).toBeLessThan(100 * 0.95 ** 10 + 1e-6);
  });

  it('uses none at 0 heat, even while on', () => {
    const g = burnGame(1, 100, 0);
    g.toggleBurnLead();
    g.tick(10_000);
    expect(leadsOf(g)).toBe(100);
  });

  it('never uses more than are held', () => {
    const g = burnGame(1, 3, 100);
    g.toggleBurnLead();
    g.tick(60_000);
    expect(leadsOf(g)).toBe(0);
    expect(findInvariantViolations(g.getState(), burnConfig)).toEqual([]);
  });

  it('one long tick and many short ones use the same number of leads and leave the same heat', () => {
    const run = (ticks: number, each: number) => {
      const g = burnGame(1, 100, 100);
      g.toggleBurnLead();
      for (let i = 0; i < ticks; i++) g.tick(each);
      return { leads: leadsOf(g), heat: burnState(g).heat };
    };
    const long = run(1, 60_000);
    expect(long.leads).toBe(40);
    for (const shortRun of [run(60, 1_000), run(3_750, 16), run(600, 100)]) {
      expect(shortRun.leads).toBe(long.leads);
      expect(shortRun.heat).toBeCloseTo(long.heat, 6);
    }
  });
});

describe('hold at the lower threshold (skill 2)', () => {
  it('the switch needs its skill', () => {
    const g = burnGame(1);
    expect(g.automation().autoBurn().setSwitch('hold', true)).toBe(false);
    expect(g.automation().autoBurn().rules().hold).toBe(false);
  });

  it('uses just enough leads to bring heat to the lower threshold: 100 to 10 takes 45 leads at 5% each', () => {
    const g = burnGame(2, 100, 100);
    expect(g.automation().autoBurn().setSwitch('hold', true)).toBe(true);
    g.toggleBurnLead();
    g.tick(100);
    // outcome: the fewest leads that leave at most the threshold: 100 x 0.95^45 = 9.9, while 44 leave 10.46
    expect(leadsOf(g)).toBe(55);
    expect(burnState(g).heat).toBeLessThanOrEqual(10);
    expect(burnState(g).heat).toBeGreaterThan(10 * 0.95);
  });

  it('uses every lead there is when they cannot reach the threshold, and none at or below it', () => {
    const few = burnGame(2, 3, 100);
    few.automation().autoBurn().setSwitch('hold', true);
    few.toggleBurnLead();
    few.tick(100);
    expect(leadsOf(few)).toBe(0);
    expect(burnState(few).heat).toBeCloseTo(100 * 0.95 ** 3, 1);
    const cool = burnGame(2, 10, 5);
    cool.automation().autoBurn().setSwitch('hold', true);
    cool.toggleBurnLead();
    cool.tick(10_000);
    expect(leadsOf(cool)).toBe(10);
  });

  it('with the switch off the toggle goes back to one lead a second', () => {
    const g = burnGame(2, 100, 100);
    g.automation().autoBurn().setSwitch('hold', true);
    g.automation().autoBurn().setSwitch('hold', false);
    g.toggleBurnLead();
    g.tick(5_000);
    expect(leadsOf(g)).toBe(95);
  });
});

describe('the thresholds (skill 9) and the reserve (skill 10)', () => {
  it('are fixed at the configured start until their skills are owned, and refuse to be set', () => {
    const g = burnGame(8);
    const burn = g.automation().autoBurn();
    expect(burn.setThresholds(5, 60)).toBe(false);
    expect(burn.setReserve(5)).toBe(false);
    expect(burn.rules()).toMatchObject({ lower: 10, upperAt: 50, reserve: 0 });
  });

  it('can be edited once owned, and only to finite values with 0 <= lower < upper', () => {
    const burn = burnGame(10).automation().autoBurn();
    expect(burn.setThresholds(5, 60)).toBe(true);
    expect(burn.rules()).toMatchObject({ lower: 5, upperAt: 60 });
    for (const [lower, upper] of [
      [-1, 60],
      [60, 60],
      [70, 60],
      [Number.NaN, 60],
      [5, Number.POSITIVE_INFINITY],
    ] as const) {
      expect(burn.setThresholds(lower, upper)).toBe(false);
    }
    expect(burn.rules()).toMatchObject({ lower: 5, upperAt: 60 });
    expect(burn.setReserve(7.9)).toBe(true);
    expect(burn.rules().reserve).toBe(7);
    expect(burn.setReserve(-1)).toBe(false);
    expect(burn.setReserve(Number.NaN)).toBe(false);
    expect(burn.rules().reserve).toBe(7);
  });

  it('hold uses the edited lower threshold', () => {
    const g = burnGame(10, 1_000, 100);
    const burn = g.automation().autoBurn();
    burn.setThresholds(50, 90);
    burn.setSwitch('hold', true);
    g.toggleBurnLead();
    g.tick(100);
    expect(burnState(g).heat).toBeLessThanOrEqual(50);
    expect(burnState(g).heat).toBeGreaterThan(50 * 0.95);
  });

  it('the reserve is never used, by one lead a second or by hold', () => {
    const slow = burnGame(10, 8, 100);
    slow.automation().autoBurn().setReserve(5);
    slow.toggleBurnLead();
    slow.tick(60_000);
    expect(leadsOf(slow)).toBe(5);
    const hold = burnGame(10, 100, 100);
    hold.automation().autoBurn().setReserve(80);
    hold.automation().autoBurn().setSwitch('hold', true);
    hold.toggleBurnLead();
    hold.tick(100);
    expect(leadsOf(hold)).toBe(80);
  });

  it('a reserve above what is held leaves every lead alone', () => {
    const g = burnGame(10, 4, 100);
    g.automation().autoBurn().setReserve(50);
    g.toggleBurnLead();
    g.tick(10_000);
    expect(leadsOf(g)).toBe(4);
  });
});
