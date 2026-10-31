/**
 * The re-sleeve progress gate: a re-sleeve needs more action levels AND more sleeve levels than the last run had.
 *
 * Purpose: state the outcome, not the tuning: the first run needs only the step, an equal total is refused, one more passes, both totals
 * are needed, the Re-sleeve tab can list both requirements, no config rule means no gate, and the migration piece fills the new field.
 * Called by: vitest. Calls: `createGame`, `ProgressGate`, `migrateProgressionSave`, `validateConfig`, the test config.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { flat } from '../../testing/flatState';
import { setSleeveXp, testConfig } from '../../testing/testConfig';
import { createConfig, createInitialState, migrateProgressionSave, validateConfig } from '..';

const gated = createConfig(testConfig, { resleeve: { ...testConfig.resleeve, progressNeeded: { actionLevels: 1, sleeveLevels: 1 } } });

const setActionXp = (g: ReturnType<typeof createGame>, xp: number): void => {
  flat<{ actions: Record<string, { xp: unknown }> }>(g).actions['a']!.xp = num(xp);
};

/** A gated game with action XP and sleeve XP on action `a` (testConfig: level 1 at 10 XP, level 2 at 111). */
function game(actionXp: number, sleeveXp: number) {
  const g = createGame({ config: gated });
  setActionXp(g, actionXp);
  setSleeveXp(g, num(sleeveXp));
  return g;
}

describe('ProgressGate', () => {
  it('first run: refused with no levels, allowed once both totals are at least the step', () => {
    expect(game(0, 0).canResleeve()).toBe(false);
    expect(game(10, 0).canResleeve()).toBe(false); // action level only
    expect(game(0, 10).canResleeve()).toBe(false); // sleeve level only
    expect(game(10, 10).canResleeve()).toBe(true);
  });

  it('lists both requirements, action levels first, with what is held and needed', () => {
    const g = game(0, 0);
    expect(g.resleeveRequirements().map((r) => r.kind)).toEqual(['actionLevels', 'sleeveLevels']);
    expect(g.resleeveRequirements().map((r) => [r.held, r.needed])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('after a re-sleeve the next needs one more of each than the last run reached', () => {
    const g = game(10, 10);
    const sleeveBefore = g.sleeveLevel('a');
    expect(g.resleeve()).toBe(true);
    const run = g.getState().wallet.runs[0]!;
    expect(run.actionLevelsTotal).toBe(1);
    expect(run.sleeveLevelsTotal).toBe(sleeveBefore);
    expect(g.resleeveRequirements().map((r) => r.needed)).toEqual([2, sleeveBefore + 1]);
    expect(g.canResleeve()).toBe(false);
  });

  it('equal totals to the last run are refused; one more of each passes; one of them alone does not', () => {
    const equal = game(10, 10);
    equal.resleeve();
    setActionXp(equal, 10); // the same action total as the last run
    expect(equal.canResleeve()).toBe(false);

    const more = game(10, 10);
    more.resleeve();
    setActionXp(more, 111);
    expect(more.canResleeve(), 'sleeve levels did not grow').toBe(false);
    setSleeveXp(more, num(111));
    expect(more.canResleeve()).toBe(true);
  });

  it('without the config rule there is no gate and no requirement', () => {
    const g = createGame({ config: testConfig });
    expect(g.resleeveRequirements()).toEqual([]);
    expect(g.canResleeve()).toBe(true);
  });
});

describe('progressNeeded validation', () => {
  const check = (needed: unknown) =>
    validateConfig(createConfig(testConfig, { resleeve: { ...testConfig.resleeve, progressNeeded: needed as never } })).join();

  it('accepts whole numbers >= 1 and rejects 0, fractions, NaN and negatives', () => {
    expect(check({ actionLevels: 1, sleeveLevels: 3 })).toBe('');
    for (const bad of [
      { actionLevels: 0, sleeveLevels: 1 },
      { actionLevels: 1, sleeveLevels: 1.5 },
      { actionLevels: Number.NaN, sleeveLevels: 1 },
      { actionLevels: 1, sleeveLevels: -1 },
    ])
      expect(check(bad), JSON.stringify(bad)).toContain('progressNeeded');
  });
});

describe('migrateProgressionSave', () => {
  const stateWithRuns = (count: number) => {
    const state = createInitialState(testConfig, numberFactory);
    const runs = state.wallet.runs as { creditsPerSecond: unknown; actionLevelsTotal: number; sleeveLevelsTotal: number }[];
    for (let i = 0; i < count; i++) runs.push({ creditsPerSecond: num(0), actionLevelsTotal: 3, sleeveLevelsTotal: 0 });
    return state;
  };

  it('gives the newest record the current sleeve-level total and leaves older ones at 0', () => {
    const state = stateWithRuns(3);
    migrateProgressionSave(state, 7, 'rr');
    expect(state.wallet.runs.map((r) => r.sleeveLevelsTotal)).toEqual([0, 0, 7]);
    expect(state.wallet.runs.map((r) => r.actionLevelsTotal)).toEqual([3, 3, 3]);
  });

  it('with no runs changes no record, and drops the retired purchase only', () => {
    const state = stateWithRuns(0);
    state.sleeve.purchased['rr'] = 1;
    state.sleeve.purchased['other'] = 2;
    migrateProgressionSave(state, 5, 'rr');
    expect(state.wallet.runs).toEqual([]);
    expect(state.sleeve.purchased).toEqual({ other: 2 });
  });

  it.each([Number.NaN, -4, Number.POSITIVE_INFINITY])('treats %s sleeve levels as 0', (bad) => {
    const state = stateWithRuns(1);
    migrateProgressionSave(state, bad, 'rr');
    expect(state.wallet.runs[0]!.sleeveLevelsTotal).toBe(0);
  });
});
