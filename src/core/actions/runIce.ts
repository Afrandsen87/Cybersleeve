/** Actions/effects: base ICE earned by completed runs. Called by: ActionRunner. Calls: ownedEffects, perRunEvents. */
import type { NumberFactory } from '../../numbers';
import { ownedEffects } from '../effects/ownedOfKind';
import { perRunEvents, type RandomSource } from '../kernel/sampling';
import type { ActionId, BuyableDefinition, GameState } from '../types';

/** Actions/effects: applies one binomial draw per owned run-ICE effect after pay, before heat.
 * Called by: ActionRunner.runBatch. Calls: ownedEffects, perRunEvents. Mutates base sleeve ICE only.
 * @param buyables configured effects
 * @param state live state to credit
 * @param id completed action
 * @param runs completed run count
 * @param factory big-number adapter
 * @param random injected randomness (untouched with no copies)
 */
export function earnRunIce(
  buyables: readonly BuyableDefinition[],
  state: GameState,
  id: ActionId,
  runs: number,
  factory: NumberFactory,
  random: RandomSource,
): void {
  for (const { buyable, effect, owned } of ownedEffects(buyables, state.sleeve.purchased, 'runIceChance')) {
    if (buyable.actionId !== id) continue;
    const chance = Math.min(1, effect.chance + effect.perCopy * (owned - 1));
    const hits = perRunEvents(runs, chance, random);
    if (hits > 0) state.sleeve.iceRating = state.sleeve.iceRating.add(factory.fromNumber(hits));
  }
}
