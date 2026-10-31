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
import { config as testConfig } from '../../testing/resleeveTreeKit';
import { SynthSleeves } from './synthSleeves';

/** Two finished runs (10 credits per second at 100 levels, 20 at 200), both copied by a synthetic sleeve. */
function setup(liveLevels: number, levelInput?: (synth: { runIndex: number }) => number) {
  const state = createInitialState(testConfig, numberFactory);
  state.sleeve.purchased = { eu: 1, syn: 1 };
  state.wallet.runs = [
    { creditsPerSecond: num(10), actionLevelsTotal: 100, sleeveLevelsTotal: 0 },
    { creditsPerSecond: num(20), actionLevelsTotal: 200, sleeveLevelsTotal: 0 },
  ];
  state.wallet.synths = [{ runIndex: 0 }, { runIndex: 1 }];
  const progression = { totalActionLevelsWithProgress: () => liveLevels } as unknown as Progression;
  return new SynthSleeves(testConfig, state, progression, numberFactory, undefined, levelInput);
}

describe('SynthSleeves level input', () => {
  it('by default every sleeve is measured against the live sleeve', () => {
    expect(setup(50).creditsPerSecond().toNumber()).toBeCloseTo(11 ** 0.5 - 1 + (21 ** 0.25 - 1));
    expect(setup(1000).creditsPerSecond().toNumber()).toBe(30);
  });

  it('a given input is asked per sleeve and replaces the live total', () => {
    const asked: number[] = [];
    const synths = setup(0, (s) => {
      asked.push(s.runIndex);
      return s.runIndex === 0 ? 100 : 50;
    });
    expect(synths.creditsPerSecond().toNumber()).toBeCloseTo(10 + (21 ** 0.25 - 1));
    expect(asked).toEqual([0, 1]);
  });

  it('the income ceiling is what the sleeves pay at full levels, whatever the live levels are', () => {
    expect(setup(0).incomeCeiling().toNumber()).toBe(30);
    expect(setup(50).incomeCeiling().toNumber()).toBe(30);
    expect(setup(1000).incomeCeiling().toNumber()).toBe(setup(1000).creditsPerSecond().toNumber());
  });

  it('the income ceiling keeps the Perfect Copies floor and is 0 with no sleeves', () => {
    const state = createInitialState(testConfig, numberFactory);
    state.wallet.runs = [{ creditsPerSecond: num(10), actionLevelsTotal: 100, sleeveLevelsTotal: 0 }];
    const perfect = { id: 'pc', name: 'pc', description: '', cost: num(1), effect: { kind: 'perfectCopies' } } as const;
    state.sleeve.purchased = { eu: 1, syn: 1, pc: 1 };
    const progression = { totalActionLevelsWithProgress: () => 0 } as unknown as Progression;
    const make = () => new SynthSleeves({ buyables: [...testConfig.buyables, perfect] }, state, progression, numberFactory, () => num(25));
    expect(make().incomeCeiling().toNumber()).toBe(0);
    state.wallet.synths = [{ runIndex: 0 }];
    expect(make().incomeCeiling().toNumber()).toBe(25);
  });

  it('a sleeve measured against 0 levels earns nothing', () => {
    expect(
      setup(0, () => 0)
        .creditsPerSecond()
        .toNumber(),
    ).toBe(0);
  });
});
