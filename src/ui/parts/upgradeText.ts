/** @module ui
 * Tile wording contract. Called by: UiText, upgradeButtons. Calls: nothing.
 */

/** Preformatted tile labels. Called by: upgradeButtons. Calls: nothing. */
export interface UpgradeTileText {
  /** Label when no copies remain. */
  readonly max: string;
  /** Formats an owned count. Called by: renderUpgrades. Calls: nothing. */
  owned(count: string): string;
}
