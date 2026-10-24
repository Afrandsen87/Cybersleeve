/**
 * @module core
 *
 * Reaction to numbers growing beyond the representable range.
 */
import type { NumberFactory } from '../numbers';
import { repairBig, repairScalars } from './fields';
import type { GameState } from './types';

/**
 * Decides what happens when an amount in the state stops being finite. Extension point: the real reaction
 * (the "infinity" prestige) is not designed yet, so the default only clamps.
 */
export interface OverflowPolicy {
  /**
   * Repairs or reacts to non-finite amounts in `state`.
   * @returns true when something was changed
   */
  apply(state: GameState): boolean;
}

/**
 * Builds the default policy: every non-finite scalar (see `fields.ts`) and every action's XP and sleeve XP is repaired.
 * Positive overflow is clamped to the largest finite value (the largest safe integer for plain numbers), negative
 * overflow becomes zero, and NaN becomes zero: NaN is a bug upstream and must never be turned into a windfall. This keeps
 * the state valid, saveable and displayable instead of corrupted.
 *
 * Called by: `app/createGame.ts`. Calls: `repairScalars`, `repairBig`.
 *
 * @param factory number factory
 */
export function createClampOverflowPolicy(factory: NumberFactory): OverflowPolicy {
  return {
    apply(state) {
      let changed = repairScalars(state, factory);
      for (const action of Object.values(state.actions)) {
        for (const key of ['xp', 'sleeveXp'] as const) {
          const fixed = repairBig(action[key], factory);
          if (fixed) {
            action[key] = fixed;
            changed = true;
          }
        }
      }
      return changed;
    },
  };
}
