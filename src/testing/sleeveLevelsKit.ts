/**
 * @module testing
 *
 * Test setup for the two re-sleeve unlocks of the REAL content (Sleeve levels, then Unlock resleeving): buys both and lets the re-sleeve lockout run out, so a test can re-sleeve.
 *
 * @remarks
 * Used by the tests of `content/` that re-sleeve the real game. The unit-test config has no such unlock and needs none of this.
 */
import { RESLEEVE_UNLOCK, SKILL_SLEEVE_UP, SLEEVE_LEVELS } from '../content/ids';
import type { GameEngine, SleeveRunRecord } from '../core';
import { num } from '../numbers';
import { setCredits, setSleeveXp } from './testConfig';

/** Credits that cover both unlocks (100e6 and 100e9) with room to spare. */
const PLENTY = num('1e100');

/**
 * Gives the player plenty of credits, buys both unlocks, waits out the lockout and writes enough sleeve XP on the first action
 * to pass the sleeve-level gate of every re-sleeve a test makes (sleeve XP carries over a re-sleeve).
 *
 * @param g an engine built on the real content
 * @param lockoutMs the content's `resleeve.lockoutMs` (default 5000)
 */
export function openResleeving(g: GameEngine, lockoutMs = 5_000): void {
  setCredits(g, PLENTY);
  g.buy(SLEEVE_LEVELS);
  g.buy(RESLEEVE_UNLOCK);
  g.tick(lockoutMs);
  const firstId = Object.keys(g.getState().sleeve.actions)[0];
  if (firstId !== undefined) setSleeveXp(g, num('1e30'), firstId);
}

/**
 * Earns points by recording a finished run and buys Sleeve Up! to open sleeve-skill-gated content.
 * Called by: real-content tests. Calls: GameEngine.buy.
 * Mutates the run history and owned sleeve skills.
 *
 * @param g an engine built on any config
 */
export function markResleeved(g: GameEngine): void {
  (g.getState().wallet.runs as SleeveRunRecord[]).push({ creditsPerSecond: num(0), actionLevelsTotal: 0, sleeveLevelsTotal: 0 });
  g.buy(SKILL_SLEEVE_UP);
}

/**
 * Re-sleeves the REAL game through the progress gate: before the re-sleeve it raises the first action's XP and sleeve XP above anything
 * an earlier run had, so both level totals beat the last run's by at least one.
 *
 * @param g an engine built on the real content with re-sleeving open (see {@link openResleeving})
 * @returns what `resleeve()` returned
 */
export function resleeveWithProgress(g: GameEngine): boolean {
  const state = g.getState();
  const firstId = Object.keys(state.sleeve.actions)[0];
  if (firstId !== undefined) {
    const power = `1e${20 * (state.wallet.runs.length + 2)}`;
    (state.sleeve.actions[firstId] as { xp: unknown }).xp = num(power);
    setSleeveXp(g, num(power), firstId);
  }
  return g.resleeve();
}
