/**
 * @module core
 *
 * What each kind of run reward is: where it is paid and which rules touch it.
 */
import type { BigNum } from '../numbers';
import { addToScalar } from './fields';
import type { GameState, RewardKind } from './types';

/** Everything the game needs to know about one reward kind. One entry per kind in {@link REWARDS}. */
export interface RewardDescriptor {
  /** The scalar of the game state the reward is added to (see `fields.ts`). */
  readonly field: string;
  /** Rewards are whole units per run: each run's amount is rounded down before the runs are summed. */
  readonly wholePerRun?: boolean;
  /** `global.creditMultiplier` scales this reward. Only credits are scaled by a global lever. */
  readonly scaledByCreditMultiplier?: boolean;
  /** The reward may be paid once per network node owned (`ActionDefinition.rewardPerNetworkNode`). */
  readonly mayBePerNetworkNode: boolean;
}

/**
 * The descriptor of every reward kind. A new kind is one entry here (and one member of `RewardKind`); the compiler
 * demands it, and no other file needs a rule about it.
 */
export const REWARDS: Readonly<Record<RewardKind, RewardDescriptor>> = {
  credits: { field: 'credits', scaledByCreditMultiplier: true, mayBePerNetworkNode: true },
  networkNodes: { field: 'network', wholePerRun: true, mayBePerNetworkNode: false },
  hackingProficiency: { field: 'hackingProficiency', mayBePerNetworkNode: false },
  nodePayout: { field: 'nodePayoutBonus', mayBePerNetworkNode: false },
  iceRating: { field: 'iceRating', mayBePerNetworkNode: true },
  infamy: { field: 'infamy', wholePerRun: true, mayBePerNetworkNode: true },
};

/** The kind a reward has when an action does not say (`credits`). */
export const DEFAULT_REWARD_KIND: RewardKind = 'credits';

/** Every valid reward kind. */
export const REWARD_KINDS: readonly RewardKind[] = Object.keys(REWARDS) as RewardKind[];

/**
 * The descriptor of an action's reward.
 *
 * Called by: `economy.ts`, `actionRunner.ts`, `config.ts`.
 *
 * @param kind `ActionDefinition.rewardKind` (`undefined` means credits)
 */
export function rewardOf(kind: RewardKind | undefined): RewardDescriptor {
  return REWARDS[kind ?? DEFAULT_REWARD_KIND];
}

/**
 * Pays `runs` runs of a reward in full. Heat taxes only the credits network nodes produce, never a run's reward.
 *
 * Called by: `actionRunner.ts`.
 *
 * @param state state to mutate
 * @param kind the reward kind
 * @param gross amount of one run
 * @param runs number of runs (a `BigNum`)
 */
export function payReward(state: GameState, kind: RewardKind, gross: BigNum, runs: BigNum): void {
  const target = REWARDS[kind];
  const perRun = target.wholePerRun ? gross.floor() : gross;
  addToScalar(state, target.field, perRun.mul(runs));
}
