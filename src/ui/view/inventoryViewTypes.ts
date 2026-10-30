/** Display data of one stack of items (one item in one rarity). */
export interface InventoryRowView {
  readonly itemId: string;
  readonly rarityId: string;
  /** E.g. `"Common Kompromat file"`; just the item's name for an item without rarity. */
  readonly label: string;
  /** Short text shown on the tile when the item has no icon (the initials of the item's name). */
  readonly symbol: string;
  /** Position of the rarity in the list of rarities (0 = most common), for colouring the tile; `null` for an item without rarity. */
  readonly rarityIndex: number | null;
  /** Items held. A tile with 0 is shown dimmed. */
  readonly count: number;
  /** The item is unlocked: a purchase that drops it is owned, or some of it is held. Every rarity of an unlocked item shows, even at 0; an item that is not unlocked is hidden. */
  readonly unlocked: boolean;
  /** Clicking the tile selects the stack for the Augment buttons of the action cards (the Augment schematic). */
  readonly augmentable: boolean;
  /** The stack can be paid out for credits (false for items such as Augment schematics, which are applied instead). */
  readonly sellable: boolean;
  readonly countText: string;
  /** Items of this kind are used up by clicking their tile (Burn leads). */
  readonly usable: boolean;
  /** Clicking the tile now would do something (a lead is held and there is heat to act on; the Zero-day toggle is on or one is held). */
  readonly canUse: boolean;
  /** Clicking the tile switches the item on or off instead of using it up (Zero-days). */
  readonly toggleable: boolean;
  /** For a toggleable item: it is switched on. */
  readonly on: boolean;
  /** The Back Channel Deals skill is owned and this stack can be given up for Moles. */
  readonly backChannel: boolean;
  /** Hover text of the back channel button (empty when `backChannel` is false). */
  readonly backChannelTip: string;
  /** Hover text: what one item sells for and what the whole stack is worth. Built when read. */
  readonly tip: string;
}

/**
 * What the player has selected on the screen. A choice of the screen only: it is not game state and is not saved, so it is handed to
 * the view model next to the engine.
 */
export interface ViewSelection {
  /** The rarity of Augment schematic selected in the Inventory, or `null`. The Augment buttons of the action cards use this rarity. */
  readonly augmentRarityId: string | null;
  /** Test aid: show everything the rules of the game hide (tabs, stats, purchases, items). Default: off. */
  readonly revealAll?: boolean;
}

/** Nothing selected. */
export const NO_SELECTION: ViewSelection = { augmentRarityId: null };

/** Display data of the Inventory widget. */
export interface InventoryView {
  readonly title: string;
  /** The widget is shown once something can drop or is held. */
  readonly visible: boolean;
  /** One row per item and rarity in the configuration, most common first (one row for an item without rarity); rows with a count of 0 are hidden by the screen. */
  readonly rows: readonly InventoryRowView[];
}
