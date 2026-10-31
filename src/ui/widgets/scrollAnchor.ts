/**
 * @module ui
 * Automation context: short injected scroll compensation during dock transitions.
 * Called by: automation inspector and tests. Calls: injected frame, measurement and scroll methods.
 */

/** Browser capabilities used only during an active transition. Called by: createScrollAnchor. Calls: nothing. */
export interface ScrollAnchorEnvironment {
  now(): number;
  requestFrame(callback: () => void): void;
  measureTop(): number;
  scrollBy(dy: number): void;
  roomBelow(): number;
  growSpacer(px: number): void;
}

/** A replaceable finite anchoring run. Called by: automation pointer events. Calls: nothing. */
export interface ScrollAnchor {
  start(): void;
  cancel(): void;
}

/** Creates an anchor whose newer runs invalidate all older queued callbacks.
 * Called by: automation inspector mount. Calls: injected environment methods.
 * @param env measurement, clock and scrolling capabilities
 * @returns start/cancel handle; start captures position before the DOM changes
 */
export function createScrollAnchor(env: ScrollAnchorEnvironment): ScrollAnchor {
  let generation = 0;
  return {
    start() {
      const run = ++generation;
      const began = env.now();
      const target = env.measureTop();
      /** Compensates one frame without scanning trees. Called by: requestFrame. Calls: environment methods. */
      function frame(): void {
        if (generation !== run || env.now() - began > 350) return;
        const delta = env.measureTop() - target;
        if (Number.isFinite(delta) && Math.abs(delta) >= 1) {
          if (delta > 0) {
            const shortfall = delta - Math.max(0, env.roomBelow());
            if (shortfall > 0) env.growSpacer(shortfall);
          }
          env.scrollBy(delta);
        }
        env.requestFrame(frame);
      }
      env.requestFrame(frame);
    },
    cancel() {
      generation++;
    },
  };
}
