/** Automation context: skill capacity and access-gated selection commands. */
import { describe, expect, it } from 'vitest';
import { dispersalGame, dispersalState } from '../../testing/dispersalKit';
import { num } from '../../numbers';

describe('dispersal selection', () => {
  it('adds one selection slot only at capacity-granting skills', () => {
    const expected = [0, 1, 2, 2, 3, 4, 4, 5, 5, 6];
    for (let count = 0; count <= 9; count++) expect(dispersalGame(count).automation().dispersalSlots()).toBe(expected[count]);
  });
  it('refuses a new target beyond capacity without changing selections; unticking frees space', () => {
    const g = dispersalGame(1);
    const auto = g.automation();
    expect(auto.setDispersalTarget('a', true)).toBe(true);
    expect(auto.setDispersalTarget('a', true)).toBe(true);
    expect(auto.setDispersalTarget('b', true)).toBe(false);
    expect(auto.dispersalTargets()).toEqual(['a']);
    expect(auto.setDispersalTarget('a', false)).toBe(true);
    expect(auto.setDispersalTarget('b', true)).toBe(true);
    expect(auto.dispersalTargets()).toEqual(['b']);
  });
  it('accepts only known actions whose access gate is open', () => {
    const g = dispersalGame(2);
    const auto = g.automation();
    expect(auto.setDispersalTarget('unknown', true)).toBe(false);
    expect(auto.setDispersalTarget('locked', true)).toBe(false);
    dispersalState(g).wallet.credits = num(1000);
    expect(g.buy('access')).toBe('purchased');
    expect(auto.setDispersalTarget('locked', true)).toBe(true);
    expect(auto.dispersalTargets()).toEqual(['locked']);
  });
  it('refuses selections while the feature is locked', () => {
    const auto = dispersalGame(0).automation();
    expect(auto.setDispersalTarget('a', true)).toBe(false);
    expect(auto.dispersalTargets()).toEqual([]);
  });
});
