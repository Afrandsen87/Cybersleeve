/**
 * @module core
 *
 * Critical successes: which of a batch of completed runs were critical, and what the rule for an action is.
 */
import { binomial, type RandomSource } from './sampling';
import type { ActionDefinition, CriticalSuccessRule } from './types';

/** Where the chance of a critical success comes from (satisfied by `DerivedStats`). */
export interface CriticalChanceSource {
  /** Chance (0..1) that one completed run is a critical success. */
  criticalChance(): number;
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

/**
 * Draws how many of a batch of completed runs are critical successes.
 *
 * @remarks
 * Like item drops, this is one binomial draw per batch (not one roll per run), so a batch of a million runs costs as much as one
 * run. The chance is read when the runs complete.
 *
 * Called by: `actionRunner.ts` (`ActionRunner.completeRuns`).
 * Calls: {@link CriticalChanceSource.criticalChance}, `binomial`.
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
   * How many of `runs` completed runs are critical.
   *
   * @param runs how many runs completed (a whole number >= 1)
   * @returns a whole number in `0..runs` (always 0 while no `criticalChance` buyable is owned; no random number is drawn then)
   */
  roll(runs: number): number {
    const chance = this.source.criticalChance();
    return chance > 0 ? binomial(runs, chance, this.random) : 0;
  }
}
