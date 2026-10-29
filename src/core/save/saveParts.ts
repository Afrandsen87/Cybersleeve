/**
 * @module core
 *
 * The list of save parts and the order of the saved keys.
 *
 * @remarks
 * `serialization.ts` only composes this list. To save a new piece of state: give its context a `SavePart` (see `kernel/savePart.ts`) and add it
 * to {@link SAVE_PARTS} at the place where everything it depends on has been read, and add its keys to the two key-order lists. The saved text
 * is the same for the same state, because the key order is declared here, not left to the order the parts are read in.
 */
import { actionsSavePart, autoRunSavePart, togglesSavePart } from '../actions/actionsSave';
import { automationSavePart } from '../automation/automationSave';
import { corporationSavePart } from '../corporation/corporationSave';
import { critsSavePart } from '../crits/critsSave';
import { inventorySavePart } from '../items/inventorySave';
import type { SavePart } from '../kernel/savePart';
import { runsSavePart } from '../resleeve/runsSave';
import { synthSavePart } from '../synth/synthSave';
import type { GameConfig } from '../types';
import { purchasesSavePart } from './purchasesSave';

/** The part of the content a save is read against. */
export type SaveConfig = Pick<
  GameConfig,
  'actions' | 'buyables' | 'corporation' | 'focus' | 'items' | 'progression' | 'sleeve' | 'automation'
>;

/**
 * Every part of a save, in the order they are READ: the purchases first (unlocks are checked against them), the runs before the synths that
 * point at them, the inventory before the key toggles that need a key held, the automation last (a feature needs its skill).
 *
 * Called by: `serialization.ts`.
 */
export const SAVE_PARTS: readonly SavePart<SaveConfig>[] = [
  autoRunSavePart,
  actionsSavePart,
  purchasesSavePart,
  runsSavePart,
  synthSavePart,
  corporationSavePart,
  togglesSavePart,
  inventorySavePart,
  critsSavePart,
  automationSavePart,
];

/** Order of the keys of the saved wallet (the scalars follow). */
export const WALLET_KEY_ORDER: readonly string[] = ['lastLifePurchases', 'runs', 'synths', 'corporations', 'automation', 'inventory'];

/** Order of the keys of the saved sleeve (the scalars follow). */
export const SLEEVE_KEY_ORDER: readonly string[] = [
  'autoRunOff',
  'overclocked',
  'focused',
  'focusStacks',
  'keyToggles',
  'chains',
  'bankedCriticals',
  'actions',
  'purchased',
];

/**
 * Puts the keys of an object in the declared order (keys not listed go last, in their own order).
 *
 * Called by: `serialization.ts`. Calls: nothing.
 *
 * @param data object to order (not changed)
 * @param order key order
 * @returns a new object with the same entries
 */
export function inKeyOrder(data: Readonly<Record<string, unknown>>, order: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of order) if (key in data) out[key] = data[key];
  for (const key of Object.keys(data)) if (!(key in out)) out[key] = data[key];
  return out;
}
