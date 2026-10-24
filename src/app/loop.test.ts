import { describe, expect, it } from 'vitest';
import { FakeScheduler } from '../testing/fakes';
import { DEFAULT_MAX_DELTA_MS, GameLoop } from './loop';
import { SpeedToggle } from './speedToggle';

describe('GameLoop', () => {
  it('passes elapsed time to the target and calls onStep', () => {
    const s = new FakeScheduler();
    const deltas: number[] = [];
    let steps = 0;
    const loop = new GameLoop({ tick: (d) => deltas.push(d) }, s, () => steps++);
    loop.start();
    s.advance(16);
    s.advance(20);
    expect(deltas).toEqual([16, 20]);
    expect(steps).toBe(2);
  });

  it('simulates the whole real-time gap, so a background tab keeps progressing', () => {
    const s = new FakeScheduler();
    const deltas: number[] = [];
    const loop = new GameLoop({ tick: (d) => deltas.push(d) }, s, () => {});
    loop.start();
    s.advance(60_000); // e.g. a throttled background timer firing once a minute
    expect(deltas).toEqual([60_000]);
  });

  it('caps absurdly long gaps (no offline progress for now)', () => {
    const s = new FakeScheduler();
    const deltas: number[] = [];
    const loop = new GameLoop({ tick: (d) => deltas.push(d) }, s, () => {});
    loop.start();
    s.advance(24 * 3_600_000);
    expect(deltas).toEqual([DEFAULT_MAX_DELTA_MS]);
  });

  it('the cap is configurable', () => {
    const s = new FakeScheduler();
    const deltas: number[] = [];
    const loop = new GameLoop({ tick: (d) => deltas.push(d) }, s, () => {}, { maxDeltaMs: 5_000 });
    loop.start();
    s.advance(60_000);
    expect(deltas).toEqual([5_000]);
  });

  it('applies the time scale to elapsed time', () => {
    const s = new FakeScheduler();
    const deltas: number[] = [];
    let scale = 1;
    const loop = new GameLoop({ tick: (d) => deltas.push(d) }, s, () => {}, { timeScale: () => scale });
    loop.start();
    s.advance(100);
    scale = 10;
    s.advance(100);
    expect(deltas).toEqual([100, 1000]);
  });

  it('stops scheduling after stop()', () => {
    const s = new FakeScheduler();
    const deltas: number[] = [];
    const loop = new GameLoop({ tick: (d) => deltas.push(d) }, s, () => {});
    loop.start();
    loop.stop();
    s.advance(16);
    expect(deltas).toEqual([]);
    expect(loop.running).toBe(false);
  });

  it('keeps running after a failing step and reports the error (a render bug must not freeze the game)', () => {
    const s = new FakeScheduler();
    const errors: unknown[] = [];
    let ticks = 0;
    let fail = true;
    const loop = new GameLoop(
      { tick: () => ticks++ },
      s,
      () => {
        if (fail) throw new Error('render broke');
      },
      {
        onError: (e) => errors.push(e),
      },
    );
    loop.start();
    s.advance(16);
    expect(errors).toHaveLength(1);
    expect(loop.running).toBe(true);
    expect(s.pending).toBe(true);
    fail = false;
    s.advance(16);
    expect(ticks).toBe(2);
    expect(errors).toHaveLength(1);
  });

  it('keeps running when the tick itself throws', () => {
    const s = new FakeScheduler();
    const errors: unknown[] = [];
    const loop = new GameLoop(
      {
        tick: () => {
          throw new Error('tick broke');
        },
      },
      s,
      () => {},
      { onError: (e) => errors.push(e) },
    );
    loop.start();
    s.advance(16);
    s.advance(16);
    expect(errors).toHaveLength(2);
    expect(s.pending).toBe(true);
  });

  it('does not reschedule when stopped from inside a step', () => {
    const s = new FakeScheduler();
    const loop: GameLoop = new GameLoop({ tick: () => {} }, s, () => loop.stop());
    loop.start();
    s.advance(16);
    expect(loop.running).toBe(false);
    expect(s.pending).toBe(false);
  });
});

describe('SpeedToggle', () => {
  it('is off (x1) by default and toggles to the configured factor', () => {
    const t = new SpeedToggle(25);
    expect(t.enabled).toBe(false);
    expect(t.factor).toBe(1);
    expect(t.toggle()).toBe(true);
    expect(t.factor).toBe(25);
    expect(t.toggle()).toBe(false);
    expect(t.factor).toBe(1);
  });
});
