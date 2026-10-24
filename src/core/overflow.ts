/**
 * @module core
 *
 * Reaction to numbers growing beyond the representable range.
 */
import type { BigNum, NumberFactory } from '../numbers';
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
 * Builds the default policy: every non-finite amount (credits, network, action XP, sleeve XP) is clamped to the
 * largest finite value, or to zero when it is negative; non-finite heat is clamped to the largest safe integer
 * (NaN becomes 0). This keeps the state valid, saveable and displayable instead of corrupted.
 *
 * Called by: `app/createGame.ts`. Calls: `NumberFactory.maxValue`.
 *
 * @param factory number factory
 */
export function createClampOverflowPolicy(factory: NumberFactory): OverflowPolicy {
  const fix = (value: BigNum): BigNum | null => {
    if (value.isFinite()) return null;
    return value.isNegative() ? factory.fromNumber(0) : factory.maxValue();
  };
  return {
    apply(state) {
      let changed = false;
      const clamp = <K extends string, T extends Record<K, BigNum>>(target: T, key: K): void => {
        const fixed = fix(target[key]);
        if (fixed) {
          target[key] = fixed as T[K];
          changed = true;
        }
      };
      clamp(state, 'credits');
      clamp(state, 'network');
      for (const action of Object.values(state.actions)) {
        clamp(action, 'xp');
        clamp(action, 'sleeveXp');
      }
      if (!Number.isFinite(state.heat)) {
        state.heat = Number.isNaN(state.heat) ? 0 : Number.MAX_SAFE_INTEGER;
        changed = true;
      }
      return changed;
    },
  };
}
