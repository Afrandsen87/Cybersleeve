/**
 * @module core
 *
 * Dedicated queries over owned buyables whose kind has no action or sleeve hook: level bonus, network growth, drop chance.
 *
 * Called by: `engine/stats.ts`, `engine/engine.ts`. Calls: `ownedEffects`.
 */
import { saturate } from '../kernel/infinity';
import type { ActionId, BuyableDefinition, StateSlice, StateSliceView } from '../types';
import { ownedEffects } from './ownedOfKind';

/**
 * True when the player owns the Auto-run buyable of an action, whether it is switched on or off.
 *
 * @remarks
 * The one owner of "is Auto-run owned for this action" (used to gate Augments). It asks for the buyables of the `autoRun` effect
 * and reads the action each one belongs to, so no content id is compared. A switched-off Auto-run still counts as owned.
 * Called by: `app/createGame.ts` (the gate injected into `Augments`), `ui/view/squareRules.ts` and `ui/view/modeViews.ts` (the square lock and the Augment button). Calls: {@link ownedEffects}.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param actionId the action asked about
 * @returns true when at least one copy of an Auto-run buyable for that action is owned
 */
export function ownsAutoRun(buyables: readonly BuyableDefinition[], state: StateSliceView<'purchased'>, actionId: ActionId): boolean {
  return ownedEffects(buyables, state.sleeve.purchased, 'autoRun').some((k) => k.buyable.actionId === actionId);
}

/**
 * Level bonus an action gets from `levelBonusFromSleeveLevel` buyables: the sleeve level of the source action, per copy owned.
 *
 * @remarks
 * It is added to the action's level when speed is computed; it never changes the action's XP or leveling progress.
 * Called by: `engine.ts`.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param actionId the action that receives the bonus
 * @param sleeveLevelOf sleeve level of an action
 * @returns the flat number of levels to add (>= 0)
 */
export function resolveLevelBonus(
  buyables: readonly BuyableDefinition[],
  state: StateSlice<'purchased'>,
  actionId: ActionId,
  sleeveLevelOf: (actionId: ActionId) => number,
): number {
  let bonus = 0;
  for (const { effect, owned } of ownedEffects(buyables, state.sleeve.purchased, 'levelBonusFromSleeveLevel')) {
    if (effect.targetActionId === actionId) bonus += sleeveLevelOf(effect.sourceActionId) * owned;
  }
  return bonus;
}

/**
 * Fraction of its own size the network gains per second, summed over owned growth buyables: `networkGrowth` adds its fixed
 * `ratePerSecond`; `networkGrowthFromActionLevel` adds `level * percentPerLevel / 100` of its source action's level.
 *
 * Called by: `stats.ts` (`DerivedStats.networkGrowthRate`).
 *
 * @remarks
 * Walks the buyables once, in configuration order, rather than once per kind: the two kinds' terms are added in that interleaved order
 * and floating-point addition depends on order, so a per-kind query would change the sum in the last digits.
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param actionLevelOf plain action level of an action (without level bonuses)
 * @returns the growth rate per second (>= 0; 0.000001 means 0.0001 percent)
 */
export function resolveNetworkGrowth(
  buyables: readonly BuyableDefinition[],
  state: StateSlice<'purchased'>,
  actionLevelOf: (actionId: ActionId) => number,
): number {
  let rate = 0;
  for (const b of buyables) {
    const owned = state.sleeve.purchased[b.id] ?? 0;
    if (owned <= 0) continue;
    if (b.effect.kind === 'networkGrowth') rate += b.effect.ratePerSecond * owned;
    else if (b.effect.kind === 'networkGrowthFromActionLevel') {
      rate += ((actionLevelOf(b.effect.sourceActionId) * b.effect.percentPerLevel) / 100) * owned;
    }
  }
  return rate;
}

/**
 * The factor owned `itemDropChanceMultiplier` buyables apply to the drop chance of an item: `factor^copies`, multiplied over buyables.
 *
 * Called by: `stats.ts` (`DerivedStats.itemDrops`).
 *
 * @param buyables all buyable definitions
 * @param state current state (reads `purchased`)
 * @param itemId the item whose drop chance is asked about
 * @returns a factor >= 1 (1 when none is owned)
 */
export function resolveDropChanceFactor(buyables: readonly BuyableDefinition[], state: StateSlice<'purchased'>, itemId: string): number {
  let factor = 1;
  for (const { effect, owned } of ownedEffects(buyables, state.sleeve.purchased, 'itemDropChanceMultiplier')) {
    if (effect.itemId === itemId) factor *= effect.factor ** owned;
  }
  return saturate(factor);
}
