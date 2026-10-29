/**
 * Synthetic sleeves in play, and what one earns (synthCreditsPerSecond).
 */
import { describe, expect, it } from 'vitest';
import { flat } from '../../testing/flatState';
import { num, numberFactory } from '../../numbers';
import { synthCreditsPerSecond } from '..';
import { atLevel, mutable, newGame, withNodes } from '../../testing/resleeveTreeKit';

describe('synthetic sleeves', () => {
  it('there are none without the skill, however many times the player re-sleeves', () => {
    const g = newGame();
    for (let i = 0; i < 4; i++) g.resleeve();
    expect(g.getState().wallet.runs).toHaveLength(4);
    expect(g.getState().wallet.synths).toEqual([]);
    expect(g.synthCount()).toBe(0);
    expect(g.synthSleevesUnlocked()).toBe(false);
  });

  it('buying the skill gives one at once, copied from the last finished run; earlier runs are never copied', () => {
    const g = newGame();
    g.resleeve(); // run 0
    g.buy('eu');
    g.resleeve(); // run 1
    expect(g.synthCount()).toBe(0);
    g.buy('syn');
    expect(g.synthCount()).toBe(1);
    expect(g.getState().wallet.synths).toEqual([{ runIndex: 1 }]);
    expect(g.synthSleevesUnlocked()).toBe(true);
  });

  it('every re-sleeve after that gives one more, copied from the run that just ended', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve(); // run 2
    g.resleeve(); // run 3
    expect(g.getState().wallet.synths).toEqual([{ runIndex: 1 }, { runIndex: 2 }, { runIndex: 3 }]);
  });

  it('earns the final income of its run scaled by the levels reached so far, and stays at that amount once it has caught up', () => {
    const g = newGame();
    g.resleeve(); // run 0
    g.buy('eu');
    g.resleeve(); // run 1 (empty)
    g.buy('syn'); // a sleeve on run 1, which earned nothing
    withNodes(g, 1000);
    atLevel(g, 4);
    g.resleeve(); // run 2: 50 per second at a level total of 4, and a sleeve to copy it
    expect(g.getState().wallet.runs[2]!.actionLevelsTotal).toBe(4);
    expect(g.getState().wallet.synths).toEqual([{ runIndex: 1 }, { runIndex: 2 }]);
    const incomeAt = (level: number): number => {
      atLevel(g, level);
      return g.synthCreditsPerSecond().toNumber();
    };
    expect(incomeAt(1)).toBeCloseTo(12.5, 9);
    expect(incomeAt(2)).toBeCloseTo(25, 9);
    expect(incomeAt(3)).toBeCloseTo(37.5, 9);
    expect(incomeAt(4)).toBeCloseTo(50, 9);
    mutable(g).actions['a']!.xp = num('1e9'); // far past the recorded levels
    expect(g.actionLevel('a')).toBeGreaterThan(4);
    expect(g.synthCreditsPerSecond().toNumber()).toBeCloseTo(50, 9); // it does not keep growing
  });

  it('is paid into credits without the heat tax, on top of the network income', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    withNodes(g, 2000);
    atLevel(g, 1);
    g.resleeve(); // synthetic sleeves for the runs so far; the last one earned 100 per second at level 1
    atLevel(g, 1); // caught up at once
    withNodes(g, 0);
    mutable(g).heat = 50; // a heat tax would cut the network income in half; the synthetic income skips it
    mutable(g).credits = num(0);
    const perSecond = g.synthCreditsPerSecond().toNumber();
    expect(perSecond).toBeCloseTo(100, 9);
    g.tick(1_000);
    expect(g.getState().wallet.credits.toNumber()).toBeCloseTo(perSecond, 6);
  });

  it('pays the network income and the synthetic income together', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    withNodes(g, 1000);
    atLevel(g, 1);
    g.resleeve();
    atLevel(g, 1);
    withNodes(g, 400); // 20 per second of its own
    mutable(g).credits = num(0);
    const synthetic = g.synthCreditsPerSecond().toNumber();
    expect(synthetic).toBeCloseTo(50, 9);
    g.tick(1_000);
    expect(g.getState().wallet.credits.toNumber()).toBeCloseTo(20 + synthetic, 6);
  });

  it('each sleeve uses the numbers of the run it belongs to, and the total is their sum', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    const state = flat<{
      runs: { creditsPerSecond: unknown; actionLevelsTotal: number }[];
      synths: { runIndex: number }[];
    }>(g);
    state.runs.push({ creditsPerSecond: num(100), actionLevelsTotal: 4 }, { creditsPerSecond: num(30), actionLevelsTotal: 2 });
    state.synths.push({ runIndex: 2 }, { runIndex: 3 });
    atLevel(g, 1); // a quarter of the way to run 2, half of the way to run 3
    expect(g.synthCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.25 + 30 * 0.5, 9);
    atLevel(g, 3);
    expect(g.synthCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.75 + 30, 9); // the second has caught up and stays at 30
    expect(g.synthCount()).toBe(3);
  });

  it('a synthetic sleeve whose run had no action levels pays in full at once', () => {
    expect(synthCreditsPerSecond({ creditsPerSecond: num(7), actionLevelsTotal: 0 }, 0, numberFactory).toNumber()).toBe(7);
  });
});

describe('synthCreditsPerSecond', () => {
  const record = { creditsPerSecond: num(80), actionLevelsTotal: 8 };
  it.each([
    [0, 0],
    [1, 10],
    [4, 40],
    [8, 80],
    [9, 80],
    [1e9, 80],
  ])('at %d levels of a run of 8 levels and 80 per second it earns %d', (levels, expected) => {
    expect(synthCreditsPerSecond(record, levels, numberFactory).toNumber()).toBeCloseTo(expected, 9);
  });

  it('never goes below 0 or above the recorded amount, whatever it is given', () => {
    for (const levels of [-3, Number.NaN, 0, 3, 8, Number.POSITIVE_INFINITY]) {
      const v = synthCreditsPerSecond(record, levels, numberFactory).toNumber();
      expect(v, `levels ${levels}`).toBeGreaterThanOrEqual(0);
      expect(v, `levels ${levels}`).toBeLessThanOrEqual(80);
    }
  });
});
