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

/** Wording held only for opt-in tiles. */
const tileLabels = new WeakMap<HTMLButtonElement, UpgradeTileText>();

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
      upgrade.append(h('span', 'price'), h('span', 'own'));
      tileLabels.set(upgrade, tile);
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
    const tile = tileLabels.get(upgrade);
    if (tile) {
      setText(upgrade.querySelector<HTMLElement>('.price')!, b.maxed ? tile.max : b.costText);
      const own = upgrade.querySelector<HTMLElement>('.own')!;
      setText(own, tile.owned(String(b.owned)));
      own.hidden = !(b.repeatable && b.owned > 0);
      upgrade.classList.toggle('poor', b.available && !b.maxed && !b.affordable);
    }
    tips.set(upgrade, () => b.tip);
  }
}
