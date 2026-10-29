/**
 * @module core
 *
 * Sleeve XP bookkeeping: how completed runs turn into batches of sleeve XP.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import type { ActionState } from '../types';

/** Above this many runs the exact remainder toward the next sleeve-XP batch is meaningless and dropped. */
const EXACT_RUN_LIMIT = 1e15;

/**
 * `floor(x)` as a JS number (`Infinity` beyond the double range, 0 for negatives).
 *
 * Called by: `progression.ts`.
 */
export function wholeCount(x: BigNum): number {
  return Math.max(0, Math.floor(x.toNumber()));
}

/**
 * Counts completed runs towards the action's next batch of sleeve XP and grants the batches that fill up.
 *
 * @remarks
 * Whole runs below {@link EXACT_RUN_LIMIT} are exact as plain numbers (the number type's division is not: 90 / 90 can come out just under 1).
 * Above it the remainder is dropped. Mutates `action.runsTowardSleeveXp` and `action.sleeveXp`.
 *
 * Called by: `Progression.recordRuns`.
 *
 * @param action the action's state
 * @param runs runs to count (>= 1)
 * @param runsPerXp runs one batch takes right now
 * @param perGrant sleeve XP one batch grants
 * @param factory number factory
 */
export function countRunsTowardSleeveXp(
  action: ActionState,
  runs: BigNum,
  runsPerXp: number,
  perGrant: BigNum,
  factory: NumberFactory,
): void {
  const total = factory.fromNumber(action.runsTowardSleeveXp).add(runs);
  let grants: BigNum;
  if (total.lt(factory.fromNumber(EXACT_RUN_LIMIT))) {
    const runCount = Math.round(total.toNumber());
    const batches = Math.floor(runCount / runsPerXp);
    action.runsTowardSleeveXp = runCount - batches * runsPerXp;
    grants = factory.fromNumber(batches);
  } else {
    action.runsTowardSleeveXp = 0;
    grants = total.div(factory.fromNumber(runsPerXp)).floor();
  }
  if (!grants.isZero()) action.sleeveXp = action.sleeveXp.add(grants.mul(perGrant));
}
