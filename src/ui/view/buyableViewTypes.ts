/** Display data of one buyable. */
export interface BuyableView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Short text for the square button (configured symbol, else the name's initials). */
  readonly symbol: string;
  /** Id of the action this purchase belongs to; absent for sleeve-wide (global) purchases. */
  readonly actionId: string | undefined;
  /** Price of the next copy. */
  readonly costText: string;
  /** What the price is paid in, e.g. `"credits"` or `"nodes"`. */
  readonly costUnit: string;
  /** Copies owned. */
  readonly owned: number;
  /** More than one copy can be bought. */
  readonly repeatable: boolean;
  /** No more copies can be bought. */
  readonly maxed: boolean;
  /** Requirements met and the price within reach of what was held (see `reveal.buyableOrders`; the square's purchases are always in reach); other buyables are hidden. */
  readonly available: boolean;
  /** Can be bought right now. */
  readonly affordable: boolean;
  /** An auto-run purchase: once owned, clicking it switches auto-run on or off instead of buying. */
  readonly toggleable: boolean;
  /** For a toggleable purchase: owned and switched on. */
  readonly enabled: boolean;
  /** The button reacts to a click: it can be bought, or it is an owned toggle. */
  readonly clickable: boolean;
  /** Hover text: name, price or on/off state, and description. Built when read. */
  readonly tip: string;
  /** A rebuyable that has been bought before and can be bought again right now (shown lit up). */
  readonly ready: boolean;
  /** The purchase is shown in the square of its action's card (Auto-run, the Overclock and Focus unlocks), not in the card's row of purchases. */
  readonly inSquare: boolean;
}
