/** @module ui
 * Default tile wording. Called by: uiText. Calls: nothing.
 */
import type { UpgradeTileText } from './parts/upgradeText';

/** Default tile labels. Called by: uiText. Calls: nothing. */
export const upgradeText: UpgradeTileText = {
  max: 'MAX',
  owned: (count) => `×${count}`,
};
