/**
 * @module core
 *
 * Where each kind of run reward goes.
 */
import type { BigNum } from '../numbers';
import { addToScalar } from './fields';
import type { GameState, RewardKind } from './types';

/** Where a reward kind is paid. */
export interface RewardTarget {
  /** The scalar of the game state the reward is added to (see `fields.ts`). */
  readonly field: string;
  /** Rewards are whole units per run: each run's amount is rounded down before the runs are summed. */
  readonly wholePerRun?: boolean;
}

/**
 * The target of every reward kind except `credits`, which is taxed by heat and so handled by the engine.
 * A new kind is added here (and to `RewardKind`); the engine needs no change.
 */
export const REWARD_TARGETS: Readonly<Record<Exclude<RewardKind, 'credits'>, RewardTarget>> = {
  networkNodes: { field: 'network', wholePerRun: true },
  interfaceSpeed: { field: 'interfaceSpeedBonus' },
  nodePayout: { field: 'nodePayoutBonus' },
  circumvention: { field: 'circumvention' },
  infamy: { field: 'infamy' },
};

/** Every valid reward kind. */
export const REWARD_KINDS: readonly RewardKind[] = ['credits', ...(Object.keys(REWARD_TARGETS) as (keyof typeof REWARD_TARGETS)[])];

/**
 * Pays `runs` runs of a non-credit reward.
 *
 * Called by: `engine.ts` (`GameEngine.completeRuns`).
 *
 * @param state state to mutate
 * @param kind the reward kind (anything but `credits`)
 * @param gross amount of one run
 * @param runs number of runs, counted with the output multiplier (a `BigNum`: it can be huge)
 */
export function payReward(state: GameState, kind: Exclude<RewardKind, 'credits'>, gross: BigNum, runs: BigNum): void {
  const target = REWARD_TARGETS[kind];
  const perRun = target.wholePerRun ? gross.floor() : gross;
  addToScalar(state, target.field, perRun.mul(runs));
}
