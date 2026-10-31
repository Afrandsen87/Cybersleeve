/** @module ui
 * Default stash wording. Called by: uiText. Calls: nothing.
 */
import type { StashText } from './parts/stashText';
/** Stash wording. Called by: uiText. Calls: String.toUpperCase. */
export const stashText: StashText = {
  consumable: 'CONSUMABLE',
  caption: (r) => r.toUpperCase(),
  gain: (v) => '+' + v,
};
