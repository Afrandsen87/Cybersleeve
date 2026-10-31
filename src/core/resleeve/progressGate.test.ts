/**
 * Resleeve context: boundary and validation tests, using testConfig independently of content tuning.
 * Called by: vitest. Calls: ProgressGate, validateConfig, migrateProgressionSave, testing kits.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import { createConfig, createInitialState, migrateProgressionSave, validateConfig } from '..';
import { ProgressGate } from './progressGate';

const gated = createConfig(testConfig, { resleeve: { ...testConfig.resleeve, progressNeeded: { sleeveLevels: 5, perResleeve: 1 } } });

describe('ProgressGate', () => {
  it.each([0, 1, 2])('after %s earlier re-sleeves checks below, at and above the threshold', (earlier) => {
    const state = createInitialState(testConfig, numberFactory);
    for (let i = 0; i < earlier; i++) state.wallet.runs.push({ creditsPerSecond: num(0), actionLevelsTotal: 999, sleeveLevelsTotal: 999 });
    const needed = 5 + earlier;
    for (const held of [0, needed - 1, needed, needed + 1]) {
      const gate = new ProgressGate(gated, { totalSleeveLevels: () => held });
      expect(gate.requirements(state)).toEqual([{ kind: 'sleeveLevels', held, needed }]);
      expect(gate.canResleeve(state)).toBe(held >= needed);
    }
  });

  it('allows a zero step, independent of previous run totals', () => {
    const config = createConfig(testConfig, { resleeve: { ...testConfig.resleeve, progressNeeded: { sleeveLevels: 5, perResleeve: 0 } } });
    const state = createInitialState(testConfig, numberFactory);
    state.wallet.runs.push({ creditsPerSecond: num(0), actionLevelsTotal: 999, sleeveLevelsTotal: 999 });
    expect(new ProgressGate(config, { totalSleeveLevels: () => 5 }).canResleeve(state)).toBe(true);
  });

  it('without the config rule there is no gate and no requirement', () => {
    const gate = new ProgressGate(testConfig, { totalSleeveLevels: () => 0 });
    const state = createInitialState(testConfig, numberFactory);
    expect(gate.requirements(state)).toEqual([]);
    expect(gate.canResleeve(state)).toBe(true);
  });
});

describe('progressNeeded validation', () => {
  const check = (needed: unknown) =>
    validateConfig(createConfig(testConfig, { resleeve: { ...testConfig.resleeve, progressNeeded: needed as never } })).join();

  it('accepts integer base >= 1 and step >= 0, including an omitted gate', () => {
    expect(check(undefined)).toBe('');
    expect(check({ sleeveLevels: 5, perResleeve: 1 })).toBe('');
    expect(check({ sleeveLevels: 1, perResleeve: 0 })).toBe('');
  });

  it.each([
    { sleeveLevels: 0, perResleeve: 1 },
    { sleeveLevels: -1, perResleeve: 1 },
    { sleeveLevels: 1.5, perResleeve: 1 },
    { sleeveLevels: 5, perResleeve: -1 },
    { sleeveLevels: 5, perResleeve: 0.5 },
    { sleeveLevels: Number.NaN, perResleeve: 1 },
    { sleeveLevels: 5, perResleeve: Number.POSITIVE_INFINITY },
    { sleeveLevels: 5, perResleeve: Number.NaN },
  ])('rejects invalid values %s', (needed) => {
    expect(check(needed)).toContain('progressNeeded');
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
