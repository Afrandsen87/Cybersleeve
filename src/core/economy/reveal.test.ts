import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { createConfig } from '../config/config';

/** Test content: Auto-run costs 10, Dual 15, Speed 100, Access 1000. */
const game = (orders?: number, credits = 0) =>
  createGame({
    config: createConfig(testConfig, {
      ...(orders === undefined ? {} : { reveal: { buyableOrders: orders } }),
      progression: { startingCredits: credits },
    }),
  });

describe('buyables are revealed when their price is within reach', () => {
  it('shows everything when no reveal rule is configured', () => {
    const g = game();
    expect(g.isBuyableRevealed('access')).toBe(true);
  });

  it('shows a purchase priced within 3 orders of magnitude of the credits held, and hides dearer ones', () => {
    const g = game(3, 1);
    // 1 credit held: up to 1,000 is within 3 orders of magnitude
    expect(g.isBuyableRevealed('auto')).toBe(true);
    expect(g.isBuyableRevealed('access')).toBe(true); // exactly 1000
    expect(g.isBuyableRevealed('speed')).toBe(true);
    const far = game(1, 1); // only up to 10x
    expect(far.isBuyableRevealed('auto')).toBe(true);
    expect(far.isBuyableRevealed('dual')).toBe(false);
    expect(far.isBuyableRevealed('access')).toBe(false);
  });

  it('counts a peak below one as one: a new game with nothing held still shows the cheap purchases only', () => {
    const g = game(1, 0);
    expect(g.isBuyableRevealed('auto')).toBe(true); // 10 <= 1 x 10
    expect(g.isBuyableRevealed('dual')).toBe(false); // 15 > 10
  });

  it('keeps a purchase shown after the credits that revealed it are spent', () => {
    const g = game(1, 10);
    expect(g.isBuyableRevealed('dual')).toBe(true); // 15 <= 10 x 10
    expect(g.buy('auto')).toBe('purchased'); // credits fall to 0
    expect(g.getState().credits.eq(num(0))).toBe(true);
    expect(g.isBuyableRevealed('dual')).toBe(true);
  });

  it('keeps owned purchases shown and raises the window as credits are earned', () => {
    const g = game(1, 0);
    expect(g.isBuyableRevealed('speed')).toBe(false);
    (g.getState() as { credits: unknown }).credits = num(10);
    g.tick(1);
    expect(g.isBuyableRevealed('speed')).toBe(true); // 100 <= 10 x 10
  });

  it('resets with a re-sleeve: the peaks start again from what a new life holds', () => {
    const g = game(1, 10);
    g.tick(1);
    expect(g.getState().peakCredits.gte(num(10))).toBe(true);
    g.resleeve();
    expect(g.getState().peakCredits.eq(num(10))).toBe(true);
  });
});
