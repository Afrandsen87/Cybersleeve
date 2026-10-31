/** Economy context: distinct skill count. Called by: Shop and effect callers. Calls: sleeveSkillIds. */
import { sleeveSkillIds } from '../kernel/currencies';
import type { BuyableDefinition, StateSliceView } from '../types';
/** Counts distinct owned sleeve skills, irrespective of copies. Economy context.
 * Called by: Shop.isAvailable, ToggleStats, DerivedStats. Calls: sleeveSkillIds.
 * @param buyables configured definitions
 * @param state read-only purchases
 * @returns distinct positive ownership count
 */
export function sleeveSkillsOwned(buyables: readonly BuyableDefinition[], state: StateSliceView<'purchased'>): number {
  return sleeveSkillIds(buyables).filter((id) => (state.sleeve.purchased[id] ?? 0) > 0).length;
}
