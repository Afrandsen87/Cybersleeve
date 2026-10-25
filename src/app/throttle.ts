/**
 * @module app
 *
 * Rate limiting of repeated work.
 */

/**
 * Creates a gate that lets work through at most once per `intervalMs`.
 *
 * @remarks
 * Used to refresh the screen less often than the game steps: the game keeps its own step rate, only the (comparatively
 * expensive) rendering is limited. The clock is injected so the gate is testable.
 *
 * Called by: `main.ts`.
 *
 * @param intervalMs shortest time between two admitted calls (`runtime.renderMs`)
 * @param now monotonic clock in ms
 * @returns a function that answers "may the work run now?" and, when it says yes, starts the next interval
 */
export function createThrottle(intervalMs: number, now: () => number): () => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const t = now();
    if (t - last < intervalMs) return false;
    last = t;
    return true;
  };
}
