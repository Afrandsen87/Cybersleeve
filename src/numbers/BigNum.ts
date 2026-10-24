/**
 * @packageDocumentation
 * @module numbers
 *
 * Abstraction over large-number arithmetic.
 *
 * @remarks
 * Game code depends ONLY on this interface (dependency inversion). The concrete
 * library lives in {@link ./BreakInfinityNum.ts}; swapping it must not touch game code.
 */

/**
 * An immutable, arbitrarily large (mantissa/exponent) number.
 *
 * @remarks
 * All operations return new values. Implementations must never throw on overflow:
 * results beyond representable range become non-finite and {@link BigNum.isFinite}
 * reports `false`, so the game can react (e.g. a future "infini" prestige).
 *
 * Called by: every module in `core`, `content`, `ui`, `app`.
 */
export interface BigNum {
  /** Returns `this + other`. */
  add(other: BigNum): BigNum;
  /** Returns `this - other`. */
  sub(other: BigNum): BigNum;
  /** Returns `this * other`. */
  mul(other: BigNum): BigNum;
  /** Returns `this / other`. */
  div(other: BigNum): BigNum;
  /** Returns the largest integer value not greater than this. */
  floor(): BigNum;
  /** Returns `this` raised to a (JS number) exponent. */
  pow(exponent: number): BigNum;

  /** `this < other` */
  lt(other: BigNum): boolean;
  /** `this <= other` */
  lte(other: BigNum): boolean;
  /** `this > other` */
  gt(other: BigNum): boolean;
  /** `this >= other` */
  gte(other: BigNum): boolean;
  /** `this == other` (exact for the underlying representation). */
  eq(other: BigNum): boolean;

  /** True when the value is exactly zero. */
  isZero(): boolean;
  /** True when the value is strictly below zero (false for zero, NaN and positive overflow). */
  isNegative(): boolean;
  /** False for NaN or +/-Infinity (overflow). */
  isFinite(): boolean;

  /**
   * `floor(log10(|value|))`, i.e. the order of magnitude.
   * @returns the order of magnitude, or `-Infinity` for zero.
   */
  floorLog10(): number;
  /** Base-10 logarithm as a JS number (lossy near powers of ten; use {@link BigNum.floorLog10} for exact orders). */
  log10(): number;
  /** Base-10 exponent of the scientific notation (`m * 10^e`, `1 <= |m| < 10`). */
  exponent(): number;
  /** Mantissa of the scientific notation (`1 <= |m| < 10`), or 0 for zero. */
  mantissa(): number;

  /** Lossy conversion; overflows to `Infinity` above `Number.MAX_VALUE`. */
  toNumber(): number;
  /** Lossless string, parseable by {@link NumberFactory.fromString}. */
  toString(): string;
}

/**
 * Creates {@link BigNum} values. Injected where numbers must be constructed.
 *
 * Called by: `core/serialization`, `content`, tests.
 */
export interface NumberFactory {
  /** Creates a value from a JS number. */
  fromNumber(value: number): BigNum;
  /** Creates a value from a string produced by {@link BigNum.toString}. */
  fromString(value: string): BigNum;
  /** The largest value that still counts as finite; used to clamp overflowing amounts. */
  maxValue(): BigNum;
}
