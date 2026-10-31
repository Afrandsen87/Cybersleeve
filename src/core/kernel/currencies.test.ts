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
  isSleeveSkill,
  sleeveSkillIds,
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

  it('only sleeve skill points are carried over a re-sleeve', () => {
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

describe('the sleeve skills', () => {
  it('are exactly the buyables paid in the one currency that is flagged for them', () => {
    expect(CURRENCY_IDS.filter((c) => CURRENCIES[c].sleeveSkills === true)).toEqual(['resleevePoints']);
    expect(isSleeveSkill({ currency: 'resleevePoints' })).toBe(true);
    for (const currency of CURRENCY_IDS.filter((c) => c !== 'resleevePoints')) expect(isSleeveSkill({ currency })).toBe(false);
    expect(isSleeveSkill({})).toBe(false); // no currency means credits
  });

  it('treat an unknown currency as no sleeve skill, so config validation can report it instead of throwing', () => {
    expect(isSleeveSkill({ currency: 'doubloons' as unknown as Currency })).toBe(false);
  });

  it('are listed by id in the order given, and none for an empty list', () => {
    const buyables = [
      { id: 'a' },
      { id: 'b', currency: 'resleevePoints' as const },
      { id: 'c', currency: 'skillPoints' as const },
      { id: 'd', currency: 'resleevePoints' as const },
    ];
    expect(sleeveSkillIds(buyables)).toEqual(['b', 'd']);
    expect(sleeveSkillIds([])).toEqual([]);
  });
});
