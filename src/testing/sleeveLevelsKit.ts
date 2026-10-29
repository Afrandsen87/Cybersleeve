/**
 * @module testing
 *
 * Test setup for the sleeve-levels unlock of the REAL content: buys it and lets the re-sleeve lockout run out, so a test can re-sleeve.
 *
 * @remarks
 * Used by the tests of `content/` that re-sleeve the real game. The unit-test config has no such unlock and needs none of this.
 */
import { SLEEVE_LEVELS } from '../content/ids';
import type { GameEngine, SleeveRunRecord } from '../core';
import { num } from '../numbers';
import { setCredits, setSleeveXp } from './testConfig';

/** Credits that cover the unlock (price 100e9) with room to spare. */
const PLENTY = num('1e100');

/**
 * Gives the player plenty of credits, buys the sleeve-levels unlock, waits out the lockout and writes enough sleeve XP on the first action
 * to pass the sleeve-level gate of every re-sleeve a test makes (sleeve XP carries over a re-sleeve).
 *
 * @param g an engine built on the real content
 * @param lockoutMs the content's `resleeve.lockoutMs` (default 5000)
 */
export function openResleeving(g: GameEngine, lockoutMs = 5_000): void {
  setCredits(g, PLENTY);
  g.buy(SLEEVE_LEVELS);
  g.tick(lockoutMs);
  const firstId = Object.keys(g.getState().sleeve.actions)[0];
  if (firstId !== undefined) setSleeveXp(g, num('1e30'), firstId);
}

/**
 * Writes one finished sleeve-run into the state without playing it, so content that waits for the second sleeve run
 * (`revealAfterResleeves`) is available. Does not touch anything else.
 *
 * @param g an engine built on any config
 */
export function markResleeved(g: GameEngine): void {
  (g.getState().wallet.runs as SleeveRunRecord[]).push({ creditsPerSecond: num(0), actionLevelsTotal: 0 });
}
