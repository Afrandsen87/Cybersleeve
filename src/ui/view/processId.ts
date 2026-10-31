/**
 * @module ui
 *
 * The two small derivations of an action card's title bar: the process id and the state LED.
 *
 * @remarks
 * Called by: `actionView.ts`. Calls: nothing. Pure: no DOM, no state of its own.
 */
import type { ProcessState } from './actionViewTypes';

/** Letters kept of every word after the first in a process id. */
const TAIL_WORD_LETTERS = 3;

/**
 * Derives the muted process id of the title bar from an action id: lower case words joined by `_`, the first in full and the others
 * cut to their first letters (`grow-network` gives `grow_net`, `legend` stays `legend`).
 *
 * Called by: `buildActionViews`. Calls: nothing.
 *
 * @param actionId the action id (words separated by `-` or `_`)
 * @returns the process id; empty text for an id with no letters
 */
export function processId(actionId: string): string {
  const words = actionId
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter((w) => w.length > 0);
  return words.map((w, i) => (i === 0 ? w : w.slice(0, TAIL_WORD_LETTERS))).join('_');
}

/**
 * The state of the title bar's LED: `auto` while running on Auto-run, `running` while running by hand, `idle` otherwise.
 *
 * Called by: `buildActionViews`. Calls: nothing.
 *
 * @param running the action is running now
 * @param auto Auto-run is on for the action
 */
export function processState(running: boolean, auto: boolean): ProcessState {
  if (!running) return 'idle';
  return auto ? 'auto' : 'running';
}
