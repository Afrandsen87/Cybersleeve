/**
 * A run keeps the share of it that is done when the speed changes: a speed-up only shortens the rest of the run.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { buildViewModel } from '../../ui/viewModel';
import { testConfig } from '../../testing/testConfig';
import { SAVE_VERSION, createConfig, deserializeState, serializeState } from '..';
import { asSave, flatSave } from '../../testing/saveKit';

// Test config: action 'a' takes 10 s at interface speed 1, so 10 s at the start.
const doubler = { id: 'boost', name: 'Boost', description: '', cost: num(1), effect: { kind: 'interfaceSpeed', amount: 1 } } as const;

const game = () => createGame({ config: createConfig(testConfig, { buyables: [doubler], sleeve: { baseInterfaceSpeed: 1 } }) });
const progressOf = (g: ReturnType<typeof game>): number => g.getState().sleeve.actions['a']!.progress;
const xpOf = (g: ReturnType<typeof game>): number => g.getState().sleeve.actions['a']!.xp.toNumber();
const boost = (g: ReturnType<typeof game>): void => {
  (g.getState() as unknown as { wallet: { credits: unknown } }).wallet.credits = num(1);
  expect(g.buy('boost')).toBe('purchased');
};

describe('a change of speed in the middle of a run', () => {
  it('keeps the share done: 40% of a run stays 40% when the speed doubles', () => {
    const g = game();
    g.startAction('a');
    g.tick(4_000);
    expect(progressOf(g)).toBeCloseTo(0.4, 12);
    boost(g);
    expect(g.currentDurationMs('a')).toBe(5_000);
    expect(progressOf(g)).toBeCloseTo(0.4, 12);
  });

  it('only the rest of the run gets faster: the last 60% takes 3 s instead of 6 s', () => {
    const g = game();
    g.startAction('a');
    g.tick(4_000);
    boost(g);
    g.tick(2_900);
    expect(xpOf(g)).toBe(0);
    g.tick(200);
    expect(xpOf(g)).toBe(1);
  });

  it('a run that is far along does not end at once (it used to, because its elapsed time already exceeded the new duration)', () => {
    const g = game();
    g.startAction('a');
    g.tick(6_000); // 60% done
    boost(g); // the whole run now takes 5 s, and 6 s have passed
    g.tick(1);
    expect(xpOf(g)).toBe(0);
    expect(g.getState().sleeve.actions['a']!.running).toBe(true);
    expect(progressOf(g)).toBeCloseTo(0.6, 3);
    g.tick(1_900);
    expect(xpOf(g)).toBe(0); // 40% of 5 s = 2 s are needed
    g.tick(200);
    expect(xpOf(g)).toBe(1);
  });

  it('a slowdown works the same way: the share done stays, the rest takes longer', () => {
    const g = game();
    boost(g); // speed 2: a run takes 5 s
    g.startAction('a');
    g.tick(2_000); // 40% done
    expect(progressOf(g)).toBeCloseTo(0.4, 12);
    (g.getState() as unknown as { sleeve: { purchased: Record<string, number> } }).sleeve.purchased['boost'] = 0; // back to speed 1: a run takes 10 s
    expect(g.currentDurationMs('a')).toBe(10_000);
    expect(progressOf(g)).toBeCloseTo(0.4, 12);
    g.tick(5_900);
    expect(xpOf(g)).toBe(0); // 60% of 10 s = 6 s
    g.tick(200);
    expect(xpOf(g)).toBe(1);
  });

  it('the progress bar does not jump when the speed changes', () => {
    const g = game();
    g.startAction('a');
    g.tick(4_000);
    const before = buildViewModel(g).actions[0]!.progressPercent;
    boost(g);
    expect(buildViewModel(g).actions[0]!.progressPercent).toBeCloseTo(before, 6);
    expect(before).toBeCloseTo(40, 6);
  });

  it('one long tick across a speed change matches the same time in small steps, when the change happens between ticks', () => {
    const run = (steps: number[]) => {
      const g = game();
      g.startAction('a');
      g.tick(steps[0]!);
      boost(g);
      for (const ms of steps.slice(1)) g.tick(ms);
      return progressOf(g) + xpOf(g);
    };
    expect(run([4_000, 6_000])).toBeCloseTo(run([4_000, 1_000, 1_000, 1_000, 1_000, 1_000, 1_000]), 6);
  });
});

describe('saving the progress of a run', () => {
  const saved = () => {
    const g = game();
    g.startAction('a');
    g.tick(4_000);
    return { g, json: serializeState(g.getState()) };
  };

  it('writes the share done and the current format version', () => {
    const { json } = saved();
    const data = JSON.parse(json) as {
      version: number;
      sleeves: Record<string, { actions: Record<string, { progress: number; progressMs?: number }> }>;
    };
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.sleeves['main']!.actions['a']!.progress).toBeCloseTo(0.4, 12);
    expect(data.sleeves['main']!.actions['a']!.progressMs).toBeUndefined();
  });

  it('restores it: a run saved at 40% continues from 40%', () => {
    const { json } = saved();
    const restored = deserializeState(json, testConfig, numberFactory)!;
    expect(restored.sleeve.actions['a']!.progress).toBeCloseTo(0.4, 12);
    expect(restored.sleeve.actions['a']!.running).toBe(true);
  });

  it('refuses an older or unknown version', () => {
    const { json } = saved();
    for (const version of [2, 3, 6, 8, 'x']) {
      const data = { ...(JSON.parse(json) as object), version };
      expect(deserializeState(JSON.stringify(data), testConfig, numberFactory)).toBeNull();
    }
  });

  it('treats a progress that is not a share (negative, 1 or more, not a number) as 0', () => {
    const { json } = saved();
    for (const bad of [-0.5, 1, 7, 'abc', null, Number.POSITIVE_INFINITY]) {
      const data = flatSave(json) as { actions: Record<string, Record<string, unknown>> };
      data.actions['a']!['progress'] = bad;
      const state = deserializeState(asSave(data), testConfig, numberFactory);
      expect(state!.sleeve.actions['a']!.progress, String(bad)).toBe(0);
    }
  });
});

describe('a run finishes exactly when its time has passed, however the time is split (no rounding stalls)', () => {
  const finishedAfter = (steps: number[]): number => {
    const g = game();
    g.startAction('a');
    let spent = 0;
    for (const ms of steps) {
      g.tick(ms);
      spent += ms;
      if (xpOf(g) > 0) return spent;
    }
    return Number.POSITIVE_INFINITY;
  };

  it('9 999 ms and then 1 ms of a 10 s run', () => {
    expect(finishedAfter([9_999, 1])).toBe(10_000);
  });

  it('thirds of the run time, which have no exact decimal form', () => {
    const third = 10_000 / 3;
    expect(finishedAfter([third, third, third])).toBeCloseTo(10_000, 6);
  });

  it('a hundred ticks of 100 ms, and one thousand of 10 ms', () => {
    expect(finishedAfter(Array(100).fill(100))).toBe(10_000);
    expect(finishedAfter(Array(1_000).fill(10))).toBeCloseTo(10_000, 6);
  });

  it('never shows 100% before the run is complete', () => {
    const g = game();
    g.startAction('a');
    for (let i = 0; i < 99; i++) {
      g.tick(100);
      expect(progressOf(g)).toBeLessThan(1);
    }
  });
});
