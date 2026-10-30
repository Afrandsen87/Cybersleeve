/**
 * @module core
 *
 * Which actions and Overclocks make heat: the one owner of that predicate, read by the Auto Burn automation (what it switches off and on)
 * and by the interface (heat shows once an Overclock that makes heat is on offer).
 */
import type { ActionDefinition } from '../types';

/**
 * True when running the action makes heat by itself (heat per run or per second).
 *
 * Called by: {@link overclockMakesHeat}, `app/createGame.ts` (which Auto-runs Auto Burn may switch), `ui/view/statReveal.ts`.
 *
 * @param action the action's definition
 */
export function actionMakesHeat(action: Pick<ActionDefinition, 'heatPerRun' | 'heatPerSecond'>): boolean {
  return (action.heatPerRun ?? 0) > 0 || (action.heatPerSecond ?? 0) > 0;
}

/**
 * True when an Overclock on the action makes heat: its own heat per minute, or the action makes heat itself (Overclocking it makes more of it).
 *
 * Called by: `app/createGame.ts` (which Overclocks Auto Burn may switch), `ui/view/statReveal.ts`. Calls: {@link actionMakesHeat}.
 *
 * @param action the action's definition
 */
export function overclockMakesHeat(action: Pick<ActionDefinition, 'heatPerRun' | 'heatPerSecond' | 'overclock'>): boolean {
  return (action.overclock?.heatPerMinute ?? 0) > 0 || actionMakesHeat(action);
}
