/**
 * @module ui
 *
 * The Inventory widget: a grid of item tiles, with the Sell, Sell all and Back channel buttons beside the sellable ones.
 *
 * @remarks
 * Called by: `ui/dom.ts`. Calls: `domKit.ts`, `GameCommands.sellItems`, `giveUpForMoles`, `useBurnLead`, `useSkillShard`, `toggleZeroDays`, `toggleAdminKeys`.
 */
import type { ItemCommands, StateQueries } from '../../core';
import type { IconSource } from '../pixelIcon';
import type { TipRegistry } from '../tooltip';
import type { UiText } from '../uiText';
import type { InventoryRowView, InventoryView } from '../viewModel';
import { applyIcon, h, setText, type UiSelection } from './domKit';

/** Handles to update the Inventory widget. */
interface InventoryWidget {
  readonly root: HTMLElement;
  /** The section of items that are kept or used, and the section of items that can be sold (each hidden when it has no items). */
  readonly keptSection: HTMLElement;
  readonly sellSection: HTMLElement;
  /** The row of tiles of each item, by item id (hidden while the item is not unlocked). */
  readonly groups: ReadonlyMap<string, HTMLElement>;
  /** One tile per item and rarity, by `itemId/rarityId`, with the element that shows its count. */
  readonly tiles: ReadonlyMap<string, { readonly tile: HTMLButtonElement; readonly count: HTMLElement }>;
  /** The buttons beside the sellable tiles; they act on the selected stack. */
  readonly sellOne: HTMLButtonElement;
  readonly sellAll: HTMLButtonElement;
  readonly backChannel: HTMLButtonElement;
  /** The sellable stack the player has selected (`itemId/rarityId`), or `null`. A choice of the screen only: not saved. */
  selected: string | null;
}

/** The key of a stack in the Inventory widget. */
const stackKey = (itemId: string, rarityId: string): string => `${itemId}/${rarityId}`;

/**
 * Builds the Inventory widget: a grid tile for every item and rarity (its icon, with the count underneath), in two sections. The
 * items that are kept or used are on the left; the items that can be sold are on the right, where a tile is selected by clicking it
 * and the buttons beside the grid sell what is selected. Clicking a tile of an item that is used (a Burn lead) uses one; clicking a Zero-day switches its toggle.
 *
 * Called by: {@link mountUi}.
 *
 * @param view the initial view data (decides which tiles exist)
 * @param icons the icons of the items
 * @param text the display text (headings and button labels)
 * @param actions what the tiles and buttons do; each is followed by a refresh of the screen
 * @param selection where the choice of an Augment schematic rarity is written (clicking an Augment tile selects its rarity, clicking it again deselects)
 */
export function buildInventoryWidget(
  view: InventoryView,
  icons: IconSource,
  text: UiText,
  actions: {
    sell(itemId: string, rarityId: string, amount: number | 'all'): void;
    giveUp(itemId: string, rarityId: string): void;
    use(itemId: string, rarityId: string): void;
    toggle(itemId: string): void;
    refresh(): void;
  },
  selection: UiSelection,
): InventoryWidget {
  const root = h('aside', 'inventory-widget');
  const keptGrid = h('div', 'item-grid');
  const sellGrid = h('div', 'item-grid');
  const groups = new Map<string, HTMLElement>();
  const tiles = new Map<string, { tile: HTMLButtonElement; count: HTMLElement }>();
  const widget: InventoryWidget = {
    root,
    keptSection: h('section', 'inventory-section'),
    sellSection: h('section', 'inventory-section inventory-for-sale'),
    groups,
    tiles,
    sellOne: h('button', 'inventory-action', text.inventory.sellOne) as HTMLButtonElement,
    sellAll: h('button', 'inventory-action', text.inventory.sellAll) as HTMLButtonElement,
    backChannel: h('button', 'inventory-action', text.inventory.backChannel) as HTMLButtonElement,
    selected: null,
  };
  for (const r of view.rows) {
    const key = stackKey(r.itemId, r.rarityId);
    const tile = h('button', `item-tile${r.rarityIndex === null ? '' : ` rarity-${r.rarityIndex}`}`) as HTMLButtonElement;
    const icon = h('span', 'item-icon', r.symbol);
    applyIcon(icon, icons.urlFor(r.itemId));
    const count = h('span', 'item-count');
    tile.append(icon, count);
    tile.setAttribute('aria-label', r.label);
    tile.addEventListener('click', () => {
      if (r.augmentable) selection.augmentRarityId = selection.augmentRarityId === r.rarityId ? null : r.rarityId;
      if (r.sellable) widget.selected = widget.selected === key ? null : key;
      else if (!r.augmentable) {
        if (r.toggleable) actions.toggle(r.itemId);
        else if (r.usable) actions.use(r.itemId, r.rarityId);
      }
      actions.refresh();
    });
    // The tiles of one item sit together in a row of their own; a divider separates the items.
    const grid = r.sellable ? sellGrid : keptGrid;
    let group = groups.get(r.itemId);
    if (!group) {
      group = h('div', 'item-group');
      groups.set(r.itemId, group);
      grid.append(group);
    }
    group.append(tile);
    tiles.set(key, { tile, count });
  }
  const selectedRow = (): InventoryRowView | undefined => {
    const [itemId, rarityId] = (widget.selected ?? '').split('/');
    return view.rows.find((r) => r.itemId === itemId && r.rarityId === rarityId);
  };
  widget.sellOne.addEventListener('click', () => {
    const r = selectedRow();
    if (r) actions.sell(r.itemId, r.rarityId, 1);
    actions.refresh();
  });
  widget.sellAll.addEventListener('click', () => {
    const r = selectedRow();
    if (r) actions.sell(r.itemId, r.rarityId, 'all');
    actions.refresh();
  });
  widget.backChannel.addEventListener('click', () => {
    const r = selectedRow();
    if (r) actions.giveUp(r.itemId, r.rarityId);
    actions.refresh();
  });
  const buttons = h('div', 'inventory-actions');
  buttons.append(widget.sellOne, widget.sellAll, widget.backChannel);
  const sellBody = h('div', 'inventory-sell-body');
  sellBody.append(sellGrid, buttons);
  widget.keptSection.append(h('h3', 'section-title', text.inventory.sections.kept), keptGrid);
  widget.sellSection.append(h('h3', 'section-title', text.inventory.sections.sellable), sellBody);
  const body = h('div', 'inventory-body');
  body.append(widget.keptSection, widget.sellSection);
  root.append(h('h2', undefined, view.title), body);
  root.hidden = !view.visible;
  return widget;
}

