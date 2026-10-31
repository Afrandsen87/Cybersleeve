/**
 * @module numbers
 *
 * Human-readable formatting of {@link BigNum} values.
 */
import type { BigNum } from './BigNum';
import { num } from './BreakInfinityNum';

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

/**
 * Formats a plain number with at most `digits` significant figures, for the values in a panel row (tooltips keep full precision).
 *
 * @remarks
 * - `< 1000`: rounded to `digits` significant figures but never past the decimal point (`652.3491` at 3 is `652`), trailing
 *   zeros trimmed.
 * - from 1000 (also after rounding: `999.95` at 4 is `1K`): the suffix or scientific notation of {@link formatBigNum}, with as
 *   many decimals as keep `digits` significant figures (`12345.6` at 4 is `12.35K`; `1e308` stays short).
 * - `NaN` and `-0` give `0`; infinities give `Infinity` / `-Infinity`. Negatives keep their sign.
 *
 * Called by: the panel rows in `ui/view/`. Calls: {@link formatBigNum}.
 *
 * @param n value to format
 * @param digits significant figures kept (clamped to 1..21)
 * @returns display string
 */
export function formatSignificant(n: number, digits: number): string {
  if (Number.isNaN(n) || n === 0) return '0';
  if (!Number.isFinite(n)) return String(n);
  const precision = Number.isFinite(digits) ? Math.max(1, Math.min(21, Math.floor(digits))) : 1;
  const exponent = Math.floor(Math.log10(Math.abs(n)));
  if (exponent < 3) {
    const plain = Number(n.toFixed(Math.min(100, Math.max(0, precision - exponent - 1))));
    if (Math.abs(plain) < 1000) return String(plain);
  }
  // Rounded first, so the suffix formatter never meets a value just under a carry (999.95K at 4 figures is 1M).
  const rounded = Number(n.toPrecision(Math.max(precision, 3)));
  const roundedExponent = Math.floor(Math.log10(Math.abs(rounded)));
  const leading = Math.floor(roundedExponent / 3) > SUFFIX_LIMIT_GROUP ? 1 : (roundedExponent % 3) + 1;
  return formatBigNum(num(rounded), Math.max(0, precision - leading));
}
