/**
 * @module core
 *
 * Critical successes: which of a batch of completed runs were critical, and what the rule for an action is.
 */
import { perRunEvents, type RandomSource } from '../kernel/sampling';
import type { ActionDefinition, CriticalSuccessRule } from '../types';

/** Where the chance of a critical success comes from (satisfied by `DerivedStats`). */
export interface CriticalChanceSource {
  /** Chance (0..1) that one completed run is a critical success. */
  criticalChance(): number;
  /** Chance (0..1) that a critical success brings one extra critical success (default: none). */
  criticalExtraChance?(): number;
}

/**
 * The rule that applies to an action's critical runs: the global rule with the action's own fields laid over it.
 *
 * @remarks
 * This is the single place an action's critical behaviour is decided, so giving an action its own effect on a critical success
 * means setting `ActionDefinition.criticalSuccess` in the content and nothing else.
 * Called by: `stats.ts` (`DerivedStats.criticalRule`).
 *
 * @param base the global rule (`GameConfig.criticalSuccess`)
 * @param def the action
 * @returns the rule for that action
 */
export function criticalRuleFor(base: CriticalSuccessRule, def: Pick<ActionDefinition, 'criticalSuccess'>): CriticalSuccessRule {
  return { ...base, ...def.criticalSuccess };
}

/** How a batch of completed runs came out. */
export interface CriticalBatch {
  /** Critical successes in the batch in all: one run can have several (a whole number >= 0). */
  readonly crits: number;
  /** Runs without any critical success (a whole number, 0..runs). They pay and teach as usual. */
  readonly plainRuns: number;
}

/**
 * Settles how many critical successes a batch of completed runs got.
 *
 * @remarks
 * Every run has a critical chance `c` that may exceed 100%: it gets `floor(c)` critical successes for sure and one more with
 * probability `c - floor(c)` (150% is one sure success and a 50% chance of a second). On top of that, `covered` runs each carry +100%
 * (a Zero-day, an Admin key or a banked success), on distinct runs, so they are one more sure success each. Everything is drawn
 * once per batch with binomial draws (not once per run), so a batch of a million runs costs as much as one.
 * Each critical success then has `criticalExtraChance` to bring one more, free (one more binomial draw; the extras do not roll again).
 *
 * Called by: `actionRunner.ts` (`ActionRunner.completeRuns`).
 * Calls: {@link CriticalChanceSource.criticalChance}, `perRunEvents`.
 */
export class CriticalSuccesses {
  /**
   * Creates the unit.
   *
   * @param source where the chance comes from
   * @param random randomness (inject a seeded one in tests)
   */
  constructor(
    private readonly source: CriticalChanceSource,
    private readonly random: RandomSource,
  ) {}

  /**
   * The most critical successes one completed run can have, by the same rules {@link CriticalSuccesses.settle} draws with: the whole
   * part of the chance, one more while a fraction remains, one more while the run is covered (Zero-day, Admin key or banked success),
   * and all of that doubled while an extra chance exists (one possible extra per success, which does not roll again).
   *
   * Called by: `engine/stats.ts` (`DerivedStats.maxCritsPerRun`). Calls: nothing (pure).
   *
   * @param chance the critical chance (>= 0; may exceed 1)
   * @param extraChance the chance of an extra critical success (0 = none)
   * @param covered whether the run is covered (see `criticalCover`)
   * @returns a whole number >= 0 (0 when no critical is possible)
   */
  static maxPerRun(chance: number, extraChance: number, covered: boolean): number {
    const rolled = Math.floor(chance) + (chance % 1 > 0 ? 1 : 0) + (covered ? 1 : 0);
    return extraChance > 0 ? rolled * 2 : rolled;
  }

  /**
   * Settles a batch.
   *
   * @param runs how many runs completed (a whole number >= 1)
   * @param covered how many of them carry +100% critical chance from items or the bank (a whole number, 0..runs)
   * @returns the critical successes and the runs that got none; no random number is drawn while there is no chance below 100% to roll
   */
  settle(runs: number, covered: number): CriticalBatch {
    const chance = this.source.criticalChance();
    const sure = Math.floor(chance);
    const part = chance - sure;
    // Two draws, so that the runs that carry +100% and those that do not can be told apart: covered runs always have at least one success.
    const uncovered = runs - covered;
    const uncoveredExtra = part > 0 ? perRunEvents(uncovered, part, this.random) : 0;
    const coveredExtra = part > 0 ? perRunEvents(covered, part, this.random) : 0;
    const rolled = covered + runs * sure + uncoveredExtra + coveredExtra;
    // Each critical success may bring one extra, free; the extras do not roll again.
    const crits = rolled + perRunEvents(rolled, this.source.criticalExtraChance?.() ?? 0, this.random);
    const plainRuns = sure > 0 ? 0 : uncovered - uncoveredExtra;
    return { crits, plainRuns };
  }
}
