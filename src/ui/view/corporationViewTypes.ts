import type { BuyableView } from './buyableViewTypes';
import type { StatRowView } from './sleeveViewTypes';

/** Display data of one action of the corporation. */
export interface CorporationActionView {
  /** The purchases of this action, cheapest base price first (the row under its card). */
  readonly buyables: readonly BuyableView[];
  /** The action level. */
  readonly level: number;
  /** The label above the level bar, e.g. `"Lv 2 - 5/20 XP"`. */
  readonly levelBarText: string;
  /** How far through its level the action is, 0 to 100. */
  readonly levelProgressPercent: number;
  readonly id: string;
  readonly name: string;
  /** The run bar is filling. */
  readonly running: boolean;
  /** 0..100, how far through the current run. */
  readonly progressPercent: number;
  /** Starting it now would work. */
  readonly startable: boolean;
  /** The one-line description under the title (the run time). */
  readonly infoText: string;
  /** Hover text: what the action does. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
}

/** Display data of the Corporation tab. */
export interface CorporationView {
  /** Title of the corporation widget. */
  readonly title: string;
  /** The rows of the corporation widget: corporate rank, owned corporations and employees. */
  readonly stats: readonly StatRowView[];
  /** The Holdings widget: its title and rows (stocks owned). */
  readonly holdings: { readonly title: string; readonly stats: readonly StatRowView[] };
  /** The corporation's own purchases (Asset Acquisition widget), cheapest base price first. */
  readonly buyables: readonly BuyableView[];
  /** The corporation's actions, in order. */
  readonly actions: readonly CorporationActionView[];
  /** The Synthetic Sleeves widget (the option to buy synthetic sleeves; empty for now): its title, and whether the Synthetic Procurement skill has opened it. */
  readonly synthPurchase: { readonly title: string; readonly visible: boolean };
}
