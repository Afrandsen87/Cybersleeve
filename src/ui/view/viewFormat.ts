/**
 * @module ui
 *
 * Small helpers shared by the view builders: the number of decimals each kind of figure is shown with, stat rows, initials,
 * and the naming of the purchases behind a multiplier.
 *
 * @remarks
 * Called by: every builder in `ui/view/`. Calls: `formatPlain`.
 */
import type { FactorTerm, GameConfig } from '../../core';
import { type StatId, type TipTerm, type UiText, uiText as defaultText } from '../uiText';
import type { StatBarView, StatRowView } from './viewTypes';

/** Finds a stat row by id. @throws Error if the widget has no such row */
export function statRow(rows: readonly StatRowView[], id: StatId): StatRowView {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`No stat row ${id}`);
  return row;
}

/**
 * Builds one stat row. The hover text is kept as a function and exposed as a getter, so it is only built when read.
 *
 * Called by: {@link sleeveRows}, {@link networkView}.
 *
 * @param id which stat
 * @param text the display text (gives the row's label)
 * @param value the value as shown
 * @param tip builds the hover text; `null` when the stat has none
 * @param bar the cycle bar under the row, if any
 * @param hidden the row is not shown yet
 */
export const buildStatRow = (
  id: StatId,
  text: UiText,
  value: string,
  tip: (() => string) | null = null,
  bar: StatBarView | null = null,
  hidden = false,
): StatRowView => ({
  id,
  label: text.statLabels[id],
  text: value,
  hasTip: tip !== null,
  get tip() {
    return tip === null ? null : tip();
  },
  bar,
  hidden,
});

/**
 * Names the owned purchases behind a multiplier: one term per purchase, with its copies when more than one is owned.
 *
 * Called by: {@link buildScoped}, {@link sleeveRows}. Calls: `formatPlain`.
 *
 * @param terms what each owned buyable contributes (from `SleeveStats`)
 * @param config game configuration (names the buyables)
 * @param owned copies owned of a buyable
 * @param format formats a factor for display
 */
export function namedTerms(
  terms: readonly FactorTerm[],
  config: GameConfig,
  owned: (buyableId: string) => number,
  format: (factor: number) => string,
): TipTerm[] {
  return terms.map((t) => {
    const name = config.buyables.find((b) => b.id === t.buyableId)?.name ?? t.buyableId;
    const copies = owned(t.buyableId);
    return { label: copies > 1 ? `${name} (${copies} copies)` : name, value: format(t.factor) };
  });
}

/** Decimals shown for Hacking Proficiency: each run adds a small amount (0.001), which two decimals would hide. */
export const PROFICIENCY_DECIMALS = 4;

/** Decimals shown for speeds in the calculation tooltips, so that the lines add up (5s / 0.1546 = 32.34s). */
export const SPEED_DECIMALS = 4;

/** Decimals shown for the hacking multiplier, so that the same small steps show up in it. */
export const MULTIPLIER_DECIMALS = 4;

/** Decimals shown for the credits per second that actions add to a node's base (each run adds a tiny amount). */
export const ACTION_BONUS_DECIMALS = 9;

/** Decimals shown for what one node pays per second (the amounts are small, 0.075 must not show as 0.08). */
export const PER_NODE_DECIMALS = 3;

/** Decimals shown for a drop chance in percent (a rare drop of a rare item is a small number). */
export const DROP_CHANCE_DECIMALS = 4;

/** Decimals shown for the action XP per run (each schematic adds a small share of it). */
export const AUGMENT_XP_DECIMALS = 4;

/** Decimals shown for heat in the Burn lead tip (heat comes in fractions of a point). */
export const HEAT_DECIMALS = 4;

/** Decimals shown for the bonus one schematic adds, as a plain number (0.01). */
export const AUGMENT_BONUS_DECIMALS = 6;

/** Decimals shown for the strength and the heat cost of Overclock (strength grows in steps of a tenth). */
export const MODE_DECIMALS = 4;

/** Initials of a name, e.g. `"Dual processors"` gives `"DP"`. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')
    .slice(0, 3);
}

/**
 * Formats milliseconds as seconds with up to 2 decimals, e.g. `"3.33s"`.
 * @param ms duration in milliseconds
 * @param text the display text (default: the placeholder text of the game)
 */
export function formatSeconds(ms: number, text: UiText = defaultText): string {
  return text.format.seconds(String(Number((ms / 1000).toFixed(2))));
}
