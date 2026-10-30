/**
 * The credits per second of a finished run is the PEAK of the life (own network only), not the rate at the moment of re-sleeving.
 */
import { describe, expect, it } from 'vitest';
import { numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { asSave, flatSave } from '../../testing/saveKit';
import { deserializeState, serializeState } from '..';
import { mutable, newGame, withNodes } from '../../testing/resleeveTreeKit';

describe('the credits per second of a finished run is the peak of the life', () => {
  it('keeps the best rate even when the income fell before the re-sleeve (heat tax raised afterwards)', () => {
    const g = newGame();
    withNodes(g, 1000);
    g.tick(1_000); // 1000 nodes x 0.05 = 50 per second
    mutable(g).heat = 40; // 40% tax: the rate at the moment of re-sleeving is 30
    g.resleeve();
    expect(g.getState().wallet.runs[0]!.creditsPerSecond.toNumber()).toBeCloseTo(50, 9);
  });

  it('counts the rate at the moment of re-sleeving too, when no slice ran since', () => {
    const g = newGame();
    withNodes(g, 1000);
    g.resleeve();
    expect(g.getState().wallet.runs[0]!.creditsPerSecond.toNumber()).toBeCloseTo(50, 9);
  });

  it('starts every life at 0: the peak of one life never leaks into the next', () => {
    const g = newGame();
    withNodes(g, 1000);
    g.tick(1_000);
    expect(g.getState().sleeve.peakNetworkIncome.toNumber()).toBeCloseTo(50, 9);
    g.resleeve();
    expect(g.getState().sleeve.peakNetworkIncome.isZero()).toBe(true);
    g.resleeve();
    expect(g.getState().wallet.runs[1]!.creditsPerSecond.isZero()).toBe(true);
  });

  it('one long tick and many short ones note the same peak', () => {
    const long = newGame();
    const short = newGame();
    for (const g of [long, short]) withNodes(g, 1000);
    long.tick(60_000);
    for (let i = 0; i < 600; i++) short.tick(100);
    expect(short.getState().sleeve.peakNetworkIncome.toNumber()).toBe(long.getState().sleeve.peakNetworkIncome.toNumber());
    long.resleeve();
    short.resleeve();
    expect(short.getState().wallet.runs[0]!.creditsPerSecond.toNumber()).toBe(long.getState().wallet.runs[0]!.creditsPerSecond.toNumber());
    expect(findInvariantViolations(long.getState(), long.getConfig())).toEqual([]);
  });

  it('is saved with the life and a save without it loads fresh', () => {
    const g = newGame();
    withNodes(g, 1000);
    g.tick(1_000);
    const text = serializeState(g.getState());
    const back = deserializeState(text, g.getConfig(), numberFactory)!;
    expect(back.sleeve.peakNetworkIncome.toNumber()).toBeCloseTo(50, 9);
    const data = flatSave(text);
    delete data['peakNetworkIncome'];
    const old = deserializeState(asSave(data), g.getConfig(), numberFactory)!;
    expect(old.sleeve.peakNetworkIncome.isZero()).toBe(true);
  });
});
