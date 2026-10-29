/**
 * @module core
 *
 * The second re-sleeve gate: the total of all actions' sleeve levels must reach a threshold that rises with every re-sleeve.
 *
 * @remarks
 * Next to {@link ResleeveGate} (the Unlock purchase and its lockout); `allOf` in `resleeve.ts` requires both. Sleeve levels carry over a
 * re-sleeve, so the total only grows; a save that is already past a threshold is simply allowed. The threshold comes from content
 * (`resleeve.sleeveLevelsNeeded`); a game without it has no such gate. Nothing is saved: the threshold is derived from `runs.length`.
 * Called by: `app/createGame.ts`. Calls: `Progression.sleeveLevel`.
 */
import type { Progression } from '../actions/progression';
import type { ActionDefinition, GameConfig, GameState } from '../types';
import type { ResleevePolicy, ResleeveRequirement } from './resleeve';

/**
 * The sleeve-level total the next re-sleeve needs.
 *
 * Called by: {@link SleeveLevelGate}. Calls: nothing.
 *
 * @param needed the content rule (`undefined`: no rule)
 * @param resleevesDone how many re-sleeves have happened (the length of the run record, >= 0)
 * @returns `base + perResleeve x resleevesDone`, or 0 without a rule
 */
export function sleeveLevelsNeeded(needed: GameConfig['resleeve']['sleeveLevelsNeeded'], resleevesDone: number): number {
  if (needed === undefined) return 0;
  return needed.base + needed.perResleeve * Math.max(0, resleevesDone);
}

/**
 * Allows re-sleeving only while the total of sleeve levels has reached the threshold for the next re-sleeve.
 *
 * Called by: `createGame.ts` (combined with the Unlock gate), `engine.ts` (`canResleeve`, `resleeveRequirement`).
 * Calls: {@link sleeveLevelsNeeded}, `Progression.sleeveLevel`. Changes nothing.
 */
export class SleeveLevelGate implements ResleevePolicy {
  /**
   * @param config reads `resleeve.sleeveLevelsNeeded` and the actions
   * @param progression gives the sleeve level of an action
   */
  constructor(
    private readonly config: Pick<GameConfig, 'resleeve'> & { readonly actions: readonly Pick<ActionDefinition, 'id'>[] },
    private readonly progression: Pick<Progression, 'sleeveLevel'>,
  ) {}

  /** The total of all actions' sleeve levels now (never negative or NaN). */
  held(state: GameState): number {
    let total = 0;
    for (const a of this.config.actions) total += this.progression.sleeveLevel(state, a.id);
    return Math.max(0, total) || 0;
  }

  /** True when there is no rule, or the held total has reached the threshold of the next re-sleeve. */
  canResleeve(state: GameState): boolean {
    const r = this.requirement(state);
    return r === null || r.held >= r.needed;
  }

  /** What the next re-sleeve needs and what is held, or `null` when the content has no rule. */
  requirement(state: GameState): ResleeveRequirement | null {
    if (this.config.resleeve.sleeveLevelsNeeded === undefined) return null;
    return {
      held: this.held(state),
      needed: sleeveLevelsNeeded(this.config.resleeve.sleeveLevelsNeeded, state.wallet.runs.length),
    };
  }
}
