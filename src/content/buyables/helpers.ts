/**
 * @module content
 *
 * Builders shared by the buyables of several actions: the Overclock and Focus unlocks, priced from the action's Auto-run price.
 */
import type { BuyableDefinition } from '../../core';
import { num } from '../../numbers';
import { PRACTICE_HACKING, GROW_NETWORK, PUSH_MALWARE, KILL_SERVERS, LEGEND, overclockUnlockId, focusUnlockId } from '../ids';

/** Price of each action's Auto-run buyable; the Overclock and Focus unlock prices are derived from it. */
const AUTO_RUN_COSTS: Readonly<Record<string, number>> = {
  [GROW_NETWORK]: 10,
  [PRACTICE_HACKING]: 100,
  [PUSH_MALWARE]: 15_000,
  [KILL_SERVERS]: 1e9,
  [LEGEND]: 1e15,
};
/** The Auto-run price of an action; an action without an entry in `AUTO_RUN_COSTS` is a content error. */
export const autoRunCost = (actionId: string): number => {
  const cost = AUTO_RUN_COSTS[actionId];
  if (cost === undefined) throw new Error(`No Auto-run price for action "${actionId}"`);
  return cost;
};
/** An action's Overclock unlock costs this many times its Auto-run price (Grow network: 10 -> 250). */
const OVERCLOCK_UNLOCK_COST_RATIO = 25;
/** An action's Focus unlock costs this many times its Auto-run price (Grow network: 10 -> 1,000). */
const FOCUS_UNLOCK_COST_RATIO = 100;
/** The Overclock unlock of one action: its price is a fixed multiple of the action's Auto-run price. */
export const overclockUnlock = (actionId: string, description: string): BuyableDefinition => ({
  id: overclockUnlockId(actionId),
  name: 'Overclock',
  symbol: 'OV',
  description,
  actionId,
  cost: num(autoRunCost(actionId) * OVERCLOCK_UNLOCK_COST_RATIO),
  effect: { kind: 'overclockUnlock' },
});
/** The Focus unlock of one action: its price is a fixed multiple of the action's Auto-run price. */
export const focusUnlock = (actionId: string): BuyableDefinition => ({
  id: focusUnlockId(actionId),
  name: 'Focus',
  symbol: 'FO',
  description:
    'Unlocks Focus for this action: while focused it runs 25% faster. Only a few actions can be focused at once (Focus upgrades add slots).',
  actionId,
  cost: num(autoRunCost(actionId) * FOCUS_UNLOCK_COST_RATIO),
  effect: { kind: 'focusUnlock' },
});
