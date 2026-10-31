/**
 * @module ui
 *
 * The MODS row of an action card: the action's own purchases as price-strip tiles under a vertical label.
 *
 * @remarks
 * Called by: `actionCards.ts`. Calls: `upgradeButtons.ts` (the tile from the Upgrades panel), `domKit.ts`.
 */
import type { IconSource } from '../../pixelIcon';
import type { TipRegistry } from '../../tooltip';
import type { UiText } from '../../uiText';
import type { BuyableView } from '../../viewModel';
import { h } from '../domKit';
import { renderUpgrades, upgradeRow } from '../upgradeButtons';

/** Handles to update the MODS row of one card. */
export interface ModsRow {
  /** The row (label and tiles), to place at the bottom of the card; hidden until a purchase of the action shows. */
  readonly root: HTMLElement;
  /** The tiles by buyable id. */
  readonly buttons: ReadonlyMap<string, HTMLButtonElement>;
}

/**
 * Builds the MODS row once.
 *
 * Called by: `mountActionCards`. Calls: `upgradeRow`.
 *
 * @param views the purchases of the action that are not in its square
 * @param buy click handler receiving a purchase id
 * @param icons the icons
 * @param text the display text (the label and the tile wording)
 */
export function buildModsRow(views: readonly BuyableView[], buy: (id: string) => unknown, icons: IconSource, text: UiText): ModsRow {
  const root = h('div', 'mods');
  root.hidden = true;
  const { element, buttons } = upgradeRow(views, buy, icons, text.upgradeTiles);
  root.append(h('span', 'mods-label', text.action.mods), element);
  return { root, buttons };
}

/**
 * Updates the tiles from the views and shows the row once any purchase of it shows.
 *
 * Called by: `mountActionCards` (render). Calls: `renderUpgrades`.
 *
 * @param row the row to update
 * @param views every purchase of the action (those without a tile here, the square's, are skipped)
 * @param tips where the tile tips are registered
 */
export function renderModsRow(row: ModsRow, views: readonly BuyableView[], tips: TipRegistry): void {
  renderUpgrades(row.buttons, views, tips);
  row.root.hidden = !views.some((b) => b.available && row.buttons.has(b.id));
}
