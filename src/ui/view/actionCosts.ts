/**
 * @module ui
 *
 * The cost items on an action card: everything a run costs or makes worse, as short phrases for the card's costs line.
 *
 * @remarks
 * Each value comes from its owner and is only formatted here: the heat chance from `GameQueries.heatChance`, the start cost from
 * `startCostOf` (formatted by the caller), the Overclock values from `overclockStatus`. Nothing is recomputed.
 */
import type { ActionDefinition, ActionQueries } from '../../core';
import { formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { MODE_DECIMALS } from './viewFormat';

/**
 * The cost items of one action, in a fixed order: heat of a run, heat per second, start cost, then the Overclock costs (only while Overclock is on).
 *
 * Called by: `actionView.ts` (`buildActionViews`). Calls: `GameQueries.heatChance`, `GameQueries.overclockStatus`, the text table.
 *
 * @param engine the engine to read from
 * @param def the action
 * @param startCost the start cost, already formatted (`null` when starting is free)
 * @param text the display text
 * @returns the items; empty when the action costs nothing
 */
export function actionCostItems(
  engine: Pick<ActionQueries, 'heatChance' | 'overclockStatus'>,
  def: ActionDefinition,
  startCost: string | null,
  text: UiText,
): string[] {
  const items: string[] = [];
  const heatPerRun = def.heatPerRun ?? 0;
  const chance = engine.heatChance(def.id);
  if (heatPerRun > 0) items.push(text.action.cost.heatPerRun(formatPlain(heatPerRun), chance < 1 ? formatPlain(chance * 100) : null));
  if ((def.heatPerSecond ?? 0) > 0) items.push(text.action.cost.heatPerSecond(formatPlain(def.heatPerSecond ?? 0)));
  if (startCost !== null) items.push(text.action.cost.start(startCost));
  const overclock = engine.overclockStatus(def.id);
  if (overclock?.on) {
    if (overclock.heatPerMinute > 0) items.push(text.action.cost.heatPerMinute(formatPlain(overclock.heatPerMinute, MODE_DECIMALS)));
    const nodes = overclock.completionEffects.reduce((sum, e) => (e.kind === 'removeNodes' ? sum + e.amount : sum), 0);
    if (nodes > 0) items.push(text.action.cost.nodesPerRun(formatPlain(nodes)));
  }
  return items;
}
