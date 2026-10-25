/**
 * @module numbers
 *
 * Human-readable formatting of {@link BigNum} values.
 */
import type { BigNum } from './BigNum';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const SUFFIX_LIMIT_GROUP = SUFFIXES.length - 1;

/** Fixed decimals, trailing zeros removed ("0.50" -> "0.5", "10.00" -> "10"). */
function trimmed(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toString();
}

/**
 * Formats a number for display.
 *
 * @remarks
 * - `< 1000`: up to `decimals` decimals, trailing zeros trimmed (`0.5`, `12`, `999.99`).
 * - `1e3 .. < 1e36`: suffix notation (`1.5K`, `2.35M`, ...).
 * - above that: scientific (`1.23e45`).
 * - non-finite: `"Infinity"`.
 * Rounding carries correctly (999.999K shows as `1M`).
 *
 * @param n value to format
 * @param decimals decimals kept (default 2)
 * @returns display string
 */
export function formatBigNum(n: BigNum, decimals = 2): string {
  if (!n.isFinite()) return 'Infinity';
  if (n.isZero()) return '0';

  const exponent = n.exponent();
  const mantissa = n.mantissa();
  const sign = mantissa < 0 ? '-' : '';
  const absMantissa = Math.abs(mantissa);

  if (exponent < -decimals - 2) return sign + scientific(absMantissa, exponent, decimals);
  if (exponent < 3) {
    // Small values keep enough decimals to show their first significant digits (0.001 is not "0").
    const places = exponent < -2 ? decimals - exponent - 2 : decimals;
    return sign + trimmed(absMantissa * 10 ** exponent, places);
  }

  let group = Math.floor(exponent / 3);
  if (group > SUFFIX_LIMIT_GROUP) return sign + scientific(absMantissa, exponent, decimals);

  let scaled = absMantissa * 10 ** (exponent - 3 * group);
  let rounded = Number(scaled.toFixed(decimals));
  if (rounded >= 1000) {
    group += 1;
    scaled = rounded / 1000;
    rounded = Number(scaled.toFixed(decimals));
    if (group > SUFFIX_LIMIT_GROUP) return sign + scientific(absMantissa, exponent, decimals);
  }
  return sign + rounded.toString() + SUFFIXES[group];
}

/** `m e<exp>` with carry when the mantissa rounds up to 10. */
function scientific(mantissa: number, exponent: number, decimals: number): string {
  let m = Number(mantissa.toFixed(decimals));
  let e = exponent;
  if (m >= 10) {
    m /= 10;
    e += 1;
  }
  return `${m}e${e}`;
}

/**
 * Formats a plain JS number with at most `decimals` decimals, trailing zeros removed (`0.1500001` gives `"0.15"`).
 *
 * @param n value to format
 * @param decimals decimals kept (default 3)
 * @returns display string
 */
export function formatPlain(n: number, decimals = 3): string {
  return String(Number(n.toFixed(decimals)));
}
