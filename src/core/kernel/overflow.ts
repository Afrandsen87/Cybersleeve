/**
 * @module core
 *
 * Reaction to numbers growing beyond the representable range.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { repairBig, repairScalars, SCALAR_FIELDS, scalarValue } from './fields';
import { INFINITY } from './infinity';
import type { GameState } from '../types';

/**
 * Decides what happens when an amount in the state stops being finite or reaches the game's infinity (1e308, see `infinity.ts`).
 * Extension point: the real reaction (the "infinity" prestige) is not designed yet, so the default only clamps and tells an
 * optional listener.
 */
export interface OverflowPolicy {
  /**
   * Repairs or reacts to non-finite amounts in `state`.
   * @returns true when something was changed
   */
  apply(state: GameState): boolean;
}

/**
 * Builds the default policy: every scalar (see `fields.ts`) and every action's XP and sleeve XP is repaired. Anything above 1e308
 * (the game's infinity) and positive overflow is clamped to 1e308 (the largest safe integer for plain numbers), negative overflow
 * becomes zero, and NaN becomes zero: NaN is a bug upstream and must never be turned into a windfall. This keeps the state valid,
 * saveable and displayable instead of corrupted. When an amount sits at infinity after the repair, `onInfinity` is called (once per
 * application): the hook for the future infinity prestige.
 *
 * Called by: `app/createGame.ts`. Calls: `repairScalars`, `repairBig`.
 *
 * @param factory number factory
 * @param onInfinity called when any amount has reached the game's infinity (default: nothing)
 */
export function createClampOverflowPolicy(factory: NumberFactory, onInfinity: () => void = () => {}): OverflowPolicy {
  const infinity = factory.fromNumber(INFINITY);
  return {
    apply(state) {
      let changed = repairScalars(state, factory);
      for (const action of Object.values(state.sleeve.actions)) {
        for (const key of ['xp', 'sleeveXp'] as const) {
          const fixed = repairBig(action[key], factory);
          if (fixed) {
            action[key] = fixed;
            changed = true;
          }
        }
      }
      if (reachedInfinity(state, infinity)) onInfinity();
      return changed;
    },
  };
}

/** True when any amount of the state (a big scalar, an action's XP or sleeve XP) is at or above the game's infinity. */
function reachedInfinity(state: GameState, infinity: BigNum): boolean {
  for (const f of SCALAR_FIELDS) {
    if (f.kind === 'big' && (scalarValue(state, f) as BigNum).gte(infinity)) return true;
  }
  return Object.values(state.sleeve.actions).some((a) => a.xp.gte(infinity) || a.sleeveXp.gte(infinity));
}
