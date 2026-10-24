/**
 * @module testing
 *
 * Fakes for the injected interfaces, so the loop and storage can be tested without real timers or a browser.
 * Not part of the shipped game.
 */
import type { Scheduler } from '../app/loop';

/** A {@link Scheduler} whose clock only moves when a test calls {@link FakeScheduler.advance}. */
export class FakeScheduler implements Scheduler {
  time = 0;
  private callback: (() => void) | null = null;
  private next = 1;

  now(): number {
    return this.time;
  }

  request(cb: () => void): number {
    this.callback = cb;
    return this.next++;
  }

  cancel(): void {
    this.callback = null;
  }

  /** True while a step is scheduled. */
  get pending(): boolean {
    return this.callback !== null;
  }

  /** Moves the clock forward and fires the scheduled step, if any. */
  advance(ms: number): void {
    this.time += ms;
    const cb = this.callback;
    this.callback = null;
    cb?.();
  }
}
