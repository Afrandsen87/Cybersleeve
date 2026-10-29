/**
 * @module core
 *
 * Re-sleeving as an action: what is written down about the life that ends, the reset, and what the next life gets.
 */
import type { NumberFactory } from '../../numbers';
import { INFINITY } from '../kernel/infinity';
import { repairBig } from '../kernel/fields';
import type { Progression } from '../actions/progression';
import { resetForResleeve } from '../save/state';
import type { DerivedStats } from '../engine/stats';
import type { SynthSleeves } from '../synth/synthSleeves';
import type { GameConfig, GameState, SleeveRunRecord } from '../types';

/**
 * Performs a re-sleeve on the live state.
 *
 * @remarks
 * In this order: the life that ends is written down as a {@link SleeveRunRecord} (its final credits per second from its own network,
 * after the heat tax and without synthetic income, and the total of its action levels), the state is reset (keeping what the
 * positive lists in `state.ts` name), the record is added to `GameState.runs`, and, when the player owns the synthetic sleeves skill,
 * a synthetic sleeve is gained that copies the run that just ended. Every run is recorded whatever skills are owned. The re-sleeve
 * points earned are `runs.length x resleeve.pointsPerResleeve` (see `createGame.ts`).
 *
 * Called by: `engine.ts`. Calls: `resetForResleeve`, {@link DerivedStats.passiveCreditsPerSecond}, {@link Progression.totalActionLevels},
 * {@link SynthSleeves}.
 */
export class Resleever {
  /**
   * Creates the service.
   *
   * @param config game content
   * @param state the live game state (mutated)
   * @param stats derived values (the credits per second to write down)
   * @param progression gives the total of the action levels to write down
   * @param synths gains the synthetic sleeve
   * @param factory number factory
   */
  constructor(
    private readonly config: GameConfig,
    private readonly state: GameState,
    private readonly stats: DerivedStats,
    private readonly progression: Progression,
    private readonly synths: SynthSleeves,
    private readonly factory: NumberFactory,
  ) {}

  /** Writes the ending run down, resets the state for the next life and gives it its synthetic sleeve. */
  resleeve(): void {
    const income = this.stats.passiveCreditsPerSecond();
    const record: SleeveRunRecord = {
      creditsPerSecond: repairBig(income, this.factory) ?? income,
      actionLevelsTotal: Math.min(this.progression.totalActionLevels(this.state), INFINITY),
      actionLevels: Object.fromEntries(this.config.actions.map((a) => [a.id, this.progression.actionLevel(this.state, a.id)])),
    };
    resetForResleeve(this.state, this.config, this.factory);
    this.state.wallet.runs.push(record);
    if (this.synths.isUnlocked()) this.synths.addForResleeve();
  }
}
