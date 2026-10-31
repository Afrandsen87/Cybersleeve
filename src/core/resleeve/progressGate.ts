/**
 * @module core
 *
 * The re-sleeve progress gate: a re-sleeve is allowed only when this run has gone further than the last one.
 *
 * @remarks
 * Next to {@link ResleeveGate} (the Unlock purchase and its lockout); `allOf` in `resleeve.ts` requires both. This run's total action
 * levels must be at least the last run's `actionLevelsTotal` plus `resleeve.progressNeeded.actionLevels`, and its total sleeve levels at
 * least the last run's `sleeveLevelsTotal` plus `progressNeeded.sleeveLevels`. With no earlier run the baseline is 0. Nothing extra is
 * saved: the baseline is the newest {@link SleeveRunRecord}.
 *
 * Called by: `app/createGame.ts`. Calls: `Progression.totalActionLevels`, `Progression.totalSleeveLevels`.
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
 * Called by: the save loader's migration step (wired by the orchestrator). Calls: nothing. Changes `state` in place.
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
 * Allows re-sleeving only when both totals have beaten the last run's by the configured amounts.
 *
 * Called by: `createGame.ts` (combined with the Unlock gate), `engine.ts` (`canResleeve`, `resleeveRequirements`).
 * Calls: `Progression.totalActionLevels`, `Progression.totalSleeveLevels`. Changes nothing.
 */
export class ProgressGate implements ResleevePolicy {
  /**
   * @param config reads `resleeve.progressNeeded`
   * @param progression gives the two totals
   */
  constructor(
    private readonly config: Pick<GameConfig, 'resleeve'>,
    private readonly progression: Pick<Progression, 'totalActionLevels' | 'totalSleeveLevels'>,
  ) {}

  /** True when both totals have reached what the next re-sleeve needs. */
  canResleeve(state: GameState): boolean {
    return this.requirements(state).every((r) => r.held >= r.needed);
  }

  /** The two requirements (action levels, then sleeve levels): what is held in this run and what the last run's totals plus the step make needed. */
  requirements(state: GameState): readonly ResleeveRequirement[] {
    const last = state.wallet.runs[state.wallet.runs.length - 1];
    const step = this.config.resleeve.progressNeeded;
    if (step === undefined) return [];
    return [
      { kind: 'actionLevels', held: this.progression.totalActionLevels(state), needed: (last?.actionLevelsTotal ?? 0) + step.actionLevels },
      { kind: 'sleeveLevels', held: this.progression.totalSleeveLevels(state), needed: (last?.sleeveLevelsTotal ?? 0) + step.sleeveLevels },
    ];
  }
}
