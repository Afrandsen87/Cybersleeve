/** @module ui
 * Pure currency-row ordering. Called by: sleeveView. Calls: nothing.
 */
import type { BuyableView } from './viewTypes';

/** Stably puts bought one-time purchases first; repeatables stay in the rest.
 * Called by: sleeveView. Calls: nothing.
 * @param views incoming base-price order, never modified
 * @returns a new ordered array
 */
export function boughtOneTimeFirst(views: readonly BuyableView[]): BuyableView[] {
  const bought: BuyableView[] = [];
  const rest: BuyableView[] = [];
  for (const view of views) (view.owned > 0 && !view.repeatable ? bought : rest).push(view);
  return bought.concat(rest);
}
