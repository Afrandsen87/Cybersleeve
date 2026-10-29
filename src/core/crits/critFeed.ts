/**
 * @module core
 *
 * A short memory of recent critical successes, for showing "this action just hit a critical" on screen.
 */
import type { ActionId } from '../types';

/** How far back the feed looks, in game milliseconds: a critical highlights its action for this long. */
export const CRIT_WINDOW_MS = 1000;

/** What an action's recent critical successes add up to. */
export interface RecentCrits {
  /** Critical successes in the last {@link CRIT_WINDOW_MS} of game time (a whole number >= 0). */
  readonly count: number;
  /** The same as an average per second (`count` over the window; equals `count` for a one second window). */
  readonly perSecond: number;
}

/**
 * Remembers the critical successes of the last second of game time, per action.
 *
 * @remarks
 * Not part of the saved state: it only feeds the display. It keeps its own clock, advanced by the engine with every slice of game
 * time, so it needs no real timers and behaves the same in tests. A batch of runs is one event holding all its critical successes.
 *
 * Called by: `engine.ts` (`advance`, `recentCrits`), `actionRunner.ts` (`ActionRunner.completeRuns` records).
 */
export class CritFeed {
  private nowMs = 0;
  private readonly events = new Map<ActionId, { atMs: number; count: number }[]>();

  /** Moves the clock on by `deltaMs` of game time (>= 0). Called by the engine for every slice. */
  advance(deltaMs: number): void {
    if (deltaMs > 0) this.nowMs += deltaMs;
  }

  /**
   * Notes that a batch of completed runs of an action had critical successes, now.
   *
   * @param actionId the action
   * @param count critical successes in the batch (a whole number; nothing is noted for 0)
   */
  record(actionId: ActionId, count: number): void {
    if (!(count > 0)) return;
    let list = this.events.get(actionId);
    if (!list) {
      list = [];
      this.events.set(actionId, list);
    }
    this.prune(list);
    list.push({ atMs: this.nowMs, count });
  }

  /**
   * The critical successes of an action in the last {@link CRIT_WINDOW_MS}.
   *
   * @param actionId the action
   * @returns the total and the average per second; zero when none happened in the window
   */
  recent(actionId: ActionId): RecentCrits {
    const list = this.events.get(actionId);
    if (!list) return { count: 0, perSecond: 0 };
    this.prune(list);
    const count = list.reduce((sum, e) => sum + e.count, 0);
    return { count, perSecond: (count * 1000) / CRIT_WINDOW_MS };
  }

  /** Forgets everything (a new game or a re-sleeve). */
  clear(): void {
    this.events.clear();
  }

  /** Drops the events that have left the window. */
  private prune(list: { atMs: number; count: number }[]): void {
    while (list.length > 0 && this.nowMs - list[0]!.atMs > CRIT_WINDOW_MS) list.shift();
  }
}
