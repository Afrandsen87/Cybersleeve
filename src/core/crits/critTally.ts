/**
 * @module core
 *
 * The count of critical successes that `hardenedPayloadFromCrits` buyables ask for.
 */
import type { ActionId, BuyableDefinition, GameState } from '../types';

/** Most critical successes the counter holds; it stays a whole, exact number below this. */
const MAX_TALLY = Number.MAX_SAFE_INTEGER;

/**
 * Counts the critical successes of the actions that owned `hardenedPayloadFromCrits` buyables listen to.
 *
 * @remarks
 * Context: crits. The count (`sleeve.hardeningCrits[buyable id]`, one per buyable) is per life: re-sleeving resets it, the save keeps it. It only grows while a buyable
 * that listens to the action is owned, so crits scored before buying it do not count. It is told the critical successes of each
 * batch (a number, so a batch of any size costs the same, and several crits of one run each count). The bonus itself is worked out by the
 * effect (`hardeningBonusPerLevel`), not here.
 *
 * Called by: `actionRunner.ts` (`ActionRunner.settleCrits`). Calls: nothing.
 */
export class CritTally {
  private readonly listeners = new Map<ActionId, readonly string[]>();

  /**
   * Creates the unit.
   *
   * @param buyables the configuration's buyables (only `hardenedPayloadFromCrits` ones matter)
   * @param state the live game state (mutated: `sleeve.hardeningCrits`, keyed by buyable id; read: `sleeve.purchased`)
   */
  constructor(
    buyables: readonly BuyableDefinition[],
    private readonly state: GameState,
  ) {
    for (const b of buyables) {
      if (b.effect.kind !== 'hardenedPayloadFromCrits') continue;
      this.listeners.set(b.effect.critActionId, [...(this.listeners.get(b.effect.critActionId) ?? []), b.id]);
    }
  }

  /**
   * Adds the critical successes of one batch of runs to the count to the count of every owned buyable that listens to the action.
   *
   * @param actionId the action whose runs completed
   * @param critical how many of them were critical successes (a whole number; NaN, negatives and 0 add nothing)
   */
  record(actionId: ActionId, critical: number): void {
    if (!(critical > 0)) return;
    const whole = Math.floor(critical);
    for (const id of this.listeners.get(actionId) ?? []) {
      if ((this.state.sleeve.purchased[id] ?? 0) <= 0) continue;
      const counts = this.state.sleeve.hardeningCrits;
      counts[id] = Math.min(MAX_TALLY, (counts[id] ?? 0) + whole);
    }
  }
}
