/**
 * @module numbers
 *
 * Adapter: implements {@link BigNum} on top of the `break_infinity.js` library.
 *
 * @remarks
 * This is the ONLY file allowed to import `break_infinity.js`.
 * Range of the library: roughly 1e(+/-1.79e308). Precision: ~15 significant digits.
 */
import Decimal from 'break_infinity.js';
import type { BigNum, NumberFactory } from './BigNum';

/**
 * The library saturates at an exponent of 9e15 (it has no real Infinity: overflow
 * becomes `1e9000000000000000`). We treat anything at or beyond this as non-finite,
 * so game code can detect overflow and trigger its "infinity" prestige.
 */
const EXPONENT_LIMIT = 9e15;

/** {@link BigNum} backed by a `break_infinity.js` Decimal. */
class BreakInfinityNum implements BigNum {
  constructor(private readonly value: Decimal) {}

  add(other: BigNum): BigNum {
    return new BreakInfinityNum(this.value.add(unwrap(other)));
  }
  sub(other: BigNum): BigNum {
    return new BreakInfinityNum(this.value.sub(unwrap(other)));
  }
  mul(other: BigNum): BigNum {
    return new BreakInfinityNum(this.value.mul(unwrap(other)));
  }
  div(other: BigNum): BigNum {
    return new BreakInfinityNum(this.value.div(unwrap(other)));
  }
  floor(): BigNum {
    return new BreakInfinityNum(this.value.floor());
  }
  pow(exponent: number): BigNum {
    return new BreakInfinityNum(this.value.pow(exponent));
  }

  lt(other: BigNum): boolean {
    return this.value.lt(unwrap(other));
  }
  lte(other: BigNum): boolean {
    return this.value.lte(unwrap(other));
  }
  gt(other: BigNum): boolean {
    return this.value.gt(unwrap(other));
  }
  gte(other: BigNum): boolean {
    return this.value.gte(unwrap(other));
  }
  eq(other: BigNum): boolean {
    return this.value.eq(unwrap(other));
  }

  isZero(): boolean {
    return this.value.eq(0);
  }
  isNegative(): boolean {
    return this.value.lt(0);
  }
  /** False when the value is NaN or at/after the library saturation point (exponent >= 9e15). */
  isFinite(): boolean {
    return Number.isFinite(this.value.m) && Math.abs(this.value.e) < EXPONENT_LIMIT;
  }

  /** Order of magnitude via the stored exponent (exact at powers of ten); `-Infinity` for zero. */
  floorLog10(): number {
    return this.isZero() ? -Infinity : this.value.e;
  }
  log10(): number {
    return this.value.log10();
  }
  exponent(): number {
    return this.isZero() ? 0 : this.value.e;
  }
  mantissa(): number {
    return this.isZero() ? 0 : this.value.m;
  }

  toNumber(): number {
    return this.value.toNumber();
  }
  toString(): string {
    return this.value.toString();
  }

  /** @internal Used by sibling instances to read the wrapped Decimal. */
  get decimal(): Decimal {
    return this.value;
  }
}

/** Reads the Decimal from a BigNum created by this adapter. */
function unwrap(n: BigNum): Decimal {
  if (n instanceof BreakInfinityNum) return n.decimal;
  // Foreign implementation: go through the lossless string form.
  return Decimal.fromString(n.toString());
}

/** Production {@link NumberFactory}. */
export const numberFactory: NumberFactory = {
  fromNumber: (v) => new BreakInfinityNum(Decimal.fromNumber(v)),
  fromString: (v) => new BreakInfinityNum(Decimal.fromString(v)),
  maxValue: () => new BreakInfinityNum(Decimal.fromMantissaExponent(9.999999999999, EXPONENT_LIMIT - 1)),
};

/**
 * Convenience constructor for literals in game content and tests.
 * @param value number or lossless string
 */
export function num(value: number | string): BigNum {
  return typeof value === 'number' ? numberFactory.fromNumber(value) : numberFactory.fromString(value);
}
