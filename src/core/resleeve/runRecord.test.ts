/**
 * The record of finished sleeve-runs.
 */
import { describe, expect, it } from 'vitest';
import { atLevel, mutable, newGame, withNodes } from '../../testing/resleeveTreeKit';

describe('the record of finished runs', () => {
  it('writes every run down, whatever skills are owned', () => {
    const g = newGame();
    withNodes(g, 1000);
    atLevel(g, 3);
    g.resleeve();
    const [run] = g.getState().wallet.runs;
    expect(g.getState().wallet.runs).toHaveLength(1);
    expect(run!.creditsPerSecond.toNumber()).toBeCloseTo(50, 9); // 1000 nodes x 0.05
    expect(run!.actionLevelsTotal).toBe(3);
    g.resleeve();
    expect(g.getState().wallet.runs).toHaveLength(2);
    expect(g.getState().wallet.runs[1]!.creditsPerSecond.isZero()).toBe(true); // an empty life earned nothing
    expect(g.getState().wallet.runs[1]!.actionLevelsTotal).toBe(0);
  });

  it('writes down the income after the heat tax', () => {
    const g = newGame();
    withNodes(g, 1000);
    mutable(g).heat = 40; // 40% tax
    g.resleeve();
    expect(g.getState().wallet.runs[0]!.creditsPerSecond.toNumber()).toBeCloseTo(30, 9);
  });

  it("writes down the sleeve's own income only: synthetic income is not part of it, so nothing compounds", () => {
    const g = newGame();
    withNodes(g, 1000);
    atLevel(g, 2);
    g.resleeve(); // run 0: 50 per second
    g.buy('eu');
    g.resleeve(); // run 1: an empty life
    g.buy('syn'); // a synthetic sleeve copies run 1 (nothing), the skill came too late for run 0
    g.resleeve();
    withNodes(g, 0);
    g.resleeve();
    expect(g.getState().wallet.runs.map((r) => r.creditsPerSecond.toNumber())).toEqual([50, 0, 0, 0]);
  });
});
