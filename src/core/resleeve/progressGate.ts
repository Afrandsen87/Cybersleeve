/**
 * @module core
 * Resleeve context: gates re-sleeving on total sleeve levels, increasing the threshold per recorded life.
 * Uses existing run records; the gate changes no state.
 * Called by: app/createGame.ts. Calls: Progression.totalSleeveLevels.
 */
import type { Progression } from '../actions/progression';
import type { GameConfig, GameState, SleeveRunRecord } from '../types';
import type { ResleevePolicy, ResleeveRequirement } from './resleeve';

/**
 * Brings a loaded older save in line with the progress gate and the Rarity refinement skill (a pure function; the save version bump and
 * the call after loading are wired by the caller).
 *
 * @remarks
 * Older run records have no `sleeveLevelsTotal` (they read as 0). Sleeve levels carry over a re-sleeve, so the sleeve levels held now are
 * the best estimate for the newest run's total: the newest record gets `currentSleeveLevels`, older ones stay 0 (they are never a
 * baseline). Rarity refinement moved from credits to skill points, so a purchase made at the old price is dropped (the point it would
 * cost comes back automatically: points are derived from levels, not stored).
 *
 * Called by: `app/persistence.ts` (`SaveGame.read`, for a save from before v9). Calls: nothing. Changes `state` in place.
 *
 * @param state the loaded state (mutated: `wallet.runs`, `sleeve.purchased`)
 * @param currentSleeveLevels the total of all actions' sleeve levels now (from `Progression.totalSleeveLevels`)
 * @param rarityRefinementId the id of the Rarity refinement buyable
 */
export function migrateProgressionSave(state: GameState, currentSleeveLevels: number, rarityRefinementId: string): void {
  const runs = state.wallet.runs;
  const total = Number.isFinite(currentSleeveLevels) && currentSleeveLevels > 0 ? Math.floor(currentSleeveLevels) : 0;
  for (let i = 0; i < runs.length; i++) {
    const record: SleeveRunRecord = runs[i]!;
    runs[i] = { ...record, sleeveLevelsTotal: i === runs.length - 1 ? total : 0 };
  }
  delete state.sleeve.purchased[rarityRefinementId];
}

/**
 * Allows re-sleeving when sleeve levels reach the base plus the step per earlier re-sleeve.
 *
 * Called by: `createGame.ts` (combined with the Unlock gate), `engine.ts` (`canResleeve`, `resleeveRequirements`).
 * Calls: `Progression.totalSleeveLevels`. Changes nothing.
 */
export class ProgressGate implements ResleevePolicy {
  /**
   * @param config reads `resleeve.progressNeeded`
   * @param progression gives total sleeve levels
   */
  constructor(
    private readonly config: Pick<GameConfig, 'resleeve'>,
    private readonly progression: Pick<Progression, 'totalSleeveLevels'>,
  ) {}

  /** True when sleeve levels reach the threshold. Called by: engine. Calls: requirements. */
  canResleeve(state: GameState): boolean {
    return this.requirements(state).every((r) => r.held >= r.needed);
  }

  /** Returns held and required sleeve levels without mutation. Called by: engine, canResleeve. Calls: totalSleeveLevels. */
  requirements(state: GameState): readonly ResleeveRequirement[] {
    const step = this.config.resleeve.progressNeeded;
    if (step === undefined) return [];
    return [
      {
        kind: 'sleeveLevels',
        held: this.progression.totalSleeveLevels(state),
        needed: step.sleeveLevels + state.wallet.runs.length * step.perResleeve,
      },
    ];
  }
}
