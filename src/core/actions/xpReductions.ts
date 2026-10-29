/**
 * @module core
 *
 * The buyables that lower XP requirements and the runs one batch of sleeve XP takes: the sources are read from the content once, and each
 * answer is a pure function of the purchases (the level lookups they need are passed in).
 */
import { BuyableCaps } from '../effects/buyableCaps';
import type { BuyableDefinition } from '../effects/buyableTypes';
import { euphoriaReduction } from '../sleeve/sleeveEuphoria';
import type { ActionId, BuyableEffect, BuyableId, GameState } from '../types';

/** A `sleeveXpReduction` buyable. */
interface ReductionSource {
  readonly id: BuyableId;
  readonly effect: Extract<BuyableEffect, { kind: 'sleeveXpReduction' }>;
}

/** An `actionXpReduction` buyable. */
interface ActionReductionSource {
  readonly id: BuyableId;
  readonly amount: number;
}

/** An `actionXpReductionFromSleeveLevel` buyable (Sleeve Euphoria). */
interface EuphoriaSource {
  readonly id: BuyableId;
  readonly remainingPerOrder: number;
  readonly maxReduction: number;
}

/** A `runsPerSleeveXpReduction` buyable. */
interface RunsReductionSource {
  readonly id: BuyableId;
  readonly perCopy: number;
  readonly minRuns: number;
}

/** The largest divisor on sleeve XP requirements: keeps every threshold a positive, finite number at any level. */
const MAX_DIVISOR = 1e300;

/**
 * The XP reductions bought with buyables.
 *
 * @remarks
 * `sleeveXpReduction` buyables (Study methods) DIVIDE the XP every sleeve level asks for by `1 + perLevel x source sleeve level x copies`,
 * with no ceiling (the divisor is applied on its own, after, and apart from, the shared `maxSleeveXpReduction` clamp that caps the flat
 * action-level reductions). The action whose sleeve level feeds it is exempt, so that level is always measured against the normal thresholds.
 * `actionXpReduction` buyables do the same for every ACTION level (never the sleeve levels). `runsPerSleeveXpReduction` buyables lower how
 * many runs one batch of sleeve XP takes. Owns no state; reads `GameState.purchased`.
 *
 * Called by: `progression.ts`. Calls: {@link BuyableCaps}, `euphoriaReduction`.
 */
export class XpReductions {
  private readonly sleeveSources: readonly ReductionSource[];
  private readonly actionSources: readonly ActionReductionSource[];
  private readonly euphoriaSources: readonly EuphoriaSource[];
  private readonly runsSources: readonly RunsReductionSource[];
  private readonly caps: BuyableCaps;

  /**
   * Creates the unit.
   *
   * @param buyables all buyables (the ones with other effects are ignored)
   * @param baseRunsPerSleeveXp `progression.runsPerSleeveXp`: runs one batch takes with no reduction
   * @param maxTotalReduction `progression.maxSleeveXpReduction`: the ceiling of the summed flat reductions
   */
  constructor(
    buyables: readonly BuyableDefinition[],
    private readonly baseRunsPerSleeveXp: number,
    private readonly maxTotalReduction: number,
  ) {
    this.sleeveSources = buyables.flatMap((b) => (b.effect.kind === 'sleeveXpReduction' ? [{ id: b.id, effect: b.effect }] : []));
    this.actionSources = buyables.flatMap((b) => (b.effect.kind === 'actionXpReduction' ? [{ id: b.id, amount: b.effect.amount }] : []));
    this.euphoriaSources = buyables.flatMap((b) =>
      b.effect.kind === 'actionXpReductionFromSleeveLevel'
        ? [{ id: b.id, remainingPerOrder: b.effect.remainingPerOrder, maxReduction: b.effect.maxReduction }]
        : [],
    );
    this.runsSources = buyables.flatMap((b) =>
      b.effect.kind === 'runsPerSleeveXpReduction' ? [{ id: b.id, perCopy: b.effect.perCopy, minRuns: b.effect.minRuns }] : [],
    );
    this.caps = new BuyableCaps(buyables);
  }

  /**
   * Completed runs one batch of sleeve XP takes right now: the base less `perCopy` per owned copy of each `runsPerSleeveXpReduction`
   * buyable, but never below the largest `minRuns` among the owned ones, and never above the base.
   *
   * Called by: `Progression.runsPerSleeveXp`.
   *
   * @param state current state (reads `purchased`)
   * @returns a whole number between 1 and `progression.runsPerSleeveXp`
   */
  runsPerSleeveXp(state: GameState): number {
    let runs = this.baseRunsPerSleeveXp;
    let floor = 1;
    for (const { id, perCopy, minRuns } of this.runsSources) {
      const copies = state.purchased[id] ?? 0;
      if (copies <= 0) continue;
      runs -= perCopy * copies;
      // a skill that allows more copies of this buyable lowers its floor with them, one run per extra copy
      floor = Math.max(floor, minRuns - this.caps.bonusOf(state.purchased, id) * perCopy);
    }
    return Math.min(this.baseRunsPerSleeveXp, Math.max(floor, runs));
  }

  /**
   * Fraction by which the XP every level of one action needs is lowered. Two sources multiply: the flat `actionXpReduction` buyables
   * (summed, capped at `progression.maxSleeveXpReduction`) and Sleeve Euphoria (which depends on THIS action's sleeve level and has its own
   * ceiling). The result is `1 - (1 - flat) x (1 - euphoria)`.
   *
   * Called by: `Progression.actionXpReduction`.
   *
   * @param state current state (reads `purchased`)
   * @param sleeveLevel the sleeve level of the action, asked only when a Euphoria buyable is owned
   * @returns a fraction in [0, 1)
   */
  actionXpReduction(state: GameState, sleeveLevel: () => number): number {
    let flat = 0;
    for (const { id, amount } of this.actionSources) flat += amount * (state.purchased[id] ?? 0);
    let remaining = 1 - Math.min(flat, this.maxTotalReduction);
    for (const { id, remainingPerOrder, maxReduction } of this.euphoriaSources) {
      if ((state.purchased[id] ?? 0) <= 0) continue;
      remaining *= 1 - euphoriaReduction(sleeveLevel(), remainingPerOrder, maxReduction);
    }
    return 1 - remaining;
  }

  /**
   * The divisor owned `sleeveXpReduction` buyables put on the XP that one action's sleeve levels need: the product, over the owned ones, of
   * `1 + perLevel x sleeve level of sourceActionId x copies`. 1 when none applies; the source action itself is not divided by its own
   * buyable. No ceiling, but kept finite (at most `MAX_DIVISOR`); a non-finite term counts as no effect.
   *
   * Called by: `Progression.sleeveXpKeep`.
   *
   * @param state current state (reads `purchased`)
   * @param actionId the action whose sleeve levels are asked about
   * @param unreducedSleeveLevel the sleeve level of an action measured against the normal thresholds
   * @returns a number >= 1
   */
  sleeveXpDivisor(state: GameState, actionId: ActionId, unreducedSleeveLevel: (id: ActionId) => number): number {
    let divisor = 1;
    for (const { id, effect } of this.sleeveSources) {
      const copies = state.purchased[id] ?? 0;
      if (copies <= 0 || effect.sourceActionId === actionId) continue;
      const term = effect.perLevel * unreducedSleeveLevel(effect.sourceActionId) * copies;
      if (Number.isFinite(term) && term > 0) divisor *= 1 + term;
    }
    return Math.min(divisor, MAX_DIVISOR);
  }
}
