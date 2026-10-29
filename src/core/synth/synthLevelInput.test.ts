/**
 * The level input of a synthetic sleeve: each one is measured against the total it is asked for, not always the live sleeve.
 *
 * Purpose: structure for later layers (D2). With no input given, every sleeve is measured against the live sleeve, as before.
 * Called by: vitest. Calls: `SynthSleeves`, `createInitialState`, the test config.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import type { Progression } from '../actions/progression';
import { createInitialState } from '../save/state';
import { testConfig } from '../../testing/testConfig';
import { SynthSleeves } from './synthSleeves';

/** Two finished runs (10 credits per second at 100 levels, 20 at 200), both copied by a synthetic sleeve. */
function setup(liveLevels: number, levelInput?: (synth: { runIndex: number }) => number) {
  const state = createInitialState(testConfig, numberFactory);
  state.wallet.runs = [
    { creditsPerSecond: num(10), actionLevelsTotal: 100 },
    { creditsPerSecond: num(20), actionLevelsTotal: 200 },
  ];
  state.wallet.synths = [{ runIndex: 0 }, { runIndex: 1 }];
  const progression = { totalActionLevels: () => liveLevels } as unknown as Progression;
  return new SynthSleeves(testConfig, state, progression, numberFactory, undefined, levelInput);
}

describe('SynthSleeves level input', () => {
  it('by default every sleeve is measured against the live sleeve', () => {
    expect(setup(50).creditsPerSecond().toNumber()).toBeCloseTo(10 * 0.5 + 20 * 0.25);
    expect(setup(1000).creditsPerSecond().toNumber()).toBe(30);
  });

  it('a given input is asked per sleeve and replaces the live total', () => {
    const asked: number[] = [];
    const synths = setup(0, (s) => {
      asked.push(s.runIndex);
      return s.runIndex === 0 ? 100 : 50;
    });
    expect(synths.creditsPerSecond().toNumber()).toBeCloseTo(10 + 20 * 0.25);
    expect(asked).toEqual([0, 1]);
  });

  it('a sleeve measured against 0 levels earns nothing', () => {
    expect(
      setup(0, () => 0)
        .creditsPerSecond()
        .toNumber(),
    ).toBe(0);
  });
});
