/**
 * @module testing
 *
 * What the invariant checks share: the config they read, the way a problem is reported, and the number tests they use.
 */
import type { BigNum } from '../../numbers';
import type { GameConfig, GameStateView } from '../../core';

/** Config sections the checks read. */
export type InvariantConfig = Pick<GameConfig, 'actions' | 'buyables' | 'corporation' | 'focus' | 'sleeve' | 'items' | 'progression'>;

/** One area of the invariants: reads the state and the content and pushes a message per violation onto `problems`. */
export type InvariantCheck = (state: GameStateView, config: InvariantConfig, problems: string[]) => void;

/** True for a finite, non-negative, non-NaN amount. */
export const validAmount = (n: BigNum): boolean => n.isFinite() && !n.isNegative() && !n.isNaN();
/** True for a whole number >= 0. */
export const validCount = (n: number): boolean => Number.isInteger(n) && n >= 0;

/**
 * Whole, to within the precision of the number type. The big-number type keeps a mantissa and an exponent, so above about 1e8 it
 * cannot hold every integer exactly (200003671 reads back as 200003670.99999997). A real fraction of a node is still caught wherever
 * a fraction can be told apart from rounding noise.
 */
export const isWhole = (n: BigNum): boolean => {
  if (n.floor().eq(n)) return true;
  const v = n.toNumber();
  return Number.isFinite(v) && Math.abs(v - Math.round(v)) <= Math.abs(v) * 1e-12;
};
