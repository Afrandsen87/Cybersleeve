/**
 * @module app
 *
 * Test aid: a switch that fast-forwards game time.
 */

/**
 * Holds the on/off state of the fast-forward switch.
 *
 * Called by: `main.ts` (feeds `GameLoopOptions.timeScale`), `ui/dom.ts` (button).
 */
export class SpeedToggle {
  private on = false;

  /**
   * Creates the switch (off).
   * @param fastFactor time multiplier while on (`runtime.fastForwardFactor`)
   */
  constructor(private readonly fastFactor: number) {}

  /** True while fast-forward is active. */
  get enabled(): boolean {
    return this.on;
  }

  /** Current time multiplier: the fast factor when on, otherwise 1. */
  get factor(): number {
    return this.on ? this.fastFactor : 1;
  }

  /** Flips the switch. @returns the new state */
  toggle(): boolean {
    this.on = !this.on;
    return this.on;
  }
}
