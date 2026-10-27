/**
 * @module core
 *
 * The reward multiplier an action gets from `rewardMultiplierFromActionLevel` buyables.
 */
import type { ActionId, BuyableDefinition, GameState } from './types';

/**
 * The factor that `rewardMultiplierFromActionLevel` buyables multiply an action's reward by.
 *
 * @remarks
 * Each owned buyable that targets the action gives `1 + coefficient * ln(1 + level / scale)`, where `level` is the plain action level of
 * its source action. The curve is concave: it starts at 1 for level 0, rises quickly, then ever more slowly, and never stops or falls.
 * The factors of several buyables multiply.
 * Called by: `stats.ts` (`DerivedStats.rewardMultiplier`).
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param targetActionId the action whose reward is multiplied
 * @param actionLevelOf plain action level of an action
 * @returns a factor >= 1 (exactly 1 when no such buyable is owned)
 */
export function levelRewardFactor(
  buyables: readonly BuyableDefinition[],
  state: Pick<GameState, 'purchased'>,
  targetActionId: ActionId,
  actionLevelOf: (actionId: ActionId) => number,
): number {
  let factor = 1;
  for (const b of buyables) {
    const e = b.effect;
    if (e.kind !== 'rewardMultiplierFromActionLevel' || e.targetActionId !== targetActionId || (state.purchased[b.id] ?? 0) <= 0) continue;
    factor *= 1 + e.coefficient * Math.log1p(Math.max(0, actionLevelOf(e.sourceActionId)) / e.scale);
  }
  return factor;
}