/**
 * Writes the inventory view into its widget: every tile shows its count (dimmed while it is 0), the selected sellable stack is
 * marked, and the buttons beside the sellable tiles act on it. A selection that has run out (everything sold) is dropped. The
 * selected Augment rarity is marked the same way; it is dropped when none of it is left.
 */
export function renderInventory(widget: InventoryWidget, view: InventoryView, tips: TipRegistry, selection: UiSelection): void {
  widget.root.hidden = !view.visible;
  // Only items that are unlocked show; a section with no item to show is hidden too.
  for (const [itemId, group] of widget.groups) group.hidden = !view.rows.some((r) => r.itemId === itemId && r.unlocked);
  widget.keptSection.hidden = !view.rows.some((r) => !r.sellable && r.unlocked);
  widget.sellSection.hidden = !view.rows.some((r) => r.sellable && r.unlocked);
  const selectedKey = widget.selected;
  const selected = view.rows.find((r) => r.sellable && stackKey(r.itemId, r.rarityId) === selectedKey);
  if (selectedKey !== null && !(selected && selected.count > 0)) widget.selected = null;
  const augmentRow = view.rows.find((r) => r.augmentable && r.rarityId === selection.augmentRarityId);
  if (selection.augmentRarityId !== null && !(augmentRow && augmentRow.count > 0)) selection.augmentRarityId = null;
  for (const r of view.rows) {
    const key = stackKey(r.itemId, r.rarityId);
    const handle = widget.tiles.get(key);
    if (!handle) continue;
    setText(handle.count, r.countText);
    handle.tile.classList.toggle('empty', r.count <= 0);
    handle.tile.classList.toggle('selected', r.augmentable ? r.rarityId === selection.augmentRarityId : key === widget.selected);
    handle.tile.classList.toggle('on', r.on);
    handle.tile.disabled = r.sellable || r.augmentable ? r.count <= 0 : !((r.usable || r.toggleable) && r.canUse);
    tips.set(handle.tile, () => r.tip);
  }
  const chosen = widget.selected === null ? undefined : selected;
  widget.sellOne.disabled = !chosen;
  widget.sellAll.disabled = !chosen;
  const channel = view.rows.find((r) => r.backChannel);
  widget.backChannel.hidden = channel === undefined;
  widget.backChannel.disabled = !(chosen?.backChannel && chosen.count > 0);
  tips.set(widget.backChannel, channel ? () => channel.backChannelTip : null);
}

/**
 * What the inventory's tiles and buttons do to the game, each followed by a refresh of the screen.
 *
 * Called by: {@link mountUi}. Calls: the engine commands.
 *
 * @param engine the engine to command
 * @param refresh redraws the screen
 */
export function inventoryActions(engine: StateQueries & ItemCommands, refresh: () => void) {
  return {
    sell: (itemId: string, rarityId: string, amount: number | 'all') => void engine.sellItems(itemId, rarityId, amount),
    giveUp: (itemId: string, rarityId: string) => void engine.giveUpForMoles(itemId, rarityId, 1),
    use: (itemId: string, rarityId: string) =>
      void (itemId === engine.getConfig().items.skillShard?.itemId ? engine.useSkillShard() : engine.useBurnLead(rarityId)),
    toggle: (itemId: string) =>
      void (itemId === engine.getConfig().items.adminKey?.itemId ? engine.toggleAdminKeys() : engine.toggleZeroDays()),
    refresh,
  };
}
