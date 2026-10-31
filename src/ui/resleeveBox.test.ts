/**
 * The re-sleeve box's view: which state it is in and what it says, from plain inputs (no DOM).
 *
 * Purpose: the states (locked unaffordable and affordable, charging, ready; armed is the widget's), the progress percentage at 0,
 * partial, exactly met, over and huge values, NaN/Infinity clamped, and "to go" clamped at 0.
 * Called by: vitest. Calls: `resleeveBoxView`, `requirementFill`, the test config.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { testConfig } from '../testing/testConfig';
import { uiText } from './uiText';
import { requirementFill, resleeveBoxView } from './view/resleeveBox';

const level = (held: number, needed: number) => ({ kind: 'sleeveLevels' as const, held, needed });
const buy = (affordable: boolean) => ({ id: 'unlock', text: 'Unlock: 100 credits', priceText: '100 credits', tip: 'tip', affordable });
const engine = { costOf: () => num(100), currencyOf: () => 'credits' as const };

function box(opts: {
  credits?: number;
  canResleeve?: boolean;
  buy?: ReturnType<typeof buy> | null;
  shortfall?: ReturnType<typeof level>[];
}) {
  const state = { wallet: { credits: num(opts.credits ?? 0) } } as never;
  return resleeveBoxView(engine, state, testConfig, uiText, opts.canResleeve ?? false, opts.buy ?? null, opts.shortfall ?? []);
}

describe('requirementFill', () => {
  it('is 0 at nothing held, partial in between, 1 when met or over', () => {
    expect(requirementFill([level(0, 10)])).toBe(0);
    expect(requirementFill([level(5, 10)])).toBe(0.5);
    expect(requirementFill([level(10, 10)])).toBe(1);
    expect(requirementFill([level(30, 10)])).toBe(1);
  });
  it('follows the requirement furthest off', () => {
    expect(requirementFill([level(9, 10), level(1, 10)])).toBe(0.1);
  });
  it('clamps NaN, Infinity, negatives and zero needs', () => {
    expect(requirementFill([level(Number.NaN, 10)])).toBe(0);
    expect(requirementFill([level(5, Number.NaN)])).toBe(0);
    expect(requirementFill([level(5, Number.POSITIVE_INFINITY)])).toBe(0);
    expect(requirementFill([level(Number.POSITIVE_INFINITY, 10)])).toBe(1);
    expect(requirementFill([level(-4, 10)])).toBe(0);
    expect(requirementFill([level(0, 0)])).toBe(1);
  });
  it('stays in 0..1 for huge values', () => {
    expect(requirementFill([level(1e300, 4e300)])).toBe(0.25);
    expect(requirementFill([level(1e300, 1e-300)])).toBe(1);
  });
});

describe('resleeveBoxView states', () => {
  it('locked and short of the price: a disabled unlock with what is held and what is left', () => {
    const v = box({ buy: buy(false), credits: 40 });
    expect(v).toMatchObject({ kind: 'locked', enabled: false, fill: null, buyId: 'unlock', priceText: '100 credits' });
    expect(v.lines.at(-1)).toBe('you have 40 credits · 60 credits to go');
  });
  it('locked and affordable: the unlock is enabled and nothing is "to go"', () => {
    const v = box({ buy: buy(true), credits: 250 });
    expect(v.enabled).toBe(true);
    expect(v.lines.at(-1)).toBe('you have 250 credits');
  });
  it('"to go" is clamped at 0: an unaffordable flag with credits above the price shows no negative', () => {
    expect(box({ buy: buy(false), credits: 250 }).lines.at(-1)).toBe('you have 250 credits');
  });
  it('charging: a bar at the share met, the percentage as the status, one line per requirement, button disabled', () => {
    const v = box({ shortfall: [level(76, 120)] });
    expect(v).toMatchObject({ kind: 'charging', enabled: false, status: '63%' });
    expect(v.fill).toBeCloseTo(76 / 120);
    expect(v.lines).toEqual(['needs 120 sleeve levels across all actions · you have 76']);
  });
  it('charging with no requirement (the lockout): no bar', () => {
    expect(box({})).toMatchObject({ kind: 'charging', fill: null, lines: [], enabled: false });
  });
  it('never shows 100% before it is ready', () => {
    expect(box({ shortfall: [level(9999, 10000)] }).status).toBe('99%');
  });
  it('ready: full bar, enabled, and the on-arrival line shares the ledger words', () => {
    const v = box({ canResleeve: true });
    expect(v).toMatchObject({ kind: 'ready', fill: 1, enabled: true });
    expect(v.lines[0]).toContain(v.ledger.find((l) => l.tone === 'gain')?.text);
    expect(v.ledger.map((l) => l.tone)).toEqual(['lose', 'keep', 'gain']);
  });
});
