import type { SleeveSectionId, StatId } from '../uiText';
import type { BuyableView } from './buyableViewTypes';

/** A titled group of Sleeve purchases. */
export interface SleeveSection {
  readonly id: SleeveSectionId;
  readonly title: string;
  /** Sorted by base price, lowest first. */
  readonly buyables: readonly BuyableView[];
}

/** A thin cycle bar under a stat (a cooldown or decay). */
export interface StatBarView {
  /** Says what the bar is, and when its cycle is paused. */
  readonly label: string;
  /** 0..100, how far the current cycle has progressed. */
  readonly percent: number;
  /** True while the cycle advances (the stat is above 0). */
  readonly running: boolean;
}

/** One labelled value in a stat widget, optionally with a hover explanation and a cycle bar. */
export interface StatRowView {
  readonly id: StatId;
  readonly label: string;
  readonly text: string;
  /** The row has a hover text (known without building it). */
  readonly hasTip: boolean;
  /** Hover text for the whole row; `null` when the stat has none. Built when read (a getter), not when the view model is built. */
  readonly tip: string | null;
  /** Cycle bar shown under the row; `null` when the stat has none. */
  readonly bar: StatBarView | null;
  /** The row is not shown (a stat that exists only once something unlocks it). */
  readonly hidden: boolean;
}

/** Display data of the Sleeve widget: global stats and global purchases. */
export interface SleeveView {
  readonly title: string;
  /** Access level, interface speed, ICE Rating, heat and Legend, in display order. */
  readonly stats: readonly StatRowView[];
  /** The sleeve-wide purchases, in configuration order. */
  readonly buyables: readonly BuyableView[];
  /** The same purchases grouped for display (rebuyable, one-time, paid in nodes), each sorted by base price. Empty groups are left out. */
  readonly sections: readonly SleeveSection[];
}

/** Display data of the Network widget. */
export interface NetworkView {
  readonly title: string;
  /** Nodes, credits per second and payout per node, in display order. */
  readonly stats: readonly StatRowView[];
}
