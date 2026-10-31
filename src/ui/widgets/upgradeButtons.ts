/**
 * @module ui
 *
 * Rows of square purchase buttons (the purchases of an action, the Sleeve, the skills) and their refresh.
 *
 * @remarks
 * Called by: `actionCards.ts`, `sleeveWidgets.ts`, `skillsPanel.ts`. Calls: `domKit.ts`.
 */
import type { IconSource } from '../pixelIcon';
import type { TipRegistry } from '../tooltip';
import type { BuyableView } from '../viewModel';
import type { UpgradeTileText } from '../uiText';
import { applyIcon, h, setText } from './domKit';

/** The wording and the price strip and badge of each opt-in tile, so a render reads no DOM. */
const tileParts = new WeakMap<
  HTMLButtonElement,
  { readonly text: UpgradeTileText; readonly price: HTMLElement; readonly own: HTMLElement }
>();

/** Builds persistent purchase buttons; optional tile wording adds price strips and badges.
 * Called by: sleeveWidgets, actionCards, skillsPanel, corporationPanel. Calls: applyIcon, h, buy on click.
 * @param views initial purchases (not modified)
 * @param buy click handler receiving a purchase id
 * @param icons pixel icon source
 * @param tile opt-in tile wording; omitted preserves square buttons
 * @returns row element and persistent buttons keyed by id
 */
export function upgradeRow(
  views: readonly BuyableView[],
  buy: (id: string) => unknown,
  icons: IconSource,
  tile?: UpgradeTileText,
): { element: HTMLElement; buttons: Map<string, HTMLButtonElement> } {
  const element = h('div', 'upgrades');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const b of views) {
    const upgrade = h('button', 'upgrade', b.symbol) as HTMLButtonElement;
    applyIcon(upgrade, icons.urlFor(b.id));
    if (tile) {
      upgrade.classList.add('tile');
      const price = h('span', 'price');
      const own = h('span', 'own');
      upgrade.append(price, own);
      tileParts.set(upgrade, { text: tile, price, own });
    }
    upgrade.setAttribute('aria-label', b.name);
    upgrade.addEventListener('click', () => buy(b.id));
    element.append(upgrade);
    buttons.set(b.id, upgrade);
  }
  return { element, buttons };
}

/** Updates button visibility, states, lazy tips and opt-in tile labels from owner-sourced views.
 * Called by: sleeveWidgets, actionCards, skillsPanel, corporationPanel. Calls: setText, TipRegistry.set.
 * @param buttons persistent buttons keyed by purchase id
 * @param views current purchase data (not modified)
 * @param tips lazy hover registry
 */
export function renderUpgrades(buttons: ReadonlyMap<string, HTMLButtonElement>, views: readonly BuyableView[], tips: TipRegistry): void {
  for (const b of views) {
    const upgrade = buttons.get(b.id);
    if (!upgrade) continue;
    upgrade.hidden = !b.available;
    upgrade.disabled = !b.clickable;
    upgrade.classList.toggle('owned', b.owned > 0);
    upgrade.classList.toggle('single', !b.repeatable);
    upgrade.classList.toggle('off', b.toggleable && b.owned > 0 && !b.enabled);
    upgrade.classList.toggle('maxed', b.maxed);
    upgrade.classList.toggle('gated', b.gated);
    upgrade.classList.toggle('purchasable', b.available && !b.maxed && b.affordable);
    const tile = tileParts.get(upgrade);
    if (tile) {
      setText(tile.price, b.maxed ? tile.text.max : b.costText);
      setText(tile.own, tile.text.owned(String(b.owned)));
      tile.own.hidden = !(b.repeatable && b.owned > 0);
      upgrade.classList.toggle('poor', b.available && !b.maxed && !b.affordable);
    }
    tips.set(upgrade, () => b.tip);
  }
}
