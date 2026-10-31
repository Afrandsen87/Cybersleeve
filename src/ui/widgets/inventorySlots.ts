/** @module ui
 * Named slot construction and rendering. Called by: inventoryWidget. Calls: domKit, item actions, TipRegistry.
 */
import type { IconSource } from '../pixelIcon';
import type { TipRegistry } from '../tooltip';
import type { InventoryRowView, InventoryView } from '../viewModel';
import { applyIcon, h, setText, type UiSelection } from './domKit';
/** Slot commands. Called by: buildInventorySlots. Calls: injected commands. */
export interface InventorySlotActions {
  /** Uses one consumable. Called by: slot click. Calls: injected command. */
  use(itemId: string, rarityId: string): void;
  /** Switches an item on/off. Called by: slot click. Calls: injected command. */
  toggle(itemId: string): void;
  /** Redraws after a click. Called by: slot click. Calls: injected renderer. */
  refresh(): void;
}
/** Shared mutable slot handles. Called by: slot builders/renderers. Calls: nothing. */
export interface InventorySlots {
  readonly groups: Map<string, HTMLElement>;
  readonly tiles: Map<string, { readonly tile: HTMLButtonElement; readonly count: HTMLElement }>;
  readonly live: Map<string, InventoryRowView>;
  selected: string | null;
}
/** Stack identity. Called by: inventory widgets. Calls: nothing. */
export const stackKey = (itemId: string, rarityId: string): string => itemId + '/' + rarityId;
/** Builds slots preserving click behavior. Called by: buildInventoryWidget. Calls: applyIcon, injected actions. */
export function buildInventorySlots(
  widget: InventorySlots,
  view: InventoryView,
  icons: IconSource,
  actions: InventorySlotActions,
  selection: UiSelection,
  keptGrid: HTMLElement,
  sellGrid: HTMLElement,
): void {
  for (const r of view.rows) {
    const key = stackKey(r.itemId, r.rarityId);
    const tile = h('button', `item-tile item-slot${r.rarityIndex === null ? '' : ` rarity-${r.rarityIndex}`}`) as HTMLButtonElement;
    const icon = h('span', 'item-icon', r.symbol);
    applyIcon(icon, icons.urlFor(r.itemId));
    const count = h('span', 'item-count');
    const name = h('span', 'item-name', r.name);
    name.append(h('small', 'item-caption', r.caption));
    tile.append(icon, name, count);
    tile.setAttribute('aria-label', r.label);
    tile.addEventListener('click', () => {
      if (r.augmentable) selection.augmentRarityId = selection.augmentRarityId === r.rarityId ? null : r.rarityId;
      if (r.sellable) widget.selected = widget.selected === key ? null : key;
      else if (!r.augmentable) {
        const now = widget.live.get(key) ?? r;
        if (now.toggleable) actions.toggle(r.itemId);
        else if (now.usable) actions.use(r.itemId, r.rarityId);
      }
      actions.refresh();
    });
    // Item containers preserve group visibility; CSS flows their slots into the shared grid.
    const grid = r.sellable ? sellGrid : keptGrid;
    let group = widget.groups.get(r.itemId);
    if (!group) {
      group = h('div', 'item-group');
      widget.groups.set(r.itemId, group);
      grid.append(group);
    }
    group.append(tile);
    widget.tiles.set(key, { tile, count });
  }
}
/** Updates counts, states and lazy tips. Called by: renderInventory. Calls: setText, TipRegistry.set. */
export function renderInventorySlots(widget: InventorySlots, view: InventoryView, tips: TipRegistry, selection: UiSelection): void {
  for (const r of view.rows) {
    const key = stackKey(r.itemId, r.rarityId);
    const handle = widget.tiles.get(key);
    if (!handle) continue;
    widget.live.set(key, r);
    handle.tile.hidden = !r.unlocked;
    setText(handle.count, r.countText);
    handle.tile.classList.toggle('empty', r.count <= 0);
    handle.tile.classList.toggle('selected', r.augmentable ? r.rarityId === selection.augmentRarityId : key === widget.selected);
    handle.tile.classList.toggle('on', r.on);
    handle.tile.disabled = r.sellable || r.augmentable ? r.count <= 0 : !((r.usable || r.toggleable) && r.canUse);
    tips.set(handle.tile, () => r.tip);
  }
}
