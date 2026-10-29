/**
 * @module core
 *
 * Paying the reward of runs: the one path every payment of a run reward takes (own runs, critical runs, linked payouts).
 */
import type { BigNum } from '../../numbers';
import type { Economy } from '../economy/economy';
import type { ActionDefinition, ActionId, GameState } from '../types';
import type { ActionLookup } from './actionLookup';
import { DEFAULT_REWARD_KIND, payReward } from './rewards';

/** Where the reward multiplier of an action comes from (satisfied by `DerivedStats`). */
export interface RewardMultipliers {
  /** Multiplier on the action's reward from its owned buyables (nothing else is scaled by it). */
  rewardMultiplier(id: ActionId): BigNum;
}

/**
 * Pays the reward of completed runs into the game state.
 *
 * @remarks
 * Every run payment goes through {@link RewardPayer.payRun}: gross reward from the economy at the action's own multiplier, then
 * `payReward` in the action's reward kind (credits when it names none), which rounds whole-unit rewards. Heat never taxes it.
 *
 * Called by: `actionRunner.ts`. Calls: `Economy.grossReward`, `payReward`, {@link RewardMultipliers}.
 */
export class RewardPayer {
  /**
   * Creates the unit.
   *
   * @param state the live game state (mutated)
   * @param economy reward formulas
   * @param multipliers where the reward multiplier of an action comes from
   * @param definition action lookup
   */
  constructor(
    private readonly state: GameState,
    private readonly economy: Economy,
    private readonly multipliers: RewardMultipliers,
    private readonly definition: ActionLookup,
  ) {}

  /**
   * Pays `runs` runs of an action's reward: its reward, its own reward multipliers and its reward kind.
   *
   * @param def the action whose reward is paid
   * @param runs number of runs (a `BigNum`)
   * @param scale optional extra factor on one run's amount (a critical success pays `rewardMultiplier` times); default none
   */
  payRun(def: ActionDefinition, runs: BigNum, scale?: BigNum): void {
    const gross = this.economy.grossReward(def, this.state.network, this.multipliers.rewardMultiplier(def.id));
    payReward(this.state, def.rewardKind ?? DEFAULT_REWARD_KIND, scale ? gross.mul(scale) : gross, runs);
  }

  /**
   * Pays the reward of another action for `runs` runs, as if that action had completed them (a linked payout). Its XP, heat, drops and
   * critical successes are not part of it.
   *
   * @param otherId the action whose reward is paid
   * @param runs number of rewards (a `BigNum`)
   */
  payLinked(otherId: ActionId, runs: BigNum): void {
    this.payRun(this.definition(otherId), runs);
  }
}
