import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { game } from '../../testing/gameKit';
import type { GameState } from '../types';
import {
  CARRIED_OVER_CURRENCIES,
  CURRENCIES,
  CURRENCY_IDS,
  type Currency,
  DEFAULT_CURRENCY,
  type PointCurrency,
  currencyInfo,
  heldBalance,
  isPointCurrency,
  spendHeld,
} from './currencies';

/** The points currencies as the `PointCurrency` type lists them (the compiler checks each name; the test checks none is missed). */
const POINTS: readonly PointCurrency[] = ['skillPoints', 'resleevePoints', 'automationPoints'];

describe('currency descriptors', () => {
  it('PointCurrency is exactly the currencies without a held balance', () => {
    const withoutHeld = CURRENCY_IDS.filter((c) => CURRENCIES[c].held === undefined);
    expect([...withoutHeld].sort()).toEqual([...POINTS].sort());
    for (const c of CURRENCY_IDS) expect(isPointCurrency(c), c).toBe(POINTS.includes(c as PointCurrency));
  });

  it('a missing currency means the default one, which is held', () => {
    expect(currencyInfo(undefined)).toBe(CURRENCIES[DEFAULT_CURRENCY]);
    expect(isPointCurrency(undefined)).toBe(false);
  });

  it('every currency that is judged for reveal by price names the peak it is compared to', () => {
    for (const c of CURRENCY_IDS) {
      const d = CURRENCIES[c];
      expect(d.alwaysRevealed === true || d.peak !== undefined, c).toBe(true);
    }
  });

  it('only re-sleeve points are carried over a re-sleeve', () => {
    expect(CARRIED_OVER_CURRENCIES).toEqual(['resleevePoints']);
  });
});

describe('held balances', () => {
  const state = () => game().getState() as GameState;

  it('reads and spends the balance the descriptor names', () => {
    const s = state();
    s.wallet.credits = num(10);
    s.sleeve.network = num(7);
    expect(heldBalance(s, 'credits').toNumber()).toBe(10);
    expect(heldBalance(s, undefined).toNumber()).toBe(10);
    expect(heldBalance(s, 'networkNodes').toNumber()).toBe(7);
    spendHeld(s, 'networkNodes', num(3));
    spendHeld(s, undefined, num(4));
    expect(s.sleeve.network.toNumber()).toBe(4);
    expect(s.wallet.credits.toNumber()).toBe(6);
  });

  it('points are not held: spending takes nothing, reading one is an error', () => {
    const s = state();
    s.wallet.credits = num(10);
    s.sleeve.network = num(7);
    for (const c of POINTS) {
      spendHeld(s, c as Currency, num(5));
      expect(() => heldBalance(s, c)).toThrow();
    }
    expect(s.wallet.credits.toNumber()).toBe(10);
    expect(s.sleeve.network.toNumber()).toBe(7);
  });
});
