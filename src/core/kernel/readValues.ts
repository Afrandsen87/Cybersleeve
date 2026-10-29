/**
 * @module core
 *
 * Defensive readers for plain values in a save, shared by every context's save part.
 *
 * @remarks
 * Nothing in a save is trusted. Every reader turns what it cannot use into the neutral value (0, empty, off) or throws, so that the caller can
 * decide whether the whole save is unusable. Lives in the kernel so that a context can read its own saved part without importing `save/`.
 */
import type { BigNum, NumberFactory } from '../../numbers';

/**
 * True for a plain object (not null, not an array).
 *
 * Called by: every save part's `read`. Calls: nothing.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Reads a whole number >= 0 (anything else is 0).
 *
 * Called by: save parts. Calls: nothing.
 */
export function readCount(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/**
 * Reads a finite numeric string.
 *
 * Called by: {@link readAmount}. Calls: `factory.fromString`.
 *
 * @throws Error if the value is not a numeric string or not finite
 */
export function readNum(v: unknown, factory: NumberFactory): BigNum {
  if (typeof v !== 'string') throw new Error('expected numeric string');
  const n = factory.fromString(v);
  if (!n.isFinite()) throw new Error('non-finite number');
  return n;
}

/**
 * Reads a finite amount; negative amounts become 0.
 *
 * Called by: save parts. Calls: {@link readNum}.
 *
 * @throws Error if the value is not a numeric string or not finite
 */
export function readAmount(v: unknown, factory: NumberFactory): BigNum {
  const n = readNum(v, factory);
  return n.isNegative() ? factory.fromNumber(0) : n;
}

/**
 * Reads the progress of a run: a share of the run, finite and from 0 up to (not including) 1, otherwise 0.
 *
 * Called by: the actions save part. Calls: nothing.
 */
export function readProgress(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0;
}
