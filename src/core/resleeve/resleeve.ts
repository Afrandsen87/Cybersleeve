/**
 * @module core
 *
 * Re-sleeving (first prestige layer): the policy deciding when it is allowed (and how policies combine). The reset itself is `resetForResleeve` in `state.ts`.
 */
import type { GameState } from '../types';

/** What a {@link ResleeveRequirement} counts: the total of all actions' action levels or of their sleeve levels. */
export type ResleeveRequirementKind = 'actionLevels' | 'sleeveLevels';

/** A requirement the Re-sleeve button can state: how much of something is held and how much the next re-sleeve needs. */
export interface ResleeveRequirement {
  /** Which total this is. */
  readonly kind: ResleeveRequirementKind;
  /** The total held now. */
  readonly held: number;
  /** The total the next re-sleeve needs. */
  readonly needed: number;
}

/**
 * Decides whether the player may re-sleeve. A policy may also state what it is waiting for (so the button can say how much is missing).
 */
export interface ResleevePolicy {
  /** @returns true when re-sleeving is allowed in `state` */
  canResleeve(state: GameState): boolean;
  /** @returns what this policy requires and how much of it is held (empty when it requires nothing countable) */
  requirements?(state: GameState): readonly ResleeveRequirement[];
}

/**
 * Combines policies: re-sleeving is allowed only when every one allows it; the requirements are all of theirs together.
 *
 * Called by: `app/createGame.ts`. Calls: each policy's `canResleeve` and `requirement`.
 *
 * @param policies the policies to combine
 * @returns one policy
 */
export function allOf(...policies: readonly ResleevePolicy[]): ResleevePolicy {
  return {
    canResleeve: (state) => policies.every((p) => p.canResleeve(state)),
    requirements: (state) => policies.flatMap((p) => p.requirements?.(state) ?? []),
  };
}
