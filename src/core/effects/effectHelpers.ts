/**
 * @module core
 *
 * Small pieces the registry entries share: the common trait sets, a clamped natural logarithm, the no-op validator and a
 * validator for "factor >= 1".
 *
 * Called by: `effects/entries/*`, `effectRegistry.ts`.
 */
import type { BigNum } from '../../numbers';
import type { EffectContext, EffectTraits } from './effectTypes';

export const sleeveWide: EffectTraits = { needsAction: false, toggleable: false };
export const corporate: EffectTraits = { needsAction: false, toggleable: false, corporate: true };
export const perAction: EffectTraits = { needsAction: true, toggleable: false };

/** `ln(n)`, but never below 0 (so a network of 0 or 1 nodes adds nothing). */
export function naturalLog(n: BigNum): number {
  const ln = n.log10() * Math.LN10;
  return Number.isFinite(ln) && ln > 0 ? ln : 0;
}

export const none = (): void => {};

export function factorAtLeastOne(e: { kind: string; factor: number }, { where, errors }: EffectContext): void {
  if (!(Number.isFinite(e.factor) && e.factor >= 1)) errors.push(`${where}: ${e.kind} factor must be >= 1`);
}
