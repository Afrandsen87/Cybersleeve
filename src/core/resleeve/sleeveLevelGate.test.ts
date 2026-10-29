/**
 * The sleeve-level gate: the Nth re-sleeve needs a total of sleeve levels that rises with N (`resleeve.sleeveLevelsNeeded`).
 *
 * Purpose: state the outcome of the rule, not the tuning: refused below the threshold, allowed at it, the threshold rises after a re-sleeve,
 * no rule means no gate, a save already past the threshold is allowed, and bad numbers cannot corrupt the check.
 * Called by: vitest. Calls: `createGame`, `SleeveLevelGate`, `sleeveLevelsNeeded`, `validateConfig`, the test config.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { setSleeveXp, testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig } from '..';
import { sleeveLevelsNeeded } from './sleeveLevelGate';

/** A game whose re-sleeve needs `base + perResleeve x done` sleeve levels in total, with `xp` sleeve XP on action `a`. */
function gameNeeding(base: number, perResleeve: number, xp: number) {
  const g = createGame({
    config: createConfig(testConfig, { resleeve: { ...testConfig.resleeve, sleeveLevelsNeeded: { base, perResleeve } } }),
  });
  setSleeveXp(g, num(xp));
  return g;
}

/** The total of sleeve levels of every action, read the way a player would. */
const held = (g: ReturnType<typeof createGame>) => testConfig.actions.reduce((n, a) => n + g.sleeveLevel(a.id), 0);

describe('sleeveLevelsNeeded', () => {
  it('is base + perResleeve per re-sleeve done, and 0 without a rule', () => {
    expect(sleeveLevelsNeeded({ base: 2, perResleeve: 3 }, 0)).toBe(2);
    expect(sleeveLevelsNeeded({ base: 2, perResleeve: 3 }, 4)).toBe(14);
    expect(sleeveLevelsNeeded(undefined, 9)).toBe(0);
  });

  it('never goes down with more re-sleeves, and a negative count counts as none', () => {
    expect(sleeveLevelsNeeded({ base: 1, perResleeve: 1 }, 3)).toBeGreaterThan(sleeveLevelsNeeded({ base: 1, perResleeve: 1 }, 2));
    expect(sleeveLevelsNeeded({ base: 1, perResleeve: 1 }, -5)).toBe(1);
  });
});

describe('SleeveLevelGate in a game', () => {
  it('refuses a re-sleeve below the threshold and states the shortfall', () => {
    const g = gameNeeding(1_000, 1, 0);
    expect(g.canResleeve()).toBe(false);
    expect(g.resleeveRequirement()).toEqual({ held: 0, needed: 1_000 });
    expect(g.resleeve()).toBe(false);
    expect(g.getState().wallet.runs).toHaveLength(0);
  });

  it('allows it once the levels held reach the threshold', () => {
    const g = gameNeeding(1, 1, 1e6);
    expect(held(g)).toBeGreaterThanOrEqual(1);
    expect(g.canResleeve()).toBe(true);
    expect(g.resleeve()).toBe(true);
  });

  it('raises the threshold after a re-sleeve, and sleeve levels carry over', () => {
    const g = gameNeeding(1, 1_000_000, 1e6);
    const before = held(g);
    expect(g.resleeve()).toBe(true);
    expect(held(g)).toBe(before);
    expect(g.resleeveRequirement()).toEqual({ held: before, needed: 1_000_001 });
    expect(g.canResleeve()).toBe(false);
  });

  it('has no gate without a rule: the requirement is null and re-sleeving is allowed', () => {
    const g = createGame({ config: testConfig });
    expect(g.resleeveRequirement()).toBeNull();
    expect(g.canResleeve()).toBe(true);
  });

  it('a threshold of 0 is always met', () => {
    expect(gameNeeding(0, 0, 0).canResleeve()).toBe(true);
  });
});

describe('sleeveLevelsNeeded validation', () => {
  const check = (needed: unknown) =>
    validateConfig(createConfig(testConfig, { resleeve: { ...testConfig.resleeve, sleeveLevelsNeeded: needed as never } }));

  it('accepts numbers >= 0 and rejects negative, NaN and infinite ones', () => {
    expect(check({ base: 1, perResleeve: 0 })).toEqual([]);
    for (const bad of [
      { base: -1, perResleeve: 1 },
      { base: 1, perResleeve: Number.NaN },
      { base: Number.POSITIVE_INFINITY, perResleeve: 1 },
    ])
      expect(check(bad).join(), JSON.stringify(bad)).toContain('sleeveLevelsNeeded');
  });
});
