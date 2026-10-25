/**
 * @module core
 *
 * Critical links: a critical run of one action banks guaranteed critical successes for another action.
 */
import type { ActionId, GameState } from './types';

/** Where the links of an action come from (satisfied by `DerivedStats`). */
export interface CriticalLinkSource {
  /** The actions that every critical run of `id` banks a guaranteed critical success for. */
  criticalLinks(id: ActionId): readonly ActionId[];
}

/** Most successes one action can have banked; counts are plain numbers and stay whole and exact below this. */
const MAX_BANKED = Number.MAX_SAFE_INTEGER;

/**
 * The bank of guaranteed critical successes.
 *
 * @remarks
 * A `criticalLink` buyable (Ransomware) says that every critical run of its action banks one guaranteed critical success for a
 * target action. When the target completes runs, {@link CriticalLinks.claim} spends the bank: `min(runs, banked)` of the runs are
 * critical for sure. Both steps are closed form, so a batch of any size costs the same. The bank is part of the saved state and
 * resets by re-sleeving. A critical run that was itself guaranteed by the bank banks nothing unless its action has links of its own.
 *
 * Called by: `actionRunner.ts` (`ActionRunner.completeRuns`).
 * Calls: {@link CriticalLinkSource.criticalLinks}.
 */
export class CriticalLinks {
  /**
   * Creates the unit.
   *
   * @param source where the links of an action come from
   * @param state the live game state (mutated: `bankedCriticals`)
   */
  constructor(
    private readonly source: CriticalLinkSource,
    private readonly state: GameState,
  ) {}

  /**
   * Spends banked successes on a batch of completed runs.
   *
   * @param actionId the action whose runs completed
   * @param runs how many runs completed (a whole number >= 1)
   * @returns how many of the runs are guaranteed critical (`min(runs, banked)`; 0 when none are banked)
   */
  claim(actionId: ActionId, runs: number): number {
    const banked = this.state.bankedCriticals[actionId] ?? 0;
    const used = Math.min(runs, banked);
    if (!(used > 0)) return 0;
    if (banked - used > 0) this.state.bankedCriticals[actionId] = banked - used;
    else delete this.state.bankedCriticals[actionId];
    return used;
  }

  /**
   * Banks guaranteed successes for the targets of an action's links, one per critical run.
   *
   * @param actionId the action whose runs completed
   * @param critical how many of them were critical (a whole number >= 0)
   */
  bank(actionId: ActionId, critical: number): void {
    if (!(critical > 0)) return;
    for (const target of this.source.criticalLinks(actionId)) {
      this.state.bankedCriticals[target] = Math.min(MAX_BANKED, (this.state.bankedCriticals[target] ?? 0) + critical);
    }
  }
}
