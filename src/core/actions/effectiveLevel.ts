/** Actions/effects/economy: effective levels. Called by: ToggleStats. Calls: resolveLevelBonus, sleeveSkillsOwned. */
import { resolveLevelBonus } from '../effects/queries';
import { sleeveSkillsOwned } from '../economy/sleeveSkills';
import type { ActionId, BuyableDefinition, StateSlice } from '../types';
/** ONE owner of real action level plus bonuses for derived calculations. Actions/effects/economy contexts.
 * Called by: ToggleStats. Calls: resolveLevelBonus, sleeveSkillsOwned and injected progression queries.
 * @param buyables configured effects
 * @param state read-only purchases
 * @param id target action
 * @param actionLevelOf real action level
 * @param sleeveLevelOf real sleeve level
 * @returns effective level; never writes XP or stored levels
 */
export function effectiveActionLevel(
  buyables: readonly BuyableDefinition[],
  state: StateSlice<'purchased'>,
  id: ActionId,
  actionLevelOf: (id: ActionId) => number,
  sleeveLevelOf: (id: ActionId) => number,
): number {
  return actionLevelOf(id) + resolveLevelBonus(buyables, state, id, sleeveLevelOf, sleeveSkillsOwned(buyables, state));
}
