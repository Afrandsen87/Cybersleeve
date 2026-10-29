/**
 * Re-sleeve points and what a re-sleeve keeps.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { createConfig } from '..';
import { atLevel, config, mutable, newGame } from '../../testing/resleeveTreeKit';

describe('re-sleeve points', () => {
  it('a new game has none, and every re-sleeve gives `pointsPerResleeve`', () => {
    const g = newGame();
    expect(g.resleevePoints()).toBe(0);
    g.resleeve();
    expect(g.resleevePoints()).toBe(1);
    g.resleeve();
    expect(g.resleevePoints()).toBe(2);
    const triple = newGame(createConfig(config, { resleeve: { pointsPerResleeve: 3 } }));
    triple.resleeve();
    expect(triple.resleevePoints()).toBe(3);
  });

  it('a skill costs a point, and buying it leaves the rest; points are never lost by re-sleeving', () => {
    const g = newGame();
    g.resleeve();
    g.resleeve();
    expect(g.buy('eu')).toBe('purchased');
    expect(g.resleevePoints()).toBe(1);
    g.resleeve();
    expect(g.resleevePoints()).toBe(2); // earned 3, spent 1
  });

  it('cannot buy without a point, and the tree is bought from the top', () => {
    const g = newGame();
    expect(g.canBuy('eu')).toBe(false);
    expect(g.buy('eu')).toBe('cannot-afford');
    g.resleeve();
    expect(g.isBuyableAvailable('syn')).toBe(false);
    expect(g.buy('syn')).toBe('locked');
    expect(g.buy('eu')).toBe('purchased');
    expect(g.isBuyableAvailable('syn')).toBe(true);
    expect(g.isBuyableAvailable('inc')).toBe(true);
  });

  it('skill points and re-sleeve points are separate: each pays only its own skills', () => {
    const g = newGame();
    g.resleeve();
    expect(g.skillPoints()).toBe(0);
    expect(g.resleevePoints()).toBe(1);
    atLevel(g, 1); // the first skill point
    expect(g.skillPoints()).toBe(1);
    expect(g.resleevePoints()).toBe(1);
  });
});

describe('what a re-sleeve keeps', () => {
  it('keeps the re-sleeve skills; the rest of what was bought is gone', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    mutable(g).credits = num(100);
    g.buy('cheap');
    expect(g.ownedCount('cheap')).toBe(1);
    g.resleeve();
    expect(g.ownedCount('eu')).toBe(1);
    expect(g.ownedCount('cheap')).toBe(0);
  });

  it('keeps the record of runs and the synthetic sleeves, and a new game clears them with the skills', () => {
    const g = newGame();
    g.resleeve();
    g.buy('eu');
    g.resleeve();
    g.buy('syn');
    g.resleeve();
    expect(g.getState().wallet.runs).toHaveLength(3);
    expect(g.getState().wallet.synths).toHaveLength(2);
    g.newGame();
    expect(g.getState().wallet.runs).toEqual([]);
    expect(g.getState().wallet.synths).toEqual([]);
    expect(g.ownedCount('eu')).toBe(0);
    expect(g.resleevePoints()).toBe(0);
  });
});
