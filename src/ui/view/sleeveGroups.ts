/**
 * @module ui
 * Sleeve group ordering and the shared heat gauge presentation; no game rules or mutations.
 * Called by: sleeveView. Calls: heatStripLayout and number formatters.
 */
import type { SleeveStats } from '../../core';
import { formatSignificant } from '../../numbers';
import type { StatId, UiText } from '../uiText';
import { heatStripLayout } from './heatStrip';
import type { HeatGaugeView, StatGroupView, StatRowView } from './sleeveViewTypes';
import { PANEL_DIGITS } from './viewFormat';

/** Sleeve group identifiers. Called by: group views and text. Calls: none. */
export type StatGroupId = 'access' | 'skill' | 'defense' | 'risk';

/** Every sleeve stat has exactly one ordered group. Called by: sleeveGroups. Calls: none. */
export const SLEEVE_STAT_GROUPS: readonly { readonly id: StatGroupId; readonly statIds: readonly StatId[] }[] = [
  { id: 'access', statIds: ['access'] },
  { id: 'skill', statIds: ['interfaceSpeed', 'hackingProficiency', 'criticalChance'] },
  { id: 'defense', statIds: ['iceRating', 'legend'] },
  { id: 'risk', statIds: ['heat'] },
];

/**
 * Groups existing rows without changing their reveal rules, and orders them for sequential widgets.
 * Called by: sleeveView. Calls: array helpers; no side effects.
 * @param rows existing sleeve rows
 * @param text localized group titles
 * @returns group visibility and rows in group order
 */
export function sleeveGroups(rows: readonly StatRowView[], text: UiText): { groups: StatGroupView[]; stats: StatRowView[] } {
  const groups = SLEEVE_STAT_GROUPS.map(({ id, statIds }) => ({
    id,
    title: text.mainScreen.groupTitles[id],
    statIds,
    hidden: statIds.every((statId) => rows.find((row) => row.id === statId)?.hidden !== false),
  }));
  return { groups, stats: groups.flatMap((group) => group.statIds.flatMap((id) => rows.find((row) => row.id === id) ?? [])) };
}

/**
 * Builds the heat gauge from the same tax stop point passed to the row's tooltip.
 * Called by: sleeveView. Calls: heatStripLayout, formatSignificant; no side effects.
 * @param stats current derived sleeve stats
 * @param stopPoint tax-stop owner result, reused from sleeveRows
 * @param hidden heat row visibility
 * @param text display words
 * @returns null exactly while the heat row is hidden
 */
export function sleeveHeatGauge(stats: SleeveStats, stopPoint: number | null, hidden: boolean, text: UiText): HeatGaugeView | null {
  if (hidden) return null;
  return {
    strip: heatStripLayout({ heat: stats.heat, taxStart: stopPoint }),
    valueText: text.mainScreen.heatValue(formatSignificant(stats.heat, PANEL_DIGITS)),
    zoneText: text.mainScreen.zoneText,
    legendText:
      stopPoint === null
        ? text.mainScreen.capLegend(formatSignificant(stats.heatTaxCap * 100, PANEL_DIGITS))
        : text.mainScreen.stopLegend(formatSignificant(stopPoint, PANEL_DIGITS)),
  };
}
