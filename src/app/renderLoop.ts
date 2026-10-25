/**
 * @module app
 *
 * Drives the screen refresh from the display's frame clock.
 */

/** Source of display frames. Injected so the loop is testable without a browser. */
export interface FrameScheduler {
  /** Calls `callback` before the next display frame; returns a handle for {@link FrameScheduler.cancel}. */
  request(callback: () => void): number;
  /** Cancels a requested frame. */
  cancel(handle: number): void;
}

/** What {@link RenderLoop} needs besides the frame clock. */
export interface RenderLoopOptions {
  /** Answers "may the screen be refreshed now?" (rate limit, e.g. `createThrottle(runtime.renderMs, ...)`). */
  readonly mayRender: () => boolean;
  /** True while nothing can be seen (page hidden): no refresh then. */
  readonly hidden: () => boolean;
  /** Receives an error thrown by a refresh (the loop keeps running). Default: `console.error`. */
  readonly onError?: (error: unknown) => void;
}

/**
 * Refreshes the screen once per display frame, at most as often as the rate limit allows.
 *
 * @remarks
 * The game steps on its own timer (see `GameLoop`); this loop only draws. Drawing on the display's frame clock instead of on the
 * game's timer keeps refreshes evenly spaced and lined up with the screen, which a timer cannot do: timers jitter, so a rate limit
 * on top of one gives refreshes 100 and 150 ms apart at random. Browsers do not deliver frames to hidden pages, and `hidden` also
 * skips the refresh for any that do.
 *
 * Called by: `main.ts`. Calls: the injected `render`, {@link RenderLoopOptions.mayRender}, {@link RenderLoopOptions.hidden}.
 */
export class RenderLoop {
  private handle: number | null = null;
  private readonly onError: (error: unknown) => void;

  /**
   * Creates a loop (not started until {@link RenderLoop.start}).
   *
   * @param frames the frame clock
   * @param render redraws the screen from the current game state
   * @param options rate limit, visibility and error handling
   */
  constructor(
    private readonly frames: FrameScheduler,
    private readonly render: () => void,
    private readonly options: RenderLoopOptions,
  ) {
    this.onError = options.onError ?? ((error) => console.error('Render failed:', error));
  }

  /** Starts the loop. No effect if already running. */
  start(): void {
    if (this.handle === null) this.handle = this.frames.request(this.frame);
  }

  /** Stops the loop. */
  stop(): void {
    if (this.handle === null) return;
    this.frames.cancel(this.handle);
    this.handle = null;
  }

  /** True while running. */
  get running(): boolean {
    return this.handle !== null;
  }

  private readonly frame = (): void => {
    try {
      if (!this.options.hidden() && this.options.mayRender()) this.render();
    } catch (error) {
      this.onError(error);
    } finally {
      // A failing refresh must not end the loop. Not after stop().
      if (this.handle !== null) this.handle = this.frames.request(this.frame);
    }
  };
}

/**
 * The browser's frame clock (`requestAnimationFrame`).
 *
 * Called by: `main.ts`.
 *
 * @returns a scheduler that delivers one callback per display frame
 */
export function createBrowserFrameScheduler(): FrameScheduler {
  return {
    request: (callback) => window.requestAnimationFrame(() => callback()),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  };
}
