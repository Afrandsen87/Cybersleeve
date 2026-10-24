/**
 * @module core
 *
 * Re-sleeving (first prestige layer): the policy deciding when it is allowed. The reset itself is `resetForResleeve` in `state.ts`.
 */
import type { GameState } from './types';

/**
 * Decides whether the player may re-sleeve. Extension point: the real requirement
 * is not designed yet, so the default allows it at any time (for testing).
 */
export interface ResleevePolicy {
  /** @returns true when re-sleeving is allowed in `state` */
  canResleeve(state: GameState): boolean;
}

/** Temporary policy: always allowed. */
export const alwaysAllowResleeve: ResleevePolicy = { canResleeve: () => true };
