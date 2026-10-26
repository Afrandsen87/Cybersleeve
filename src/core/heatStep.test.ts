import { describe, expect, it } from 'vitest';
import { coolHeat, coolHeatBoosted } from './index';

/** Heat cooldown with a step (`amount`) bigger than one point, as Purge Protocol makes it. */
describe('a cooldown step bigger than one point', () => {
  const cycle = 60_000;

  it.each([
    // heat, step, whole cycles passed, heat left
    [10, 5, 10, 0], // two full steps clear it
    [3.5, 5, 1, 0.5], // the one cycle takes the 3 whole points that are left, never more than the heat held
    [4.9, 5, 1, 0.9],
    [0.9, 5, 10, 0.9], // less than one whole point: nothing to remove, the bar waits
    [12, 5, 2, 2],
    [12, 5, 3, 0],
    [12, 5, 1, 7],
  ])('heat %d with a step of %d after %d cycles leaves %d', (heat, amount, cycles, left) => {
    expect(coolHeat({ heat, cooldownMs: 0 }, cycles * cycle, cycle, amount).heat).toBeCloseTo(left, 9);
  });

  it('a step smaller than a point still removes only what it says', () => {
    expect(coolHeat({ heat: 2, cooldownMs: 0 }, cycle, cycle, 0.5).heat).toBe(1.5);
  });

  it('the bar does not advance while there is less than one whole point', () => {
    expect(coolHeat({ heat: 0.9, cooldownMs: 30_000 }, cycle, cycle, 5).cooldownMs).toBe(0);
  });

  it('with Moles, a step bigger than the heat uses up one Mole per point actually cooled', () => {
    const r = coolHeatBoosted({ heat: 3.5, cooldownMs: 0, moles: 10 }, 60 * cycle, cycle, 5, 1, 2);
    expect(r.heat).toBe(0.5);
    expect(r.moles).toBe(7); // 3 points cooled, 3 Moles used
  });

  it('with Moles that run out part-way, the rest of the heat cools at the normal pace', () => {
    const r = coolHeatBoosted({ heat: 12, cooldownMs: 0, moles: 2 }, 60 * cycle, cycle, 5, 1, 2);
    expect(r.moles).toBe(0);
    expect(r.heat).toBe(0); // given enough time everything cools, with no stranded remainder
  });

  it('one long step equals many short ones', () => {
    const long = coolHeatBoosted({ heat: 47.5, cooldownMs: 0, moles: 9 }, 7 * cycle + 12_345, cycle, 5, 1.1, 2);
    let s = { heat: 47.5, cooldownMs: 0, moles: 9 };
    for (let i = 0; i < 7 * 60 + 12; i++) s = coolHeatBoosted(s, 1_000, cycle, 5, 1.1, 2);
    s = coolHeatBoosted(s, 345, cycle, 5, 1.1, 2);
    expect(s.heat).toBeCloseTo(long.heat, 6);
    expect(s.moles).toBeCloseTo(long.moles, 6);
    expect(s.cooldownMs).toBeCloseTo(long.cooldownMs, 4);
  });
});
