import type { SleeveSectionId, StatId } from '../uiText';
import type { BuyableView } from './buyableViewTypes';
import type { HeatStripLayout } from './heatStrip';

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
  /** The bar is not drawn now (the Legend decay bar while Legend is 0), although its row may be. */
  readonly hidden: boolean;
}

/** The colour meaning of a stat value, drawn by the widget through a data attribute (see the colour rules in `style.css`). */
export type StatTone = 'gain' | 'danger' | 'info';

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
  /** What the value's colour means; absent for the default colour. */
  readonly tone?: StatTone;
}

/** A titled group of Sleeve stat rows (ACCESS, SKILL, DEFENSE, RISK), drawn with a header line before its first row. */
export interface StatGroupView {
  readonly id: 'access' | 'skill' | 'defense' | 'risk';
  readonly title: string;
  /** The rows of the group, in display order. */
  readonly statIds: readonly StatId[];
  /** Every row of the group is hidden, so the header is too. */
  readonly hidden: boolean;
}

/** The heat gauge under the heat row: heat on a strip with the zone where the tax takes every credit. */
export interface HeatGaugeView {
  /** Fill, tax zone start and overflow, in percent of the strip (from `heatStripLayout`). */
  readonly strip: HeatStripLayout;
  /** The heat written on the strip, e.g. `HEAT 652`. */
  readonly valueText: string;
  /** The label of the tax zone. */
  readonly zoneText: string;
  /** Under the strip: where every credit is taxed, or the cap when the tax stops short of that. */
  readonly legendText: string;
}

/** Display data of the Sleeve widget: global stats and global purchases. */
export interface SleeveView {
  readonly title: string;
  /** The header status LED text. */
  readonly status: string;
  /** The stat rows, in group order (see `groups`). */
  readonly stats: readonly StatRowView[];
  /** The groups the rows are drawn in, in order. */
  readonly groups: readonly StatGroupView[];
  /** The heat gauge; `null` exactly while the heat row is hidden. */
  readonly heatGauge: HeatGaugeView | null;
  /** The title of the re-sleeve box at the bottom of the widget. */
  readonly resleeveTitle: string;
  /** The sleeve-wide purchases, in configuration order. */
  readonly buyables: readonly BuyableView[];
  /** The same purchases grouped for display (rebuyable, one-time, paid in nodes), each sorted by base price. Empty groups are left out. */
  readonly sections: readonly SleeveSection[];
}

/** Display data of the Network widget. */
export interface NetworkView {
  readonly title: string;
  /** The header status LED text; `null` while the sleeve has no nodes. */
  readonly status: string | null;
  /** The red note under the income: what share the heat tax takes; `null` while it takes nothing. */
  readonly taxNote: string | null;
  /** Nodes, credits per second and payout per node, in display order. */
  readonly stats: readonly StatRowView[];
}
