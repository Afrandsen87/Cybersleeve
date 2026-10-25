// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeScheduler } from '../testing/fakes';
import { debugControlsEnabled } from './debugControls';
import { createBrowserScheduler, createRateLimitedReporter, ERROR_REPORT_INTERVAL_MS, GameLoop } from './loop';
import { SAVE_KEY } from './persistence';
import { createThrottle } from './throttle';
import { watchForOtherTab } from './tabGuard';

describe('createThrottle', () => {
  it('admits the first call, then at most one per interval', () => {
    let t = 0;
    const gate = createThrottle(100, () => t);
    expect(gate()).toBe(true);
    t = 99;
    expect(gate()).toBe(false);
    t = 100;
    expect(gate()).toBe(true);
    t = 150;
    expect(gate()).toBe(false);
    t = 200;
    expect(gate()).toBe(true);
  });
});

describe('watchForOtherTab', () => {
  const setup = () => {
    let listener: (e: { key: string | null }) => void = () => {};
    const calls: number[] = [];
    watchForOtherTab({ addEventListener: (_t, l) => (listener = l) }, SAVE_KEY, () => calls.push(1));
    return { fire: (key: string | null) => listener({ key }), calls };
  };

  it('reacts when another tab writes the save', () => {
    const { fire, calls } = setup();
    fire(SAVE_KEY);
    expect(calls).toHaveLength(1);
  });

  it('reacts when the whole storage is cleared', () => {
    const { fire, calls } = setup();
    fire(null);
    expect(calls).toHaveLength(1);
  });

  it('ignores other keys', () => {
    const { fire, calls } = setup();
    fire('something.else');
    expect(calls).toHaveLength(0);
  });
});

describe('debugControlsEnabled', () => {
  it.each([
    [true, '', true],
    [false, '', false],
    [false, '?debug', true],
    [false, '?x=1&debug', true],
    [false, '?debugging=1', false],
  ])('dev=%s search=%j gives %s', (dev, search, expected) => {
    expect(debugControlsEnabled(dev, search)).toBe(expected);
  });
});

describe('createRateLimitedReporter', () => {
  it('reports the first error, holds back repeats and says how many were held back', () => {
    let t = 0;
    const reports: string[] = [];
    const report = createRateLimitedReporter(
      () => t,
      1_000,
      (m) => reports.push(m),
    );
    report('x');
    report('x');
    report('x');
    expect(reports).toEqual(['Game step failed:']);
    t = 1_000;
    report('x');
    expect(reports).toEqual(['Game step failed:', 'Game step failed (2 similar errors held back):']);
  });
});

describe('GameLoop error reporting and diagnostics', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs a step that fails every time at most once per interval by default', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = new FakeScheduler();
    const loop = new GameLoop(
      {
        tick: () => {
          throw new Error('broken');
        },
      },
      s,
      () => {},
    );
    loop.start();
    for (let i = 0; i < 100; i++) s.advance(50); // 5 s of failing steps
    expect(logged.mock.calls.length).toBeLessThanOrEqual(2);
    s.advance(ERROR_REPORT_INTERVAL_MS);
    expect(logged.mock.calls.length).toBeLessThanOrEqual(3);
    expect(loop.running).toBe(true);
  });

  it('warns when real time had to be dropped', () => {
    const s = new FakeScheduler();
    const warnings: string[] = [];
    const loop = new GameLoop({ tick: () => {} }, s, () => {}, { maxDeltaMs: 1_000, diagnostics: { warn: (m) => warnings.push(m) } });
    loop.start();
    s.advance(1_000);
    expect(warnings).toEqual([]);
    s.advance(5_000);
    expect(warnings).toEqual(['Dropped 4000 ms of real time (the gap was longer than maxDeltaMs)']);
  });
});

describe('createBrowserScheduler', () => {
  afterEach(() => vi.useRealTimers());

  it('schedules and cancels with window timers and reads performance.now', () => {
    vi.useFakeTimers();
    const scheduler = createBrowserScheduler(50);
    const cb = vi.fn();
    scheduler.request(cb);
    vi.advanceTimersByTime(49);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    const cancelled = vi.fn();
    scheduler.cancel(scheduler.request(cancelled));
    vi.advanceTimersByTime(100);
    expect(cancelled).not.toHaveBeenCalled();
    expect(typeof scheduler.now()).toBe('number');
  });
});
