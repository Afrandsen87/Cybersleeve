/**
 * @module app
 *
 * Drives the engine from a clock.
 */
import { type Diagnostics, silentDiagnostics } from '../core';

/** Source of time and tick scheduling. Injected so the loop is testable without real timers. */
export interface Scheduler {
  /** Monotonic time in milliseconds. */
  now(): number;
  /** Calls `callback` soon; returns a handle for {@link Scheduler.cancel}. */
  request(callback: () => void): number;
  /** Cancels a scheduled callback. */
  cancel(handle: number): void;
}

/** What the loop drives. Satisfied by `GameEngine`. */
export interface Tickable {
  tick(deltaMs: number): void;
}

/** Tuning of the loop. */
export interface GameLoopOptions {
  /**
   * Largest real-time gap simulated in one step, in ms (default 10 minutes).
   * Browsers throttle timers in background tabs (to ~1 call/s, later ~1/min), so the loop
   * measures real elapsed time and simulates the whole gap. Gaps longer than this cap
   * (device asleep, app closed) are NOT simulated: offline progress is a separate, later mechanic.
   */
  maxDeltaMs?: number;
  /** Multiplier applied to elapsed time, read every step (e.g. 10 for the test fast-forward). Default 1. */
  timeScale?: () => number;
  /**
   * Receives an error thrown by a step (the loop keeps running). Default: `console.error`, at most once per
   * {@link ERROR_REPORT_INTERVAL_MS} (a step that fails every time would otherwise log 20 times a second).
   */
  onError?: (error: unknown) => void;
  /** Receives a warning when real time had to be dropped because the gap exceeded `maxDeltaMs`. Default: ignored. */
  diagnostics?: Diagnostics;
}

/** Shortest time between two logged step errors when the default error handler is used. */
export const ERROR_REPORT_INTERVAL_MS = 5_000;

/**
 * Wraps an error sink so that it fires at most once per `intervalMs`, and says how many reports were held back.
 *
 * Called by: {@link GameLoop} (default error handler).
 *
 * @param now monotonic clock in ms (injected)
 * @param intervalMs shortest time between two reports
 * @param sink where reports go, e.g. `console.error`
 * @returns the rate-limited reporter
 */
export function createRateLimitedReporter(
  now: () => number,
  intervalMs: number,
  sink: (message: string, error: unknown) => void,
): (error: unknown) => void {
  let lastReport = Number.NEGATIVE_INFINITY;
  let suppressed = 0;
  return (error) => {
    if (now() - lastReport < intervalMs) {
      suppressed++;
      return;
    }
    lastReport = now();
    const extra = suppressed > 0 ? ` (${suppressed} similar errors held back)` : '';
    suppressed = 0;
    sink(`Game step failed${extra}:`, error);
  };
}

/** Fallback for {@link GameLoopOptions.maxDeltaMs} when not given (the game passes `runtime.maxDeltaMs`). */
export const DEFAULT_MAX_DELTA_MS = 10 * 60 * 1000;

/**
 * Timer-driven game loop.
 *
 * @remarks
 * Uses elapsed real time (not a frame count) so the game keeps progressing when the
 * window is unfocused or the tab is in the background.
 *
 * Called by: `main.ts`. Calls: {@link Tickable.tick}, `onStep`.
 */
export class GameLoop {
  private handle: number | null = null;
  private last = 0;
  private readonly maxDeltaMs: number;
  private readonly timeScale: () => number;
  private readonly onError: (error: unknown) => void;
  private readonly diagnostics: Diagnostics;

  /**
   * Creates a loop (not started until {@link GameLoop.start}).
   *
   * @param target receives `tick(delta)` every step
   * @param scheduler time and scheduling source
   * @param onStep called after every tick (e.g. a render hook; it may skip work while the page is hidden)
   * @param options loop tuning
   */
  constructor(
    private readonly target: Tickable,
    private readonly scheduler: Scheduler,
    private readonly onStep: () => void,
    options: GameLoopOptions = {},
  ) {
    this.maxDeltaMs = options.maxDeltaMs ?? DEFAULT_MAX_DELTA_MS;
    this.timeScale = options.timeScale ?? (() => 1);
    this.onError =
      options.onError ??
      createRateLimitedReporter(
        () => scheduler.now(),
        ERROR_REPORT_INTERVAL_MS,
        (message, error) => console.error(message, error),
      );
    this.diagnostics = options.diagnostics ?? silentDiagnostics;
  }

  /** Starts the loop. No effect if already running. */
  start(): void {
    if (this.handle !== null) return;
    this.last = this.scheduler.now();
    this.handle = this.scheduler.request(this.step);
  }

  /** Stops the loop. */
  stop(): void {
    if (this.handle === null) return;
    this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  /** True while running. */
  get running(): boolean {
    return this.handle !== null;
  }

  private readonly step = (): void => {
    try {
      const now = this.scheduler.now();
      const gap = Math.max(0, now - this.last);
      const real = Math.min(gap, this.maxDeltaMs);
      if (gap > real) this.diagnostics.warn(`Dropped ${Math.round(gap - real)} ms of real time (the gap was longer than maxDeltaMs)`);
      this.last = now;
      this.target.tick(real * this.timeScale());
      this.onStep();
    } catch (error) {
      this.onError(error);
    } finally {
      // Always keep going: one failing step (say, a render bug) must not freeze the game. Not after stop().
      if (this.handle !== null) this.handle = this.scheduler.request(this.step);
    }
  };
}

/**
 * Creates the browser scheduler based on `setTimeout` and `performance.now()`.
 * Unlike `requestAnimationFrame`, timers keep firing in background tabs (throttled, not stopped).
 *
 * Called by: `main.ts`.
 *
 * @param stepMs interval between steps (`runtime.stepMs`)
 */
export function createBrowserScheduler(stepMs: number): Scheduler {
  return {
    now: () => performance.now(),
    request: (cb) => window.setTimeout(cb, stepMs),
    cancel: (h) => window.clearTimeout(h),
  };
}
