/**
 * @module core
 *
 * Linked payouts: the extra rewards that completed runs of one action may pay out for another action.
 */
import { perRunEvents, type RandomSource } from '../kernel/sampling';
import type { ActionId, PaysActionRule } from '../types';

/** Where the linked-payout rules of an action come from (satisfied by `DerivedStats`). */
export interface LinkedPayoutRules {
  /** The rules of the action: Overclock's `alsoPays` (chance 1) and its owned `paysActionReward` buyables. */
  paysActions(id: ActionId): readonly PaysActionRule[];
}

/** How often one linked reward is paid for a batch of runs. */
export interface LinkedPayout {
  /** The action whose reward is paid. */
  readonly targetActionId: ActionId;
  /** How many whole rewards are paid (a whole number >= 1). */
  readonly count: number;
}

/**
 * Draws how many extra rewards a batch of completed runs pays for other actions.
 *
 * @remarks
 * For `runs` completed runs and a rule with chance `p`, the number of rewards is drawn from Binomial(runs, p), once per batch (not once
 * per run), so a batch of a million runs costs as much as one. Each success is one WHOLE reward of the target action, never a fraction.
 * No random number is drawn while the action has no rule.
 *
 * Called by: `actionRunner.ts` (`ActionRunner.payBatch`). Calls: `DerivedStats.paysActions`, `perRunEvents`.
 */
export class LinkedPayouts {
  /**
   * Creates the unit.
   *
   * @param rules where the rules of an action come from
   * @param random randomness (inject a seeded one in tests)
   */
  constructor(
    private readonly rules: LinkedPayoutRules,
    private readonly random: RandomSource,
  ) {}

  /**
   * Draws the rewards paid for a batch of runs.
   *
   * @param actionId the action whose runs completed
   * @param runs how many runs completed (a whole number >= 1)
   * @returns one entry per rule that paid at least once
   */
  settle(actionId: ActionId, runs: number): LinkedPayout[] {
    const paid: LinkedPayout[] = [];
    for (const rule of this.rules.paysActions(actionId)) {
      const count = perRunEvents(runs, rule.chance, this.random);
      if (count > 0) paid.push({ targetActionId: rule.targetActionId, count });
    }
    return paid;
  }
}
