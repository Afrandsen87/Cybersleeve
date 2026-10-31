/**
 * Significant panel precision, suffix carries and non-finite input behavior.
 * Called by: Vitest. Calls: formatSignificant.
 */
import { describe, expect, it } from 'vitest';
import { formatSignificant } from './index';

describe('formatSignificant', () => {
  it.each([
    [0, 4, '0'],
    [-0, 4, '0'],
    [-144.2375, 4, '-144.2'],
    [0.0002, 4, '0.0002'],
    [0.00023456, 4, '0.0002346'],
    [144.2375, 4, '144.2'],
    [652.3491, 3, '652'],
    [999.95, 4, '1K'],
    [144, 1, '144'],
    [1e15, 4, '1Qa'],
    [1e308, 4, '1e308'],
    [NaN, 4, '0'],
    [Infinity, 4, 'Infinity'],
    [-Infinity, 4, '-Infinity'],
  ])('formats %s at %s digits as %s', (value, digits, expected) => {
    expect(formatSignificant(value, digits)).toBe(expected);
  });

  it('preserves suffix integer places and carries suffix rounding', () => {
    expect(formatSignificant(144_237, 4)).toBe('144.2K');
    expect(formatSignificant(652_349, 3)).toBe('652K');
    expect(formatSignificant(999_950, 4)).toBe('1M');
    expect(formatSignificant(-999_950, 4)).toBe('-1M');
    expect(formatSignificant(1.23456e308, 4)).toBe('1.235e308');
  });
});
