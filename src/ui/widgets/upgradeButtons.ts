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
import type { BuyableView, SleeveSection } from '../viewModel';
import { applyIcon, h } from './domKit';

/** Builds a row of square purchase buttons; clicking one calls `buy(id)`. */
export function upgradeRow(
  views: readonly BuyableView[],
  buy: (id: string) => unknown,
  icons: IconSource,
): { element: HTMLElement; buttons: Map<string, HTMLButtonElement> } {
  const element = h('div', 'upgrades');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const b of views) {
    const upgrade = h('button', 'upgrade', b.symbol) as HTMLButtonElement;
    applyIcon(upgrade, icons.urlFor(b.id));
    upgrade.setAttribute('aria-label', b.name);
    upgrade.addEventListener('click', () => buy(b.id));
    element.append(upgrade);
    buttons.set(b.id, upgrade);
  }
  return { element, buttons };
}

/** Adds one row of purchase buttons (with its title, unless the widget's own heading already says it) to a widget and registers its buttons. */
export function addSection(
  widget: HTMLElement,
  section: SleeveSection,
  buy: (id: string) => unknown,
  into: Map<string, HTMLButtonElement>,
  withTitle: boolean,
  icons: IconSource,
): void {
  const row = upgradeRow(section.buyables, buy, icons);
  if (withTitle) widget.append(h('h3', 'section-title', section.title));
  widget.append(row.element);
  for (const [id, button] of row.buttons) into.set(id, button);
}

/** Updates square purchase buttons (visibility, enabled state, hover tooltip text) from their view data. */
export function renderUpgrades(buttons: ReadonlyMap<string, HTMLButtonElement>, views: readonly BuyableView[], tips: TipRegistry): void {
  for (const b of views) {
    const upgrade = buttons.get(b.id);
    if (!upgrade) continue;
    upgrade.hidden = !b.available;
    upgrade.disabled = !b.clickable;
    upgrade.classList.toggle('owned', b.owned > 0);
    upgrade.classList.toggle('single', !b.repeatable);
    upgrade.classList.toggle('off', b.toggleable && b.owned > 0 && !b.enabled);
    upgrade.classList.toggle('ready', b.ready);
    upgrade.classList.toggle('purchasable', b.available && !b.maxed && b.affordable);
    tips.set(upgrade, () => b.tip);
  }
}
