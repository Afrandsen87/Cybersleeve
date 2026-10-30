/**
 * @module core
 *
 * Which actions and Overclocks make heat: the one owner of that predicate, read by the Auto Burn automation (what it switches off and on)
 * and by the interface (heat shows once an Overclock that makes heat is on offer).
 */
import { traitsOf } from '../effects/effectTraits';
import type { ActionDefinition, ActionId, BuyableDefinition, BuyableId } from '../types';

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

/**
 * The Overclocks Auto Burn may switch: the actions whose Overclock makes heat.
 *
 * Called by: `app/createGame.ts`. Calls: {@link overclockMakesHeat}.
 *
 * @param actions all action definitions
 */
export function heatMakingOverclockActions(actions: readonly ActionDefinition[]): ActionId[] {
  return actions.filter(overclockMakesHeat).map((a) => a.id);
}

/**
 * The Auto-runs Auto Burn may switch: the toggleable buyables (the Auto-run trait) of actions that make heat by themselves.
 *
 * Called by: `app/createGame.ts`, `automation/automationSave.ts` (which recorded ids a save may keep). Calls: {@link actionMakesHeat}, `traitsOf`.
 *
 * @param buyables all buyable definitions
 * @param actions all action definitions
 */
export function heatMakingAutoRuns(buyables: readonly BuyableDefinition[], actions: readonly ActionDefinition[]): BuyableId[] {
  const heatMaking = new Set(actions.filter(actionMakesHeat).map((a) => a.id));
  return buyables.filter((b) => traitsOf(b).toggleable && heatMaking.has(b.actionId ?? '')).map((b) => b.id);
}
